# -------------------------------------------------------------
# exams_cleanup.py
# -------------------------------------------------------------
# file to clean up exam data from Mt. Sinai Excel files
# excel file data will be converted into a table which can be queried 
# data format may change over time, so this file may need to be updated periodically
# -------------------------------------------------------------
# Purpose:
#   Clean and normalize the NEWLY FORMATTED scheduling CSV file
#   into a flat table that your scheduling backend can query.
#
# Old columns (previous file):
#   EAP Name, Visit Type Name, Visit Type Length, DEP Name, Room Name
#
# New columns:
#   Procedure Name, Procedure Category, Visit Type Name,
#   Visit Type Length, Department Name, Resource Name
#
# Mapping:
#   EAP Name       ← Procedure Name
#   DEP Name       ← Department Name
#   Room Name      ← Resource Name
#
# Output:
#   scheduling_clean.parquet — same shape as before, so your existing
#   scheduling_search.py code works WITHOUT modification.
#
# Steps:
#   1. Read the CSV
#   2. Split multi-line Department Name and Resource Name fields
#   3. Explode into long form (1 exam × 1 site × 1 room per row)
#   4. Keep only the columns your backend needs
#   5. Save as Parquet (fast to load, reliable format)
# -------------------------------------------------------------

import pandas as pd

# -------------------------------------------------------------
# Step 1 — Load the CSV file
# -------------------------------------------------------------
df = pd.read_csv("data/scheduling.csv")   


# -------------------------------------------------------------
# Step 2 — Rename columns to match the *old expected names*
# -------------------------------------------------------------
df = df.rename(columns={
    "Procedure Name": "EAP Name",            # exam/procedure name
    "Visit Type Name": "Visit Type Name",
    "Visit Type Length": "Visit Type Length",
    "Department Name": "DEP Name",           # site/department name
    "Resource Name": "Room Name"             # room
})


# -------------------------------------------------------------
# Step 3 — Convert multi-line cells into Python lists
# -------------------------------------------------------------
# The CSV stores multiple department names in one cell separated by newlines.
# Example:
#   "1470 MADISON AVE RAD CT\n1176 5TH AVE RAD CT\nMSBI RAD CT"
#
# We split these on "\n" so each becomes a list like:
#   ["1470 MADISON AVE RAD CT", "1176 5TH AVE RAD CT", "MSBI RAD CT"]

df["DEP Name"] = df["DEP Name"].astype(str).str.split("\n")
df["Room Name"] = df["Room Name"].astype(str).str.split("\n")


# -------------------------------------------------------------
# Step 4 — Explode the lists so each row is:
#     EAP Name | Visit Length | ONE DEP Name | ONE Room Name
# -------------------------------------------------------------
df = df.explode("DEP Name").explode("Room Name").reset_index(drop=True)


# -------------------------------------------------------------
# Step 5 — Strip whitespace around department and room names
# -------------------------------------------------------------
df["DEP Name"] = df["DEP Name"].str.strip()
df["Room Name"] = df["Room Name"].str.strip()


# -------------------------------------------------------------
# Step 6 — (Optional) Filter Manhattan sites only
# -------------------------------------------------------------
manhattan_sites = [
    "10 UNION SQ E RAD CT",
    "1176 5TH AVE RAD CT",
    "1470 MADISON AVE RAD CT"
]

# df = df[df["DEP Name"].isin(manhattan_sites)]


# -------------------------------------------------------------
# Step 7 — Keep only the columns your backend uses
# -------------------------------------------------------------
df = df[[
    "EAP Name",           # exam name
    "Visit Type Name",    # (kept for future use)
    "Visit Type Length",  # duration
    "DEP Name",           # site
    "Room Name"           # room
]]


# -------------------------------------------------------------
# Step 8 — Save as Parquet (fast to load for backend)
# -------------------------------------------------------------
df.to_parquet("scheduling_clean.parquet", index=False)

print("✅ Cleaned scheduling file saved as scheduling_clean.parquet")