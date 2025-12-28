# -------------------------------------------------------------
# fuzzy_matchers.py
# -------------------------------------------------------------
# Purpose:
#   Provides helper functions that help the system "guess" what
#   exam or site the user meant, even if the name isn't exact.
# -------------------------------------------------------------

from rapidfuzz import fuzz, process
import re
from src.data_loader import df, LOCATION_TO_DEPARTMENTS
from data.location_prefixes import LOCATION_PREFIXES

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
    """
    Return the single best matching *official* exam name (string), or None.

    This function takes whatever the user typed for an exam (for example:
    "ct head wo", "ct head w/o iv", etc.), cleans it up, and then uses
    fuzzy matching to find the most likely exam name from the dataframe
    column df["EAP Name"].

    If the fuzzy match score is too low, we return None instead of
    guessing something that is probably wrong.
    """

    # If exam_query is not a string, or it's empty/only spaces,
    # we don't have anything to work with → return no match.
    if not isinstance(exam_query, str) or not exam_query.strip():
        return None

    # Normalize the user's text:
    # - make lowercase
    # - expand abbreviations (wo → without, iv → intravenous, etc.)
    # - remove filler words like "exam" or "study"
    norm_query = normalize_text(exam_query)

    # Get all unique official exam names from the dataframe.
    # Example values: "CT HEAD WO IV CONTRAST", "MRI BRAIN W DIAMOX", etc.
    exams_original = df["EAP Name"].dropna().unique()

    # Build a dictionary that maps a *normalized* version of each exam
    # → back to the original official exam name.
    #
    # Example:
    #   "ct head without intravenous contrast" → "CT HEAD WO IV CONTRAST"
    #
    # This lets us do fuzzy matching on the normalized keys, but still
    # return the exact original string from the dataframe.
    norm_map = {normalize_text(e): e for e in exams_original}

    # The list of normalized exam names that we will compare against
    # the normalized user query.
    choices = list(norm_map.keys())

    # Use RapidFuzz to find the single best match.
    # - fuzz.token_set_ratio is a fuzzy string similarity measure that
    #   ignores word order and focuses on word overlap.
    # - process.extractOne returns: (matched_string, score, extra_info)
    match = process.extractOne(
        norm_query,
        choices,
        scorer=fuzz.token_set_ratio
    )

    # If no match was found at all (very unlikely, but safe to check),
    # then we return None.
    if not match:
        return None

    # Unpack the result.
    # norm_exam  → the normalized exam string that matched
    # score      → how similar it was to norm_query (0–100)
    # _          → extra info we don't need here
    norm_exam, score, _ = match

    # If the similarity score is below our chosen threshold,
    # we consider the match unreliable and return None.
    #
    # You can tune this value:
    # - higher threshold → safer but more "no match" results
    # - lower threshold  → more matches but risk of false positives
    if score < 55:
        return None

    # Convert the normalized match back to the original official
    # exam name as it appears in the dataframe and return it.
    return norm_map[norm_exam]

def best_site_match(site_query: str):
    """
    Return the best matching *official* site information based on the user's location text.

    WHAT WE WANT NOW (UPDATED REQUIREMENT):
    --------------------------------------
    We want fuzzy matching to consider BOTH:
      1) the canonical location prefixes themselves
         (example: "10 UNION SQ E", "1176 5TH AVE", "MSM")
      2) the human-friendly aliases for those prefixes
         (example: "union square", "hess", "chelsea", "morningside")

    Why this matters:
      - Users often type colloquial names like "union square", which
        do NOT resemble the canonical prefix "10 UNION SQ E" closely enough.
      - Fuzzy matching only against prefixes will miss those cases.

    How this function works now:
      1) Normalize the user's text (lowercase, handle "fifth" → "5th", etc.)
      2) Build a searchable list containing:
           - every prefix
           - every alias
         BUT each searchable string points back to ONE canonical prefix.
      3) Fuzzy-match the user's query against that searchable list.
      4) Convert the winning match into the canonical prefix.
      5) Expand the canonical prefix into official department names via LOCATION_TO_DEPARTMENTS.
      6) Return those department names as a list.

    IMPORTANT SAFETY GUARANTEE:
      - We still return ONLY official department names that exist in the dataset.
      - We never invent department strings.
      - We return a list of departments because one location can contain multiple
        departments (CT, MRI, XRAY, etc.).

    Expected behavior examples:
      - "union square"  → canonical prefix "10 UNION SQ E" → ["10 UNION SQ E RAD MRI", ...]
      - "10 union sq e" → canonical prefix "10 UNION SQ E" → ["10 UNION SQ E RAD MRI", ...]
      - "1176 fifth ave"→ canonical prefix "1176 5TH AVE"  → [CT, MRI, XRAY, ...]
      - "random words"  → None (no confident match)
    """

    # ---------------------------------------------------------
    # 0) Defensive programming: validate input
    # ---------------------------------------------------------
    # If site_query is not a string (ex: None, number, list), or is just spaces,
    # then we cannot do meaningful matching.
    if not isinstance(site_query, str) or not site_query.strip():
        return None

    # ---------------------------------------------------------
    # 1) Normalize the user's text
    # ---------------------------------------------------------
    # Convert to lowercase so capitalization differences do not matter.
    # Remove leading/trailing spaces so accidental spaces do not matter.
    q = site_query.lower().strip()

    # ---------------------------------------------------------
    # 2) Convert spelled-out ordinals into numeric ordinals
    # ---------------------------------------------------------
    # The dataset uses "5TH", but users may type "fifth".
    # This replacement increases match accuracy.
    number_words = {
        "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th",
        "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th",
        "ninth": "9th", "tenth": "10th"
    }

    for word, num in number_words.items():
        # \b means "word boundary", so we only replace the whole word:
        # - "fifth" becomes "5th"
        # - but "fifthly" would NOT be changed
        q = re.sub(rf"\b{word}\b", num, q)

    # ---------------------------------------------------------
    # 3) Collect the canonical location prefixes
    # ---------------------------------------------------------
    # LOCATION_TO_DEPARTMENTS is a dictionary built in data_loader.py:
    #   canonical_prefix (string) -> list of DEP Names (strings)
    #
    # Example:
    #   "1176 5TH AVE" -> ["1176 5TH AVE RAD CT", "1176 5TH AVE RAD MRI", ...]
    prefixes_original = list(LOCATION_TO_DEPARTMENTS.keys())

    # If this list is empty, we have no location data to match against.
    if not prefixes_original:
        return None

    # ---------------------------------------------------------
    # 4) Build ONE "search space" that includes:
    #       - prefixes
    #       - aliases
    #    and maps every searchable phrase -> a canonical prefix
    # ---------------------------------------------------------
    # We will create a dictionary:
    #
    #   searchable_string_lowercase -> canonical_prefix_original_case
    #
    # Example:
    #   "10 union sq e"   -> "10 UNION SQ E"
    #   "union square"    -> "10 UNION SQ E"
    #   "hess"            -> "1470 MADISON AVE"
    #
    # The reason we do this:
    # - RapidFuzz will return the best matching searchable string.
    # - We then look up which canonical prefix that string belongs to.
    #
    # Where do the aliases come from?
    # - OPTION A (recommended): if you have LOCATION_PREFIXES dict:
    #       LOCATION_PREFIXES = { prefix: [aliases...] }
    # - OPTION B: if you have a separate aliases dict, adapt similarly.
    #
    # This code assumes OPTION A: LOCATION_PREFIXES exists.
    # If you have not created LOCATION_PREFIXES yet, you should.
    searchable_to_prefix = {}

    # 4A) Always include the canonical prefixes themselves in the search space.
    # This ensures users can type "10 UNION SQ E" directly and still match.
    for prefix in prefixes_original:
        searchable_to_prefix[prefix.lower()] = prefix

    # 4B) Include all aliases (human-friendly names) in the search space.
    #
    # LOCATION_PREFIXES is expected to look like:
    #   {
    #     "10 UNION SQ E": ["union square", "union sq", ...],
    #     "1470 MADISON AVE": ["hess", "madison ave", ...],
    #     ...
    #   }
    #
    # Each alias maps back to the SAME canonical prefix.
    #
    # IMPORTANT: we only add aliases for prefixes that exist in LOCATION_TO_DEPARTMENTS.
    # That prevents typos or unused prefixes in the alias file from breaking matches.
    for prefix, aliases in LOCATION_PREFIXES.items():
        if prefix not in LOCATION_TO_DEPARTMENTS:
            # This means your alias file contains a prefix that doesn't exist
            # in your computed prefix->departments map.
            # We skip it to avoid returning invalid prefixes.
            continue

        # Add each alias as a searchable string that resolves to this prefix.
        for alias in aliases:
            if not isinstance(alias, str):
                continue
            alias_norm = alias.lower().strip()
            if alias_norm:
                searchable_to_prefix[alias_norm] = prefix

    # The list RapidFuzz will compare against:
    choices = list(searchable_to_prefix.keys())

    # If for some reason choices is empty, we cannot match anything.
    if not choices:
        return None

    # ---------------------------------------------------------
    # 5) Fuzzy-match the user's query against BOTH prefixes + aliases
    # ---------------------------------------------------------
    # extractOne returns:
    #   (best_matching_choice_string, similarity_score, extra_info)
    #
    # token_set_ratio:
    # - ignores word order
    # - focuses on word overlap
    # - works well for short location phrases
    match = process.extractOne(
        q,
        choices,
        scorer=fuzz.token_set_ratio
    )

    if not match:
        return None

    matched_text, score, _ = match

    # ---------------------------------------------------------
    # 6) Confidence threshold
    # ---------------------------------------------------------
    # If score is low, the match is probably unreliable.
    #
    # NOTE:
    # You may want slightly different thresholds for very short inputs
    # like "msm" or "hess". But start simple: one threshold.
    if score < 60:
        return None

    # ---------------------------------------------------------
    # 7) Convert the matched text into the canonical prefix
    # ---------------------------------------------------------
    # matched_text is something like:
    #   "union square"  OR  "10 union sq e"  OR  "1176 5th ave"
    #
    # searchable_to_prefix tells us the canonical prefix for that text:
    best_prefix = searchable_to_prefix[matched_text]

    # ---------------------------------------------------------
    # 8) Expand the canonical prefix into official DEP Names
    # ---------------------------------------------------------
    # LOCATION_TO_DEPARTMENTS[best_prefix] is the list of all official departments
    # at that location.
    deps = LOCATION_TO_DEPARTMENTS.get(best_prefix, [])

    # If this is empty, it likely means a configuration mismatch.
    if not deps:
        return None

    # Return official department names (always a list).
    return best_prefix, deps

# Old site matching function 
# def best_site_match(site_query: str):
#     """
#     Return the single best matching *official* site/department name (string), or None.

#     This function takes the user's text for a site (for example:
#     "1176 fifth ave ct", "first ave rad", etc.), normalizes it,
#     and uses fuzzy matching to find the closest match from df["DEP Name"].

#     If the score is too low, we return None instead of returning
#     a poor guess.
#     """

#     # If site_query is not a string, or it's empty/only spaces,
#     # we can't match it to anything → return None.
#     if not isinstance(site_query, str) or not site_query.strip():
#         return None

#     # Basic lowercase + trim to normalize the input.
#     q = site_query.lower().strip()

#     # Handle cases like "first avenue" vs "1st ave".
#     # We convert spelled-out ordinals to numeric versions
#     # so they match the typical format in DEP names.
#     number_words = {
#         "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th",
#         "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th",
#         "ninth": "9th", "tenth": "10th"
#     }

#     # Replace words like "first" with "1st", "second" with "2nd", etc.
#     for word, num in number_words.items():
#         # \b ensures we only match the full word (e.g. "first" but not "firstly")
#         q = re.sub(rf"\b{word}\b", num, q)

#     # Get all unique official department/site names from the dataframe.
#     # Example values: "1176 5TH AVE RAD CT", "MSH MRI", etc.
#     sites_original = df["DEP Name"].dropna().unique()

#     # Build a dictionary that maps a lowercase version of each site name
#     # → back to the original official site name.
#     #
#     # Example:
#     #   "1176 5th ave rad ct" → "1176 5TH AVE RAD CT"
#     norm_sites_map = {s.lower(): s for s in sites_original}

#     # The list of normalized site names we will compare against `q`.
#     choices = list(norm_sites_map.keys())

#     # Use RapidFuzz to find the single best match to the user’s site text.
#     match = process.extractOne(
#         q,
#         choices,
#         scorer=fuzz.token_set_ratio
#     )

#     # If there is no match at all, we return None.
#     if not match:
#         return None

#     # Unpack the result.
#     norm_site, score, _ = match

#     # Similar idea as exams: if the fuzz score is too low,
#     # we don't trust the match and return None.
#     if score < 60:
#         return None

#     # Convert the normalized matched site back into the original
#     # official site name from the dataframe and return it.
#     return norm_sites_map[norm_site]
