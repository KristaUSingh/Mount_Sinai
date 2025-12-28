# -------------------------------------------------------------
# data_loader.py
# -------------------------------------------------------------
# Purpose:
#   Load the main scheduling dataset, room mappings, and update
#   records into memory for other modules to use.
#
#   This ensures all data sources are initialized in one place,
#   so that other modules (like query_handlers) can simply
#   import df, PREFIX_TO_DEP, and USER_UPDATES directly.
# -------------------------------------------------------------

import pandas as pd
import json
from supabase import create_client
import os
from io import BytesIO
from dotenv import load_dotenv
from data.location_prefixes import LOCATION_PREFIXES

load_dotenv()  

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

bucket = "epic-scheduling"
path = "Locations_Rooms/new_scheduling_clean.parquet"

# Download Parquet bytes
res = supabase.storage.from_(bucket).download(path)

if not res:
    raise Exception("Unable to download parquet from Supabase")

# Read Parquet directly into DataFrame: Loads the cleaned scheduling data
df = pd.read_parquet(BytesIO(res))


# Load user updates (if file exists)
try:
    with open("data/updates.json") as f:
        USER_UPDATES = json.load(f)
except FileNotFoundError:
    USER_UPDATES = {"disabled_exams": []}

# Build a mapping from location prefixes to full department names
# One location prefix may correspond to multiple department names
# This creates a mapping like:
# {
#   "1176 5TH AVE": [
#       "1176 5TH AVE RAD CT",
#       "1176 5TH AVE RAD MRI"
#   ],
#   "10 UNION SQ E": [
#       "10 UNION SQ E RAD MRI"
#   ]
# }

LOCATION_TO_DEPARTMENTS = {}

for prefix in LOCATION_PREFIXES.keys():
    deps = (
        df[df["DEP Name"].str.startswith(prefix)]["DEP Name"]
        .drop_duplicates()
        .tolist()
    )

    if not deps:
        print(f"⚠️ Warning: location prefix '{prefix}' matched no departments")

    LOCATION_TO_DEPARTMENTS[prefix] = deps

# -------------------------------------------------------------
# Room prefix → location prefix mapping
# -------------------------------------------------------------
# Example: "HESS" -> "1470 MADISON AVE", "RA" -> "1176 5TH AVE"
# We infer it from the dataset so no hardcoding is needed.

def _build_room_prefix_to_location(df: pd.DataFrame, location_prefixes: dict) -> dict:
    mapping = {}
    if "Room Name" not in df.columns or "DEP Name" not in df.columns:
        return mapping

    for loc_prefix in location_prefixes.keys():
        subset = df[df["DEP Name"].astype(str).str.startswith(loc_prefix)]
        rooms = subset["Room Name"].dropna().astype(str)

        # room prefix = first token (e.g., "HESS CT ROOM 6" -> "HESS")
        first_tokens = rooms.str.split().str[0].dropna()
        if first_tokens.empty:
            continue

        # take most common prefixes for this location
        for token in first_tokens.value_counts().head(15).index.tolist():
            mapping.setdefault(token, loc_prefix)

    return mapping

ROOM_PREFIX_TO_LOCATION = _build_room_prefix_to_location(df, LOCATION_PREFIXES)