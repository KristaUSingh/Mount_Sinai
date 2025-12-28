# -------------------------------------------------------------
# query_router.py
# -------------------------------------------------------------
# Purpose:
#   Connects Gemini intent recognition with the correct
#   query handler function.
# -------------------------------------------------------------

from typing import Optional
from difflib import get_close_matches

# ✅ ADDED
from datetime import datetime
from zoneinfo import ZoneInfo

from src.query_interpreter import interpret_scheduling_query
from src.query_handlers import (
    exam_at_site,
    locations_for_exam,
    exams_at_site,
    exam_duration,
    rooms_for_exam_at_site,
    rooms_for_exam,
)

from src.update_helpers import get_location_options_from_db


def detect_location_from_question(user_text: str, supabase):
    """
    If user mentions a location (exact or close), return it.
    Otherwise None.
    """
    options = get_location_options_from_db(supabase)
    if not options:
        return None

    text = (user_text or "").upper()

    # quick exact contains match
    for opt in options:
        if opt.upper() in text:
            return opt

    # fuzzy fallback
    close = get_close_matches(text, options, n=1, cutoff=0.65)
    return close[0] if close else None


CONFIRMATION_FOOTER = (
    "\n\n NOTE: Please confirm that the chosen EXAM/LOCATION is correct. "
    "If not, feel free to be more specific in your query."
)


# -------------------------------
# ✅ ADDED: Effective-date helpers (NY time)
# -------------------------------

def today_ny_str() -> str:
    """Return today's date in America/New_York as YYYY-MM-DD."""
    return datetime.now(ZoneInfo("America/New_York")).date().isoformat()


def add_effective_range_filters(q, today: str):
    """
    Apply:
      - (start_date IS NULL OR start_date <= today)
      - (end_date IS NULL OR end_date >= today)

    Works for notes only, but safe for docs too since docs will have NULL dates.
    """
    q = q.or_(f"start_date.is.null,start_date.lte.{today}")
    q = q.or_(f"end_date.is.null,end_date.gte.{today}")
    return q


def purge_expired_notes(supabase, today: str):
    """
    Auto-delete expired notes (end_date < today) from Supabase.
    NOTE: This runs opportunistically when notes are fetched.
    """
    if not supabase:
        return

    try:
        (
            supabase
            .table("documents")
            .delete()
            .ilike("file_path", "%Scheduling_Notes%")
            .lt("end_date", today)
            .execute()
        )
    except Exception as e:
        print("purge_expired_notes error:", e)


# -------------------------------
# Location Notes (Supabase-only)
# -------------------------------

def get_location_notes_from_db(supabase, location: str):
    """
    Pull location notes from Supabase documents table.
    We assume scheduling notes are stored with:
      - documents.location = exact location string
      - documents.file_path contains 'Scheduling_Notes'
    """
    if not supabase or not location:
        return []

    try:
        today = today_ny_str()

        # ✅ ADDED: auto-delete expired notes first
        purge_expired_notes(supabase, today)

        q = (
            supabase
            .table("documents")
            .select("content,file_path,location,start_date,end_date")  # ✅ ADDED fields
            .eq("location", location)
            .ilike("file_path", "%Scheduling_Notes%")
        )

        # ✅ ADDED: only active notes should show up
        q = add_effective_range_filters(q, today)

        res = q.execute()
        data = res.data or []

        # De-dupe notes by file_path (since multiple chunks could exist)
        seen_paths = set()
        notes = []

        for r in data:
            fp = r.get("file_path")
            if fp and fp in seen_paths:
                continue
            if fp:
                seen_paths.add(fp)

            txt = (r.get("content") or "").strip()
            if txt:
                notes.append(txt)

        return notes

    except Exception as e:
        print("get_location_notes_from_db error:", e)
        return []


def format_location_notes(location: str, supabase=None):
    """
    Format location-specific notes for display, if any exist.
    """
    notes = get_location_notes_from_db(supabase, location)

    # De-dupe by content (preserve order)
    deduped = []
    seen = set()
    for n in notes:
        key = n.strip().lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(n.strip())

    if not deduped:
        return ""

    formatted = "\n⚠️ LOCATION NOTES:\n"
    for note in deduped:
        formatted += f"- {note}\n"

    return formatted + "\n"


# Helper functions to return official site and exam names
def format_exam_header(exam, content):
    return (
        f"Official exam name: {exam}\n\n"
        f"{content.strip()}\n\n"
        f"{CONFIRMATION_FOOTER}"
    )


def format_site_exam_header(site, exam, content, supabase=None):
    notes_block = format_location_notes(site, supabase)

    return (
        f"Location name: {site}\n"
        f"Official exam name: {exam}\n\n"
        f"{content.strip()}\n\n"
        f"{notes_block}"
        f"{CONFIRMATION_FOOTER}"
    )


def format_site_header(site, content, supabase=None):
    notes_block = format_location_notes(site, supabase)

    return (
        f"Location name: {site}\n\n"
        f"{notes_block}"
        f"{content.strip()}\n\n"
        f"{CONFIRMATION_FOOTER}"
    )


def answer_scheduling_query(user_input: str, supabase=None):
    parsed = interpret_scheduling_query(user_input)
    intent = parsed.get("intent")
    exam = parsed.get("exam")
    site = parsed.get("site")

    print("\n--- Gemini interpretation ---")
    print(parsed)
    print("------------------------------\n")

    if intent == "exam_at_site" and exam and site:
        found, official_exam, official_site = exam_at_site(exam, site)

        if not official_exam:
            return "Exam name not recognized."
        if not official_site:
            return "Site name not recognized."

        content = (
            "Yes, this exam is performed at this site."
            if found
            else "No, this exam is not performed at this site."
        )

        return format_site_exam_header(official_site, official_exam, content, supabase)

    elif intent == "locations_for_exam" and exam:
        locs, official_exam = locations_for_exam(exam)

        if not official_exam:
            return "Exam name not recognized. Please check the spelling or try a more complete name."
        if not locs:
            return f"Sorry, no locations were found for {official_exam}."

        content = "Performed at:\n" + "\n".join(locs)
        return format_exam_header(official_exam, content)

    elif intent == "exams_at_site" and site:
        exams, official_site = exams_at_site(site)

        if not official_site:
            return "Site name not recognized."
        if not exams:
            return f"No exams found for the site: {official_site}."

        content = "Exams offered:\n" + "\n".join(exams)
        return format_site_header(official_site, content, supabase)

    elif intent == "exam_duration" and exam:
        duration, official_exam = exam_duration(exam)

        if not official_exam:
            return "Exam name not recognized."
        if not duration:
            return f"No visit duration found for the exam: {official_exam}."

        content = f"Duration: {duration} minutes"
        return format_exam_header(official_exam, content)

    elif intent == "rooms_for_exam_at_site" and exam and site:
        rooms, official_exam, official_site = rooms_for_exam_at_site(exam, site)

        if not official_exam:
            return "Exam name not recognized."
        if not official_site:
            return "Site name not recognized."
        if not rooms:
            return f"No rooms found performing {official_exam} at {official_site}."

        content = "Rooms:\n" + "\n".join(rooms)
        return format_site_exam_header(official_site, official_exam, content, supabase)

    elif intent == "rooms_for_exam" and exam:
        rooms, official_exam = rooms_for_exam(exam)

        if not official_exam:
            return "Exam name not recognized."
        if not rooms:
            return f"No rooms found performing the exam: {official_exam}."

        content = "Rooms performing this exam:\n" + "\n".join(rooms)
        return format_exam_header(official_exam, content)

    else:
        return "Sorry, I couldn’t understand that scheduling question."
