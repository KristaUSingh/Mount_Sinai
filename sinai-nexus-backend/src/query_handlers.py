# -------------------------------------------------------------
# query_handlers.py
# -------------------------------------------------------------
# Purpose:
#   Implement the core logic for each scheduling question type.
# -------------------------------------------------------------

from src.data_loader import df, PREFIX_TO_DEP, USER_UPDATES
from src.fuzzy_matchers import best_exam_match, best_site_match

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
    print("DEBUG – exams matched for locations_for_exam:", exams)

    if not exams:
        return []

    # Choose the best exam match (first in the list)
    exam = exams[0]

    # All rows that match any of the most likely exam name
    matches = df[df["EAP Name"] == exam]

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
# Helper for intent 6: rooms_for_exam
# -------------------------------------------------------------
def rooms_for_exam(exam_query: str):
    """
    Purpose:
        Return ALL rooms (across all sites) that perform a given exam.

    Example:
        Input:
            "ct head wo"
        Output:
            ["HESS CT ROOM 6", "RA CT ROOM 5", "MSH CT 1", ...]

    How:
        - Fuzzy match the exam name
        - Filter the dataframe to those exam(s)
        - Collect and return the unique room names
    """
    exams = best_exam_match(exam_query)
    if not exams:
        return []

    subset = df[df["EAP Name"].isin(exams)]

    # Drop duplicates, ignore missing values
    rooms = subset["Room Name"].dropna().unique().tolist()

    return sorted(rooms)