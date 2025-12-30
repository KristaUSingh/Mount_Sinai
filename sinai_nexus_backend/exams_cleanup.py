# -------------------------------------------------------------
# exams_cleanup.py
# -------------------------------------------------------------
from supabase import create_client
import pandas as pd
from io import StringIO, BytesIO
from dotenv import load_dotenv
import os

load_dotenv()

# -------------------------------------------------------------
# Step 1 — Load configuration
# -------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
CSV_FILE_PATH = os.getenv("CSV_FILE_PATH", "Locations_Rooms/scheduling.csv")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")

# Optional: remove the warning about trailing slash
# (won't fix your crash, but cleans logs)
if SUPABASE_URL and not SUPABASE_URL.endswith("/"):
    SUPABASE_URL = SUPABASE_URL + "/"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

bucket_name = "epic-scheduling"
file_path = CSV_FILE_PATH

print(f"📥 Downloading CSV from: {bucket_name}/{file_path}")

# -------------------------------------------------------------
# Step 2 — Download CSV from Supabase
# -------------------------------------------------------------
response = supabase.storage.from_(bucket_name).download(file_path)
if not response:
    raise Exception("Could not download file from Supabase")

# ✅ Decode in a BOM-safe way
csv_string = response.decode("utf-8-sig", errors="replace")
df = pd.read_csv(StringIO(csv_string))

print(f"✅ CSV loaded: {len(df)} rows")
print("🔎 Raw columns:", list(df.columns))

# -------------------------------------------------------------
# Step 3 — Normalize headers (extra safety)
# -------------------------------------------------------------
df.columns = [
    str(c).replace("\ufeff", "").replace("ï»¿", "").strip()
    for c in df.columns
]
print("🧼 Normalized columns:", list(df.columns))

# -------------------------------------------------------------
# Step 4 — Flexible mapping (supports old OR new format)
# -------------------------------------------------------------
def pick(existing_cols, *candidates):
    for c in candidates:
        if c in existing_cols:
            return c
    return None

cols = set(df.columns)

eap_src  = pick(cols, "EAP Name", "Procedure Name", "Procedure", "Exam Name")
dep_src  = pick(cols, "DEP Name", "Department Name", "Department", "Site Name")
room_src = pick(cols, "Room Name", "Resource Name", "Resource", "Room")
vt_src   = pick(cols, "Visit Type Name", "Visit Type", "VisitType Name")
vl_src   = pick(cols, "Visit Type Length", "Visit Length", "Duration", "VisitType Length")

missing = [("EAP", eap_src), ("DEP", dep_src), ("ROOM", room_src), ("VT", vt_src), ("VL", vl_src)]
missing = [name for name, src in missing if src is None]
if missing:
    raise Exception(f"Missing required columns: {missing}. Found columns: {list(df.columns)}")

df = df.rename(columns={
    eap_src: "EAP Name",
    dep_src: "DEP Name",
    room_src: "Room Name",
    vt_src: "Visit Type Name",
    vl_src: "Visit Type Length",
})

# -------------------------------------------------------------
# Step 5 — Convert multi-line cells into lists
# -------------------------------------------------------------
df["DEP Name"] = df["DEP Name"].astype(str).str.split("\n")
df["Room Name"] = df["Room Name"].astype(str).str.split("\n")

# -------------------------------------------------------------
# Step 6 — Explode lists into separate rows
# -------------------------------------------------------------
df = df.explode("DEP Name").explode("Room Name").reset_index(drop=True)

# -------------------------------------------------------------
# Step 7 — Strip whitespace
# -------------------------------------------------------------
df["DEP Name"] = df["DEP Name"].astype(str).str.strip()
df["Room Name"] = df["Room Name"].astype(str).str.strip()

# -------------------------------------------------------------
# Step 8 — Keep only needed columns
# -------------------------------------------------------------
df = df[[
    "EAP Name",
    "Visit Type Name",
    "Visit Type Length",
    "DEP Name",
    "Room Name"
]]

print(f"✅ Data processed: {len(df)} rows after expansion")

# -------------------------------------------------------------
# Step 9 — Save as Parquet in memory
# -------------------------------------------------------------
buffer = BytesIO()
df.to_parquet(buffer, index=False)
buffer.seek(0)
print("✅ Parquet generated in memory")

# -------------------------------------------------------------
# Step 10 — Upload Parquet to Supabase Storage
# -------------------------------------------------------------
parquet_path = "Locations_Rooms/new_scheduling_clean.parquet"

# ✅ IMPORTANT: upsert must be a STRING (headers can't be bool)
supabase.storage.from_(bucket_name).upload(
    parquet_path,
    buffer.getvalue(),
    file_options={
        "content-type": "application/vnd.apache.parquet",
        "upsert": "true",
    }
)

print(f"🎉 Uploaded parquet to Supabase: {parquet_path}")
print("✅ Processing complete!")
