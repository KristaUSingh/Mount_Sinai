#exams_cleanup.py 
# file to clean up exam data from Mt. Sinai Excel files
# excel file data will be converted into a table which can be queried 
# data format may change over time, so this file may need to be updated periodically

import pandas as pd
import json 
import re

# Load the prefix mapping (room prefixes are mapped to department names/addresses)
with open("data/mapping.json") as f:
    prefix_map = json.load(f)

# Load the Excel file
df = pd.read_csv("data/scheduling.csv")
# Split multiline fields into lists
df["DEP Name"] = df["DEP Name"].str.split("\n")
df["Room Name"] = df["Room Name"].str.split("\n")

# Expand so each Department/Room pair becomes its own row
df = df.explode("DEP Name").explode("Room Name").reset_index(drop=True)

# Normalize room prefixes → department names using mapping.json
def map_room_to_dep(row):
    room = str(row["Room Name"]).strip()
    for prefix, dep in prefix_map.items():
        if room.startswith(prefix):
            return dep
    return row["DEP Name"]  # fallback

df["DEP Name"] = df.apply(map_room_to_dep, axis=1)

# Filter for Manhattan sites 
manhattan_sites = [
"10 UNION SQ E RAD CT",
"1176 5TH AVE RAD CT",
"1470 MADISON AVE RAD CT"
]

# Only include manhattan sites in the dataframe 
# df = df[df["DEP Name"].isin(manhattan_sites)]

df.to_parquet("data/scheduling_clean.parquet", index=False)