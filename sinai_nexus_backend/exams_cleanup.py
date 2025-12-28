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
from supabase import create_client
import pandas as pd
from io import StringIO, BytesIO
from dotenv import load_dotenv
import os

load_dotenv()  

# -------------------------------------------------------------
# Step 1 — Load the CSV file
# -------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

bucket_name = "epic-scheduling"      # change if your bucket name is different
file_path = "Locations_Rooms/scheduling.csv"         # path inside the bucket

response = supabase.storage.from_(bucket_name).download(file_path)


if not response:
    raise Exception("Could not download file from Supabase")

csv_string = response.decode("latin-1")   #convert bytes to text
df = pd.read_csv(StringIO(csv_string))  #read into pandas



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
    "10 UNION SQ E",    # Union Square
    "1090 AMST AVE",    # RA Morningside
    "1176 5TH AVE",     # RA Main
    "1470 MADISON AVE", # HESS
    "425 W 59TH ST",    # Mt Sinai West
    "787 11TH AVE",     # RA (787)
    "325 W 15TH ST",    # Chelsea
    "MSQ OP RAD",       # Mt Sinai Queens
    "300 CADMAN PLAZA", # Brooklyn Heights
    "MSM",              # Mount Sinai Morningside
    "MSB"              # Mount Sinai Brooklyn  # Note the trailing space. It is NOT a typo. It is needed.
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
buffer = BytesIO()
df.to_parquet(buffer, index=False)
buffer.seek(0)

print("✅ Parquet generated in memory")


# -------------------------------------------------------------
# Step 9 — Upload Parquet directly to Supabase Storage
# -------------------------------------------------------------
parquet_path = "Locations_Rooms/new_scheduling_clean.parquet"

upload_response = supabase.storage.from_(bucket_name).upload(
    parquet_path,
    buffer.getvalue(),
    file_options={"content-type": "application/vnd.apache.parquet"}
)

print("🎉 Uploaded parquet to Supabase:")
print(upload_response)