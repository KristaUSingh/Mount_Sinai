# -------------------------------------------------------------
# query_router.py
# -------------------------------------------------------------
# Purpose:
#   Connects Gemini intent recognition with the correct
#   query handler function.
# -------------------------------------------------------------

from src.query_interpreter import interpret_scheduling_query
from src.query_handlers import (
    exam_at_site,
    locations_for_exam,
    exams_at_site,
    exam_duration,
    rooms_for_exam_at_site
)

def answer_scheduling_query(user_input: str):
    """
    Purpose:
        Handle any scheduling-related user question by:
          1. Sending it to Gemini for interpretation
          2. Routing it to the correct lookup function
          3. Returning a clear, human-readable answer
    """
    parsed = interpret_scheduling_query(user_input)
    intent = parsed.get("intent")
    exam = parsed.get("exam")
    site = parsed.get("site")

    print("\n--- Gemini interpretation ---")
    print(parsed)
    print("------------------------------\n")

    # Intent 1: "Is [exam] done at [site]?"
    if intent == "exam_at_site" and exam and site:
        found = exam_at_site(exam, site)
        return f"✅ Yes, {exam} is performed at {site}." if found \
               else f"❌ No, {exam} is not listed at {site}."

    # Intent 2: "Which locations perform [exam]?"
    elif intent == "locations_for_exam" and exam:
        locs = locations_for_exam(exam)
        return (
            f"{exam} is performed at: {', '.join(locs)}."
            if locs else f"Sorry, I couldn’t find any locations for {exam}."
        )

    # Intent 3: "What exams are offered at [site]?"
    elif intent == "exams_at_site" and site:
        exams = exams_at_site(site)
        return (
            f"Exams offered at {site}: {', '.join(exams)}."
            if exams else f"No exams found for {site}."
        )
    
    # Intent 4: "How long does [exam] take?"
    elif intent == "exam_duration" and exam:
        length = exam_duration(exam)
        return (
            f"The visit length for {exam} is {length} minutes."
            if length else f"Sorry, I couldn’t find a visit duration for {exam}."
        )
    
    # Intent 5: "Which rooms at [site] perform [exam]?"
    elif intent == "rooms_for_exam_at_site" and exam and site:
        rooms = rooms_for_exam_at_site(exam, site)
        return (
            f"Rooms at {site} performing {exam}: {', '.join(rooms)}."
            if rooms else f"No matching rooms found for {exam} at {site}."
        )

    # Fallback if Gemini can't classify the question
    else:
        return "Sorry, I couldn’t understand that scheduling question."