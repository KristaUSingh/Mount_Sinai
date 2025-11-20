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

# Load the cleaned scheduling data
df = pd.read_parquet("data/scheduling_clean.parquet")

# Load prefix-to-department mapping
with open("data/mapping.json") as f:
    PREFIX_TO_DEP = json.load(f)

# Load user updates (if file exists)
try:
    with open("data/updates.json") as f:
        USER_UPDATES = json.load(f)
except FileNotFoundError:
    USER_UPDATES = {"disabled_exams": []}
