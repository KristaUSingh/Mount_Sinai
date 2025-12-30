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
CSV_FILE_PATH = os.getenv("CSV_FILE_PATH", "Locations_Rooms/scheduling.csv")  # Default or from env

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")

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

csv_string = response.decode("latin-1")
df = pd.read_csv(StringIO(csv_string))

print(f"✅ CSV loaded: {len(df)} rows")

# -------------------------------------------------------------
# Step 3 — Rename columns to match expected names
# -------------------------------------------------------------
df = df.rename(columns={
    "Procedure Name": "EAP Name",
    "Visit Type Name": "Visit Type Name",
    "Visit Type Length": "Visit Type Length",
    "Department Name": "DEP Name",
    "Resource Name": "Room Name"
})

# -------------------------------------------------------------
# Step 4 — Convert multi-line cells into lists
# -------------------------------------------------------------
df["DEP Name"] = df["DEP Name"].astype(str).str.split("\n")
df["Room Name"] = df["Room Name"].astype(str).str.split("\n")

# -------------------------------------------------------------
# Step 5 — Explode lists into separate rows
# -------------------------------------------------------------
df = df.explode("DEP Name").explode("Room Name").reset_index(drop=True)

# -------------------------------------------------------------
# Step 6 — Strip whitespace
# -------------------------------------------------------------
df["DEP Name"] = df["DEP Name"].str.strip()
df["Room Name"] = df["Room Name"].str.strip()

# -------------------------------------------------------------
# Step 7 — Keep only needed columns
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
# Step 8 — Save as Parquet in memory
# -------------------------------------------------------------
buffer = BytesIO()
df.to_parquet(buffer, index=False)
buffer.seek(0)

print("✅ Parquet generated in memory")

# -------------------------------------------------------------
# Step 9 — Upload Parquet to Supabase Storage
# -------------------------------------------------------------
# Extract filename and create parquet name
original_filename = file_path.split("/")[-1]
base_name = original_filename.rsplit(".", 1)[0]
parquet_filename = f"{base_name}.parquet"
parquet_path = f"Locations_Rooms/{parquet_filename}"

upload_response = supabase.storage.from_(bucket_name).upload(
    parquet_path,
    buffer.getvalue(),
    file_options={"content-type": "application/vnd.apache.parquet", "upsert": True}
)

print(f"🎉 Uploaded parquet to Supabase: {parquet_path}")
print(f"✅ Processing complete!")