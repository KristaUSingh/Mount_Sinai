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

# -------------------------------------------------------------
# Hard-coded abbreviation → full site mapping
# Safe for deployment (no file dependencies)
# -------------------------------------------------------------
ABBREV_TO_SITE = {
    "HESS": "1470 MADISON AVE RAD CT",
    "RA": "1176 5TH AVE RAD CT",
    "MSDUS": "10 UNION SQ E RAD CT",
    "RA MORNINGSIDE": "1090 AMST AVE RAD CT",
    "MSW": "425 W 59TH ST RAD CT",
    "JB": "787 11TH AVE RAD CT",
    "BC": "325 W 15TH ST RAD CT",
    "MSQ OP": "MSQ OP RAD",
    "BH": "300 CADMAN PLAZA RAD CT",
    "MSM": "MSM RAD CT",
    "MSB": "MSB RAD CT"
}


# Load prefix-to-department mapping
with open("data/mapping.json") as f:
    PREFIX_TO_DEP = json.load(f)

# Load user updates (if file exists)
try:
    with open("data/updates.json") as f:
        USER_UPDATES = json.load(f)
except FileNotFoundError:
    USER_UPDATES = {"disabled_exams": []}
