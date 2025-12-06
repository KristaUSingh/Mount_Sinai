# -------------------------------------------------------------
# fuzzy_matchers.py
# -------------------------------------------------------------
# Purpose:
#   Provides helper functions that help the system "guess" what
#   exam or site the user meant, even if the name isn't exact.
#   (Now includes abbreviation → site normalization)
# -------------------------------------------------------------

from rapidfuzz import fuzz, process
import re
from src.data_loader import df, ABBREV_TO_SITE   # ⬅️ import the mapping

# -------------------------------------------------------------
# Common abbreviation and cleanup rules for exam names
# -------------------------------------------------------------
ABBREV_MAP = {
    r"\bwo\b": "without",
    r"\bw/o\b": "without",
    r"\bw\b": "with",
    r"\biv\b": "intravenous"
}

IGNORE_WORDS = ["exam", "study"]

def normalize_text(s: str):
    """Simplify text (expand abbreviations, remove filler words)."""
    s = s.lower()

    # Expand common abbreviations
    for short, full in ABBREV_MAP.items():
        s = re.sub(short, full, s)

    # Remove filler words
    for w in IGNORE_WORDS:
        s = re.sub(rf"\b{w}\b", "", s)

    # Clean spacing
    return re.sub(r"\s+", " ", s).strip()


# -------------------------------------------------------------
# NEW: Normalize site abbreviations → full site names
# -------------------------------------------------------------
def normalize_site_query(q: str) -> str:
    """
    Convert short site codes (HESS, RA, MSW, JB, BC, etc.)
    into their official full site names BEFORE fuzzy matching.
    """
    if not q:
        return q

    clean = q.strip().upper()

    # Exact abbreviation match
    if clean in ABBREV_TO_SITE:
        return ABBREV_TO_SITE[clean]

    # Partial match (e.g., "HESS CT", "MSW mri", "JB xray")
    for abbr in ABBREV_TO_SITE:
        if clean.startswith(abbr):
            return ABBREV_TO_SITE[abbr]

    return q   # return original query if no abbreviation applies


# -------------------------------------------------------------
# Exam Matcher
# -------------------------------------------------------------
def best_exam_match(exam_query: str):
    """Find the most likely official exam name(s)."""

    if not isinstance(exam_query, str) or not exam_query.strip():
        return []

    norm_query = normalize_text(exam_query)

    exams_original = df["EAP Name"].dropna().unique()
    norm_map = {normalize_text(e): e for e in exams_original}

    choices = list(norm_map.keys())
    matches = process.extract(
        norm_query, choices,
        scorer=fuzz.token_set_ratio,
        limit=3
    )

    good = [norm_map[m] for m, score, _ in matches if score > 55]
    return good


# -------------------------------------------------------------
# SITE MATCHER (now with abbreviation expansion)
# -------------------------------------------------------------
def best_site_match(site_query: str):
    """Find the most likely official site/department name(s)."""

    if not isinstance(site_query, str) or not site_query.strip():
        return []

    # 🔥 Step 1: Expand abbreviations BEFORE ANYTHING ELSE
    site_query = normalize_site_query(site_query)

    # Lowercase normalization
    sq = site_query.lower().strip()

    # Convert text numbers (fifth → 5th)
    number_words = {
        "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th",
        "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th",
        "ninth": "9th", "tenth": "10th"
    }
    for word, num in number_words.items():
        sq = re.sub(rf"\b{word}\b", num, sq)

    # Official site names
    sites_original = df["DEP Name"].dropna().unique()
    norm_sites_map = {s.lower(): s for s in sites_original}

    choices = list(norm_sites_map.keys())

    matches = process.extract(
        sq, choices,
        scorer=fuzz.token_set_ratio,
        limit=3
    )

    good = [norm_sites_map[m] for m, score, _ in matches if score > 60]
    return good