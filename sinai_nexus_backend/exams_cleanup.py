# -------------------------------------------------------------
# exams_cleanup.py
# -------------------------------------------------------------
from supabase import create_client
import pandas as pd
from io import StringIO, BytesIO
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
CSV_FILE_PATH = os.getenv("CSV_FILE_PATH", "Locations_Rooms/scheduling.csv")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

bucket_name = "epic-scheduling"
file_path = CSV_FILE_PATH

print(f"📥 Downloading CSV from: {bucket_name}/{file_path}")

# ---- Download CSV
response = supabase.storage.from_(bucket_name).download(file_path)
if not response:
    raise Exception("Could not download file from Supabase")

csv_string = response.decode("latin-1", errors="ignore")
df = pd.read_csv(StringIO(csv_string))

print(f"✅ CSV loaded: {len(df)} rows")
print("🔎 Raw columns:", list(df.columns))

# ---- Normalize column names (strip spaces + remove BOM)
df.columns = [c.replace("\ufeff", "").strip() for c in df.columns]
print("🧼 Normalized columns:", list(df.columns))

# ---- Flexible column mapping (supports old & new formats)
# Priority: if the "old" names already exist, keep them.
col_map = {}

def pick(existing, *candidates):
    for c in candidates:
        if c in existing:
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
    raise Exception(
        f"Missing required columns: {missing}. "
        f"Found columns: {list(df.columns)}"
    )

# Rename selected sources to canonical names
df = df.rename(columns={
    eap_src: "EAP Name",
    dep_src: "DEP Name",
    room_src: "Room Name",
    vt_src: "Visit Type Name",
    vl_src: "Visit Type Length",
})

# ---- Split multiline cells
df["DEP Name"] = df["DEP Name"].astype(str).str.split("\n")
df["Room Name"] = df["Room Name"].astype(str).str.split("\n")

# ---- Explode
df = df.explode("DEP Name").explode("Room Name").reset_index(drop=True)

# ---- Strip
df["DEP Name"] = df["DEP Name"].astype(str).str.strip()
df["Room Name"] = df["Room Name"].astype(str).str.strip()

# ---- Keep only needed columns
df = df[[
    "EAP Name",
    "Visit Type Name",
    "Visit Type Length",
    "DEP Name",
    "Room Name"
]]

print(f"✅ Data processed: {len(df)} rows after expansion")

# ---- Save to parquet in-memory
buffer = BytesIO()
df.to_parquet(buffer, index=False)
buffer.seek(0)

# ✅ Use canonical parquet name your app expects (recommended)
parquet_path = "Locations_Rooms/new_scheduling_clean.parquet"

supabase.storage.from_(bucket_name).upload(
    parquet_path,
    buffer.getvalue(),
    file_options={
        "content-type": "application/vnd.apache.parquet",
        "upsert": True
    }
)

print(f"🎉 Uploaded parquet to Supabase: {parquet_path}")
print("✅ Processing complete!")