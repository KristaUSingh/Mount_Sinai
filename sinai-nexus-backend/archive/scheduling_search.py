# -------------------------------------------------------------
# scheduling_search.py
# -------------------------------------------------------------
# Purpose (in plain English):
#   This file serves as the backend "brain" for the scheduling assistant.
#   It interprets natural-language scheduling questions and answers them
#   by combining fuzzy string matching, structured data lookups, and
#   optional real-time updates.
#
# What it can answer:
#   (1) Is exam X performed at site Y?
#   (2) Which sites offer exam X?
#   (3) What exams are available at site Y?
#   (4) How long does exam X take?
#   (5) Which rooms at site Y perform exam X?
#
# How it works:
#   - Uses Gemini (via query_interpreter.py) to interpret user questions
#     and identify intent + key entities (exam, site, etc.).
#   - Uses RapidFuzz to perform fuzzy matching so that users can type
#     imperfect or partial exam/site names (e.g., "ct head without contrast").
#   - Looks up matches in a cleaned scheduling table (scheduling_clean.parquet)
#     with columns like:
#         • EAP Name → official exam/procedure name
#         • DEP Name → department/location name
#         • Room Name → room identifiers for that location
#         • Visit Type Length → duration in minutes
#   - Optionally cross-references a mapping.json file that links room
#     prefixes (e.g., "HESS") to their parent department names.
#   - Optionally checks updates.json to account for temporary exam
#     unavailability (e.g., maintenance or downtime).
#
# Dependencies (install once):
#   pip install pandas rapidfuzz pyarrow google-generativeai
#
# Core Data Files:
#   • scheduling_clean.parquet  – main scheduling dataset
#   • mapping.json              – room-prefix → department mapping
#   • updates.json (optional)   – temporary availability overrides
#
# Outputs:
#   Human-readable answers to scheduling questions, returned as text.
#   Example:
#       "✅ Yes, CT HEAD WO IV CONTRAST is performed at 1176 5TH AVE RAD CT."
# -------------------------------------------------------------

from rapidfuzz import fuzz, process  # Fuzzy matching tools
import pandas as pd                  # Table (spreadsheet-like) tools
import json, re                            # Text processing

# Load the cleaned scheduling data.
# Parquet format loads quickly and is ideal for repeated lookups.
df = pd.read_parquet("data/scheduling_clean.parquet")

# Load user updates (if the file exists)
# This allows temporary overrides (e.g., marking certain exams as unavailable) without changing the main table
try:
    with open("data/updates.json") as f:
        USER_UPDATES = json.load(f)
except FileNotFoundError:
    USER_UPDATES = {"disabled_exams": []}

# Load prefix-to-department mapping
with open("data/mapping.json") as f:
    PREFIX_TO_DEP = json.load(f)

# Common abbreviations we might want to normalize in exam names
ABBREV_MAP = {
    r"\bwo\b": "without",
    r"\bw/o\b": "without",
    r"\bw\b": "with",
    r"\biv\b": "intravenous"
}

# Words we can safely remove to simplify matching 
# I.e. in the scheduling file, the EAP 'CT HEAD WO IV CONTRAST' has the visit type name 'CT HEAD WO'
IGNORE_WORDS = [
    "intravenous",
    "iv",
    "contrast",   # optional: sometimes we just care about "without/with"
    "exam", "study"  # future-proofing
]

# -------------------------------------------------------------
# Helper functions for managing user updates (user can enable/disable specific exams at specific sites)
# -------------------------------------------------------------
def disable_exam(exam, site, reason="unspecified"):
    """Temporarily mark an exam unavailable at a site."""
    USER_UPDATES["disabled_exams"].append({
        "exam": exam,
        "site": site,
        "reason": reason,
        "timestamp": pd.Timestamp.now().isoformat()
    })
    with open("updates.json", "w") as f:
        json.dump(USER_UPDATES, f, indent=2)
    print(f"✅ Marked {exam} at {site} as unavailable ({reason}).")

def enable_exam(exam, site):
    """Re-enable a previously disabled exam at a site."""
    USER_UPDATES["disabled_exams"] = [
        e for e in USER_UPDATES["disabled_exams"]
        if not (
            e["exam"].lower() == exam.lower()
            and e["site"].lower() == site.lower()
        )
    ]
    with open("updates.json", "w") as f:
        json.dump(USER_UPDATES, f, indent=2)
    print(f"✅ Re-enabled {exam} at {site}.")

# Helper: normalize_text
def normalize_text(s: str):
    """Purpose: apply common abbreviation expansions to a string (i.e. wo → without), and simplify phrases 
    so that matching user queries to official exam names is more reliable"""
    s = s.lower()

    # Expand abbreviations safely
    for short, full in ABBREV_MAP.items():
        s = re.sub(short, full, s)

    # Remove ignorable filler words
    for w in IGNORE_WORDS:
        s = re.sub(rf"\b{w}\b", "", s)

    # Collapse multiple spaces left behind
    s = re.sub(r"\s+", " ", s).strip()
    return s

# Helper: best_exam_match
def best_exam_match(exam_query: str):
    """
    Purpose:
        Given a user-typed exam name (which might be imprecise),
        return the top likely official exam names from our table.

    How:
        - We compare the user's text to every unique "EAP Name" in the table.
        - We first normalize both the user text and each exam name
          (convert to lowercase, expand abbreviations like 'WO' → 'without',
          remove filler words like 'contrast' or 'iv', etc.)
        - We then use fuzzy matching to measure similarity between words,
          which allows us to find the right match even when the wording
          or order is slightly different.
        - We finally map back to the *original* exam names in the table
          before returning results, so that later lookups in the dataframe
          still work correctly.

    Why mapping back is important:
        After normalization, the exam names no longer look like the originals
        (e.g., "CT HEAD WO IV CONTRAST" → "ct head without").
        If we used those simplified strings directly to filter the dataframe,
        we would get no matches. Mapping back fixes that issue.

    Inputs:
        exam_query (text) — what the user typed for the exam
                            (e.g., "ct head without contrast")

    Output:
        A list of up to 3 *original* exam names (exactly as stored in the table).
        If nothing is confidently matched, returns an empty list.

    Notes:
        - You can adjust the similarity threshold (currently 55):
            • Higher threshold = stricter, may miss some looser matches.
            • Lower threshold = more forgiving, but might return irrelevant ones.
        - The fuzzy scoring algorithm (token_set_ratio) ignores word order,
          so “CT head” and “head CT” are treated as the same.
    """
    # ------------------------------------------------------------------
    # Step 1: Input validation
    # ------------------------------------------------------------------
    if not isinstance(exam_query, str) or not exam_query.strip():
        return []  # If the input is missing or not text, stop here.

    # ------------------------------------------------------------------
    # Step 2: Normalize the user’s query
    # ------------------------------------------------------------------
    norm_query = normalize_text(exam_query)

    # ------------------------------------------------------------------
    # Step 3: Prepare a mapping of normalized exam names → original names
    # ------------------------------------------------------------------
    # Each entry in your dataframe ("EAP Name") is an official exam title.
    # We will:
    #   - Normalize each one in the same way as the user query
    #   - Build a dictionary linking normalized text back to its original
    # Example:
    #   {
    #     "ct head without": "CT HEAD WO IV CONTRAST",
    #     "ct head with": "CT HEAD W IV CONTRAST",
    #     ...
    #   }
    exams_original = df["EAP Name"].dropna().unique()
    norm_map = {normalize_text(e): e for e in exams_original}

    # ------------------------------------------------------------------
    # Step 4: Perform fuzzy matching
    # ------------------------------------------------------------------
    # We compare the user’s normalized text against all normalized exam names.
    # The process.extract function returns tuples like:
    #   ("ct head without", 95, 0)
    # where the middle number (95) is the similarity score (0–100).
    choices = list(norm_map.keys())
    matches = process.extract(
        norm_query,
        choices,
        scorer=fuzz.token_set_ratio,  # tolerant to word order
        limit=3                        # only keep top 3 matches
    )

    # ------------------------------------------------------------------
    # Step 5: Filter by similarity and map back to originals
    # ------------------------------------------------------------------
    # We only keep matches above a threshold (55).
    # Then we convert each normalized match back into its original form
    # using the dictionary created earlier.
    good = [norm_map[m] for m, score, _ in matches if score > 55]

    # ------------------------------------------------------------------
    # Step 6: Debug print (optional)
    # ------------------------------------------------------------------
    # This is helpful for verifying that the system is finding
    # sensible matches before integrating into the chatbot.
    # print("Best exam matches:", good)

    # ------------------------------------------------------------------
    # Step 7: Return the results
    # ------------------------------------------------------------------
    # Each element is an exact, original "EAP Name" string from the dataframe.
    return good


# Helper: best_site_match
def best_site_match(site_query: str):
    """
    Purpose:
        Given a user-typed site/location (which might be imprecise),
        return the top likely official department (DEP Name) entries
        from our table.

    Example:
        User types: "1176 fifth avenue"
        Official entry: "1176 5TH AVE RAD CT"
        This function will still recognize them as matching.

    How:
        - Convert the user’s input and known site names to lowercase.
        - Replace number words ("first", "second", "fifth", etc.) with digits.
        - Use fuzzy string matching to find the best matches.
        - Return the *original* department names.
    """

    import re

    if not isinstance(site_query, str) or not site_query.strip():
        return []

    # ----------------------------------------------------------
    # Step 1: Normalize the user's site input
    # ----------------------------------------------------------
    site_query = site_query.lower().strip()

    # Convert written numbers to numeric ordinals (common in addresses)
    number_words = {
        "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th",
        "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th",
        "ninth": "9th", "tenth": "10th"
    }
    for word, num in number_words.items():
        site_query = re.sub(rf"\b{word}\b", num, site_query)

    # ----------------------------------------------------------
    # Step 2: Prepare normalized choices and mapping
    # ----------------------------------------------------------
    sites_original = df["DEP Name"].dropna().unique()
    norm_sites_map = {s.lower(): s for s in sites_original}

    choices = list(norm_sites_map.keys())

    # ----------------------------------------------------------
    # Step 3: Perform fuzzy matching
    # ----------------------------------------------------------
    matches = process.extract(
        site_query,
        choices,
        scorer=fuzz.token_set_ratio,
        limit=3
    )

    # Map back to original site names (keep those with a decent score)
    good = [norm_sites_map[m] for m, score, _ in matches if score > 60]

    # DEBUG print
    # print("Best site matches:", good)
    return good


# -------------------------------------------------------------
# Question 1: Is exam X done at site Y?
# -------------------------------------------------------------
# Purpose:
#   Answer a yes/no question like:
#     "Is 'CT HEAD WO IV CONTRAST' performed at '1176 5TH AVE RAD CT'?"
#
# How:
#   - First, we "guess" the official exam name(s) from the user's wording.
#   - Then, we "guess" the official site name(s) from the user's wording.
#   - If we have at least one likely exam and one likely site:
#       • We check the table for any row that has BOTH that exam and that site.
#       • If any row exists → True (yes, it’s offered there)
#       • If not → False (not found there)
#   - If we cannot guess either exam or site → False (we don't have enough info)
#
# Inputs:
#   exam_query (text), site_query (text) — what the user typed
#
# Output:
#   True  → some match exists (likely offered there)
#   False → no match found (or not enough info provided)
# -------------------------------------------------------------
def exam_at_site(exam_query, site_query):
    # Try to find likely official names for the exam and site
    exams = best_exam_match(exam_query)
    sites = best_site_match(site_query)

    # If we couldn't confidently guess either side, we can't confirm availability
    if not exams or not sites:
        return False
    
    site = sites[0]
    exam = exams[0]

    # 🧠 Check if this pair is listed as disabled
    for entry in USER_UPDATES.get("disabled_exams", []):
        if (
            entry["exam"].lower() == exam.lower()
            and entry["site"].lower() == site.lower()
        ):
            print(f"⚠️ Note: {exam} at {site} temporarily disabled ({entry['reason']})")
            return False

    # Filter the table to rows where BOTH the exam and site are among our best guesses
    subset = df[df["EAP Name"].isin(exams) & df["DEP Name"].isin(sites)]

    # If there is at least one row, then yes — that exam is offered at that site
    return not subset.empty


# -------------------------------------------------------------
# Question 2: Which sites offer exam X?
# -------------------------------------------------------------
# Purpose:
#   List all sites that perform a given exam, even if the user's exam wording
#   wasn't exact.
#
# How:
#   - Guess the official exam name(s) from the user's wording.
#   - Return all unique sites (DEP Name) where those official exam names appear.
#
# Input:
#   exam_query (text) — what the user typed for the exam
#
# Output:
#   A list of site names (strings).
#   Empty list → exam not found (or couldn't guess it confidently).
# -------------------------------------------------------------
def locations_for_exam(exam_query):
    exams = best_exam_match(exam_query)
    if not exams:
        return []

    # All rows that match any of the likely official exam names
    matches = df[df["EAP Name"].isin(exams)]

    # Return distinct site names as a simple Python list
    return matches["DEP Name"].drop_duplicates().tolist()


# -------------------------------------------------------------
# Question 3: What exams are offered at site Y?
# -------------------------------------------------------------
# Purpose: List all exams available at a given site
#
# How:
#   - Guess the official site name(s) from the user’s wording.
#   - Return all unique exam names (EAP Name) associated
#     with those matched site(s).
#
# Input:
#   site_query (text) — what the user typed for the site
#
# Output:
#   A list of exam names (strings).
#   Empty list → site not found (or couldn’t guess it confidently).

def exams_at_site(site_query: str):
    """
    Return all unique exam names available at a given site.
    Uses the fuzzy site matching function to allow
    flexible wording (e.g. '1176 fifth ave' → '1176 5TH AVE RAD CT').
    """
    sites = best_site_match(site_query)
    if not sites:
        return []
    subset = df[df["DEP Name"].isin(sites)]
    return subset["EAP Name"].drop_duplicates().tolist()

# -------------------------------------------------------------
# Helper for intent 4: exam_duration
# -------------------------------------------------------------
def exam_duration(exam_query: str):
    """
    Return the visit length (in minutes) for a given exam.

    Example:
        User: "How long is a CT Head WO IV Contrast?"
        Output: 20 minutes

    Uses fuzzy matching so partial or imprecise names still work.
    """
    exams = best_exam_match(exam_query)
    if not exams:
        return None

    # Get all unique durations (in case of duplicates)
    durations = (
        df[df["EAP Name"].isin(exams)]["Visit Type Length"]
        .dropna()
        .unique()
        .tolist()
    )

    if not durations:
        return None

    # Convert to integers or strings depending on dataset
    return ", ".join(str(d) for d in durations)

# -------------------------------------------------------------
# Helper for intent 5: rooms_for_exam_at_site
# -------------------------------------------------------------
def rooms_for_exam_at_site(exam_query: str, site_query: str):
    """
    Return all room names at a given site that perform a specific exam.

    Logic:
      1. Find all rooms that perform the given exam.
      2. Use the mapping (room prefix → department) to determine
         which of those rooms belong to the given site.
      3. Return only the rooms whose prefix corresponds to that site.

    Example:
        User: "Which rooms at 1470 Madison Ave perform CT Head?"
        → ['HESS CT ROOM 6', 'HESS CT ROOM 7']
    """

    # Step 1. Use fuzzy matching to identify the official exam name and site
    exams = best_exam_match(exam_query)
    sites = best_site_match(site_query)
    if not exams or not sites:
        return []

    site = sites[0]  # take the best-matched site
    matched_prefixes = [p for p, dep in PREFIX_TO_DEP.items() if dep == site]

    if not matched_prefixes:
        return []

    # Step 2. Get all room names associated with the given exam
    subset = df[df["EAP Name"].isin(exams)]
    all_rooms = subset["Room Name"].dropna().unique().tolist()

    # Step 3. Filter those rooms whose prefix matches the site's prefix
    rooms_at_site = [
        room for room in all_rooms
        if any(room.startswith(prefix) for prefix in matched_prefixes)
    ]

    return sorted(rooms_at_site)

# -------------------------------------------------------------
# Unified scheduling query handler
# -------------------------------------------------------------
# This function connects the Gemini intent interpreter with your
# fuzzy-matching table lookups. It allows you to type any natural
# question and get a correct response without needing a web UI.
# -------------------------------------------------------------

from src.query_interpreter import interpret_scheduling_query

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

# -------------------------------------------------------------
# Examples (for quick, local testing)
# -------------------------------------------------------------
# This block runs ONLY if you run this file directly:
#   python scheduling_search.py
# It does NOT run when you import these functions into another file (like your chatbot).
# -------------------------------------------------------------
if __name__ == "__main__":
    examples = [
        "Return all the rooms at 1470 Madison Ave which perform ct head acute stroke",
        "Is ct head without contrast at 1176 fifth ave?",
        "Which locations do ct head without contrast?",
        "Which locations do ct chest with contrast?",
        "Which locations do ct abscess drainage?",
        # "What exams are done at 10 union square east rad ct?",  # IGNORE --- Just for testing --- extremely lengthy output
        "How long is a CT Head without contrast?",
        "Which rooms at 1470 Madison Ave perform CT Head without contrast?"
    ]
    
    for q in examples:
        print(f"Q: {q}")
        print("A:", answer_scheduling_query(q))
        print()
