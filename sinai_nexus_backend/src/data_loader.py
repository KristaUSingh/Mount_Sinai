# -------------------------------------------------------------
# data_loader.py
# -------------------------------------------------------------
# Purpose:
#   Load the main scheduling dataset, room mappings, and update
#   records into memory for other modules to use.
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
CANONICAL_PATH = "Locations_Rooms/new_scheduling_clean.parquet"
FOLDER = "Locations_Rooms"

# ✅ keep downstream logic safe no matter what
EXPECTED_COLS = ["EAP Name", "Visit Type Name", "Visit Type Length", "DEP Name", "Room Name"]

def _ensure_expected_cols(df: pd.DataFrame) -> pd.DataFrame:
    for c in EXPECTED_COLS:
        if c not in df.columns:
            df[c] = None
    return df[EXPECTED_COLS]

def _download_parquet(path: str) -> pd.DataFrame | None:
    try:
        res = supabase.storage.from_(bucket).download(path)
        if not res:
            return None
        df_local = pd.read_parquet(BytesIO(res))
        return _ensure_expected_cols(df_local)
    except Exception as e:
        print(f"⚠️ Warning: failed to load parquet {bucket}/{path}: {repr(e)}")
        return None

def _pick_latest_parquet_in_folder(folder: str) -> str | None:
    try:
        items = supabase.storage.from_(bucket).list(folder, {"limit": 200})
        if not items:
            return None

        parquets = [it for it in items if str(it.get("name", "")).lower().endswith(".parquet")]
        if not parquets:
            return None

        # Prefer updated_at if present, else fall back to name sorting
        def sort_key(it):
            # Supabase often returns ISO strings like "2025-12-28T..."
            return it.get("updated_at") or it.get("created_at") or it.get("name")

        parquets.sort(key=sort_key, reverse=True)
        return f"{folder}/{parquets[0]['name']}"
    except Exception as e:
        print(f"⚠️ Warning: failed to list folder {bucket}/{folder}: {repr(e)}")
        return None

# -------------------------------------------------------------
# Load scheduling parquet (canonical first, fallback to latest)
# -------------------------------------------------------------
df = _download_parquet(CANONICAL_PATH)

loaded_path = CANONICAL_PATH if df is not None else None

if df is None:
    latest = _pick_latest_parquet_in_folder(FOLDER)
    if latest:
        df = _download_parquet(latest)
        loaded_path = latest if df is not None else None

if df is None:
    print(f"⚠️ Warning: no scheduling parquet found in {bucket}/{FOLDER}. Using empty df.")
    df = pd.DataFrame(columns=EXPECTED_COLS)
    loaded_path = "(empty)"

print(f"✅ Scheduling df loaded from: {loaded_path} | rows={len(df)} cols={list(df.columns)}")

# -------------------------------------------------------------
# Load user updates (if file exists)
# -------------------------------------------------------------
try:
    with open("data/updates.json") as f:
        USER_UPDATES = json.load(f)
except FileNotFoundError:
    USER_UPDATES = {"disabled_exams": []}

# -------------------------------------------------------------
# Build a mapping from location prefixes to full department names
# -------------------------------------------------------------
LOCATION_TO_DEPARTMENTS = {}

for prefix in LOCATION_PREFIXES.keys():
    deps = (
        df[df["DEP Name"].astype(str).str.startswith(prefix)]["DEP Name"]
        .drop_duplicates()
        .tolist()
    )

    if not deps:
        print(f"⚠️ Warning: location prefix '{prefix}' matched no departments")

    LOCATION_TO_DEPARTMENTS[prefix] = deps

# -------------------------------------------------------------
# Room prefix → location prefix mapping
# -------------------------------------------------------------
def _build_room_prefix_to_location(df: pd.DataFrame, location_prefixes: dict) -> dict:
    mapping = {}
    if "Room Name" not in df.columns or "DEP Name" not in df.columns:
        return mapping

    for loc_prefix in location_prefixes.keys():
        subset = df[df["DEP Name"].astype(str).str.startswith(loc_prefix)]
        rooms = subset["Room Name"].dropna().astype(str)

        first_tokens = rooms.str.split().str[0].dropna()
        if first_tokens.empty:
            continue

        for token in first_tokens.value_counts().head(15).index.tolist():
            mapping.setdefault(token, loc_prefix)

    return mapping

ROOM_PREFIX_TO_LOCATION = _build_room_prefix_to_location(df, LOCATION_PREFIXES)