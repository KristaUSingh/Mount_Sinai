# -------------------------------------------------------------
# fuzzy_matchers.py
# -------------------------------------------------------------
# Purpose:
#   Provides helper functions that help the system "guess" what
#   exam or site the user meant, even if the name isn't exact.
# -------------------------------------------------------------

from rapidfuzz import fuzz, process
import re
from src.data_loader import df

# Common abbreviation and cleanup rules
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
    for short, full in ABBREV_MAP.items():
        s = re.sub(short, full, s)
    for w in IGNORE_WORDS:
        s = re.sub(rf"\b{w}\b", "", s)
    return re.sub(r"\s+", " ", s).strip()

def best_exam_match(exam_query: str):
    """Find the most likely official exam name(s)."""
    if not isinstance(exam_query, str) or not exam_query.strip():
        return []
    norm_query = normalize_text(exam_query)
    exams_original = df["EAP Name"].dropna().unique()
    norm_map = {normalize_text(e): e for e in exams_original}
    choices = list(norm_map.keys())
    matches = process.extract(norm_query, choices, scorer=fuzz.token_set_ratio, limit=3)
    good = [norm_map[m] for m, score, _ in matches if score > 55]
    return good

def best_site_match(site_query: str):
    """Find the most likely official site/department name(s)."""
    if not isinstance(site_query, str) or not site_query.strip():
        return []
    site_query = site_query.lower().strip()
    number_words = {
        "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th",
        "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th",
        "ninth": "9th", "tenth": "10th"
    }
    for word, num in number_words.items():
        site_query = re.sub(rf"\b{word}\b", num, site_query)
    sites_original = df["DEP Name"].dropna().unique()
    norm_sites_map = {s.lower(): s for s in sites_original}
    choices = list(norm_sites_map.keys())
    matches = process.extract(site_query, choices, scorer=fuzz.token_set_ratio, limit=3)
    good = [norm_sites_map[m] for m, score, _ in matches if score > 60]
    return good