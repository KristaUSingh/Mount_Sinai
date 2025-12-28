# Full Supabase RAG backend replacing FAISS
# Priority ranking included (Option A) + delete endpoint + JSON note handling
# UPDATED: Uses Hugging Face Inference API for embeddings (no local SentenceTransformer)

import os
import json
import numpy as np
import requests
import re
import pandas as pd
from io import StringIO, BytesIO
import google.generativeai as genai
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional


from unstructured.partition.auto import partition
from supabase import create_client

# ------------------------------
# ENV + Supabase Client
# ------------------------------
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

# ------------------------------
# Sinai Nexus Scheduling Router
# ------------------------------
from src.query_router import answer_scheduling_query

# ------------------------------
# Gemini Setup
# ------------------------------
if os.getenv("GOOGLE_API_KEY"):
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
else:
    genai.configure()

# ===============================================================
# ✅ Hugging Face Inference API Embeddings (384-d vectors)
# ===============================================================
HF_TOKEN = os.getenv("HF_TOKEN")
HF_URL = os.getenv(
    "HF_FEATURE_URL",
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction",
)
EMBED_NORMALIZE = os.getenv("EMBEDDINGS_NORMALIZE", "true").lower() == "true"

_session = requests.Session()

def hf_embed(texts, normalize: bool = EMBED_NORMALIZE) -> np.ndarray:
    """
    Returns np.ndarray of shape (batch, 384)
    HF returns:
      - single vector if inputs is a string
      - list of vectors if inputs is a list of strings
    We normalize both cases into (batch, dim).
    """
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is missing in environment variables.")

    if isinstance(texts, str):
        texts = [texts]

    # Filter empty strings
    texts = [t for t in texts if isinstance(t, str) and t.strip()]
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
    }

    r = _session.post(HF_URL, headers=headers, json={"inputs": texts}, timeout=60)
    r.raise_for_status()
    data = r.json()

    # If HF returns a single vector (list of floats), wrap it into [vector]
    if isinstance(data, list) and data and isinstance(data[0], (int, float)):
        data = [data]

    vecs = np.array(data, dtype=np.float32)

    if vecs.ndim != 2:
        raise RuntimeError(f"Unexpected HF embedding shape: {vecs.shape}")

    if normalize:
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vecs = vecs / norms

    return vecs

# ------------------------------
# FastAPI App
# ------------------------------
app = FastAPI(title="Sinai Nexus Backend (Supabase RAG)")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExamsCleanupRequest(BaseModel):
    file_path: str  # "epic-scheduling/Locations_Rooms/<file>.csv"

def sanitize_base(name: str) -> str:
    name = os.path.splitext(os.path.basename(name))[0]
    name = re.sub(r"[^a-zA-Z0-9-_]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name or "locations_rooms"

def _simplify_col(s: str) -> str:
    # normalize: lowercase, remove non-alphanum
    return re.sub(r"[^a-z0-9]+", "", (s or "").strip().lower())

def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    lookup = {_simplify_col(c): c for c in df.columns}
    for cand in candidates:
        key = _simplify_col(cand)
        if key in lookup:
            return lookup[key]
    return None

@app.post("/exams_cleanup")
def exams_cleanup(req: ExamsCleanupRequest):
    fp = (req.file_path or "").strip()
    if "/" not in fp:
        return {"ok": False, "error": "file_path must be like 'bucket/path/file.csv'"}

    bucket, rel_path = fp.split("/", 1)

    # download CSV bytes
    csv_bytes = supabase.storage.from_(bucket).download(rel_path)
    if not csv_bytes:
        return {"ok": False, "error": f"Unable to download {fp}"}

    # read CSV
    df = pd.read_csv(StringIO(csv_bytes.decode("latin-1")))
    df.columns = [c.strip() for c in df.columns]  # trim header whitespace

    # ✅ Support BOTH old and new headers (and minor variants)
    eap_src = _find_col(df, ["EAP Name", "Procedure Name"])
    dep_src = _find_col(df, ["DEP Name", "Department Name"])
    room_src = _find_col(df, ["Room Name", "Resource Name"])
    visit_name_src = _find_col(df, ["Visit Type Name"])
    visit_len_src = _find_col(df, ["Visit Type Length"])

    missing = []
    if not eap_src: missing.append("EAP Name / Procedure Name")
    if not dep_src: missing.append("DEP Name / Department Name")
    if not room_src: missing.append("Room Name / Resource Name")
    if not visit_name_src: missing.append("Visit Type Name")
    if not visit_len_src: missing.append("Visit Type Length")

    if missing:
        return {
            "ok": False,
            "error": "CSV columns did not match expected format.",
            "missing": missing,
            "found_columns": df.columns.tolist(),
        }

    # rename to canonical columns your backend expects
    df = df.rename(columns={
        eap_src: "EAP Name",
        visit_name_src: "Visit Type Name",
        visit_len_src: "Visit Type Length",
        dep_src: "DEP Name",
        room_src: "Room Name",
    })

    # explode multiline fields
    df["DEP Name"] = df["DEP Name"].fillna("").astype(str).str.split("\n")
    df["Room Name"] = df["Room Name"].fillna("").astype(str).str.split("\n")
    df = df.explode("DEP Name").explode("Room Name").reset_index(drop=True)

    # strip whitespace
    df["DEP Name"] = df["DEP Name"].astype(str).str.strip()
    df["Room Name"] = df["Room Name"].astype(str).str.strip()

    # keep only expected cols
    df = df[["EAP Name", "Visit Type Name", "Visit Type Length", "DEP Name", "Room Name"]]

    # parquet bytes
    buf = BytesIO()
    df.to_parquet(buf, index=False)
    buf.seek(0)

    base = sanitize_base(rel_path)

    # ✅ upload parquet named after the CSV
    parquet_rel = f"Locations_Rooms/{base}.parquet"
    supabase.storage.from_(bucket).upload(
        parquet_rel,
        buf.getvalue(),
        file_options={
            "content-type": "application/vnd.apache.parquet",
            "x-upsert": "true",   # ✅ IMPORTANT: correct header for Supabase Storage
        },
    )

    # ✅ overwrite canonical parquet your backend reads
    canonical_rel = "Locations_Rooms/new_scheduling_clean.parquet"
    supabase.storage.from_(bucket).upload(
        canonical_rel,
        buf.getvalue(),
        file_options={
            "content-type": "application/vnd.apache.parquet",
            "x-upsert": "true",   # ✅ IMPORTANT: correct header for Supabase Storage
        },
    )

    # delete the original CSV
    supabase.storage.from_(bucket).remove([rel_path])

    return {
        "ok": True,
        "uploaded_parquet": f"{bucket}/{parquet_rel}",
        "updated_canonical": f"{bucket}/{canonical_rel}",
        "deleted_csv": f"{bucket}/{rel_path}",
        "rows": int(df.shape[0]),
    }


# ------------------------------
class AgentChatRequest(BaseModel):
    question: str

# ===============================================================
# 1️⃣ Scheduling Assistant
# ===============================================================
@app.post("/agent-chat")
def agent_chat(payload: AgentChatRequest):
    """Deterministic scheduling Q&A"""
    try:
        # pass supabase so location notes can be pulled from DB
        answer = answer_scheduling_query(payload.question, supabase=supabase)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

# ===============================================================
# 2️⃣ Upload → Parse → Chunk → Embed → Insert into Supabase
# ===============================================================
@app.post("/upload")
async def upload_file(
    file: UploadFile,
    priority: int = Form(3),
    path: str = Form(None),
    location: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None), 
):
    """
    Upload a document or JSON note, chunk it, embed it, store it in Supabase.
    priority = 1 (highest), 2, or 3 (lowest, default)
    JSON notes in Other_Notes folder are automatically priority 1.
    """

    os.makedirs("uploads", exist_ok=True)
    local_path = f"uploads/{file.filename}"

    # Save File
    with open(local_path, "wb") as f:
        f.write(await file.read())

    # Use the path sent from frontend if provided, otherwise use filename
    storage_path = path if path else f"other-content/{file.filename}"

    # Determine if JSON note
    is_note = file.filename.lower().endswith(".json")

    if is_note:
        # Automatic priority 1 for notes
        priority = 1
        with open(local_path, "r") as f:
            data = json.load(f)

        # Combine title and content for better semantic search
        title = data.get("title", "")
        content = data.get("content", "")

        # Format: "Title\n\nContent" so both are searchable
        text = f"{title}\n\n{content}" if title else content
        chunks = [text] if text else []
    else:
        # Use unstructured partition for PDFs, DOCX, Markdown, TXT
        elements = partition(filename=local_path)
        text = "\n".join([el.text for el in elements if el.text])

        # Chunking
        chunk_size = 600
        overlap = 80
        chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size - overlap)] if text else []

    # Embed Chunks (HF Inference API)
    embeddings = hf_embed(chunks)

    rows = []
    for chunk, emb_vector in zip(chunks, embeddings):
        row = {
            "content": chunk,
            "embedding": emb_vector.tolist(),
            "priority": priority,
            "file_path": storage_path
        }

        # Add ONLY what we need: location metadata for scheduling notes
        if location:
            row["location"] = location

        # ✅ Added: effective date range (ONLY for notes)
        if is_note:
            if start_date:
                row["start_date"] = start_date
            if end_date:
                row["end_date"] = end_date

        rows.append(row)

    if rows:
        supabase.table("documents").insert(rows).execute()

    return {
        "message": f"Inserted {len(chunks)} chunks into Supabase",
        "chunks_added": len(chunks)
    }


# ===============================================================
# 3️⃣ Delete File Endpoint
# ===============================================================
class DeleteFileRequest(BaseModel):
    file_path: str  # expects "bucket/relative/path.ext"

@app.post("/delete-file")
async def delete_file(request: DeleteFileRequest):
    """
    Deletes:
      1) all embeddings rows for this file_path from documents table
      2) the actual file in Supabase Storage (service role)
    """
    fp = (request.file_path or "").strip()
    if "/" not in fp:
        return {"ok": False, "error": "file_path must be like 'bucket/path/to/file'"}

    bucket, rel_path = fp.split("/", 1)

    # 1) delete embeddings rows (if any)
    result = supabase.table("documents").delete().eq("file_path", fp).execute()
    deleted_rows = len(result.data) if result.data else 0

    # 2) delete from storage
    storage_res = supabase.storage.from_(bucket).remove([rel_path])

    return {
        "ok": True,
        "file_path": fp,
        "deleted_rows": deleted_rows,
        "storage_delete": storage_res,
    }



# ADDED helpers for notes filtering 
def today_ny_str() -> str:
    return datetime.now(ZoneInfo("America/New_York")).date().isoformat()

def is_note_active(row: dict, today: str) -> bool:
    """
    Notes only: active if (start_date is null OR start_date <= today)
                 AND (end_date is null OR end_date >= today)
    Works with YYYY-MM-DD strings.
    """
    sd = row.get("start_date")
    ed = row.get("end_date")

    if sd and sd > today:
        return False
    if ed and ed < today:
        return False
    return True

# ===============================================================
# 4️⃣ RAG Chat (Optimized Notes + Chunks Context)
# ===============================================================
@app.post("/rag-chat")
async def rag_chat(query: str = Form(...)):
    # Embed query (HF Inference API)
    q_embed = hf_embed([query]).tolist()[0]

    # ✅ ADDED: auto-delete expired notes (opportunistic)
    today = today_ny_str()
    try:
        (
            supabase.table("documents")
            .delete()
            .eq("priority", 1)
            .ilike("file_path", "%.json")   # notes are JSON
            .lt("end_date", today)          # expired
            .execute()
        )
    except Exception as e:
        print("purge expired notes error:", e)

    # 1. Search Supabase
    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": q_embed,
            "match_count": 20  # get enough results to rank properly
        }
    ).execute()

    items = result.data or []

    # ✅ ADDED: filter OUT inactive notes (only affects priority 1)
    filtered = []
    for row in items:
        if row.get("priority") == 1:
            if not is_note_active(row, today):
                continue
        filtered.append(row)
    items = filtered

    # 2. Priority scoring (notes = priority 1 → strongest weight)
    scored = []
    for row in items:
        dist = row.get("distance", 1.0)
        pr = row.get("priority", 3)

        # Lower distance is better — priority 1 gets MUCH stronger influence
        if pr == 1:
            score = dist * 0.3  # Priority 1 notes get 70% boost
        elif pr == 2:
            score = dist * 0.7
        else:
            score = dist * 1.0

        scored.append((score, row))

    scored.sort(key=lambda x: x[0])

    # 3. Separate notes (priority 1) and docs (priority > 1)
    notes = [row for score, row in scored if row["priority"] == 1][:3]   # top 3 notes
    docs  = [row for score, row in scored if row["priority"] > 1][:4]    # top 4 doc chunks

    # 4. Combine context - STRIP TITLES from notes
    note_chunks = []
    for row in notes:
        content = row["content"]
        # If content has title format (Title\n\nContent), extract only content after first double newline
        if "\n\n" in content:
            parts = content.split("\n\n", 1)  # Split only on first occurrence
            note_chunks.append(parts[1])      # Take everything after title
        else:
            note_chunks.append(content)       # No title, use as-is

    doc_chunks = [row["content"] for row in docs]

    # Combine context
    top_chunks = note_chunks + doc_chunks
    context = "\n\n".join(top_chunks)

    # 5. STOP-SEARCH: if query text literally appears in context
    if query.lower() in context.lower():
        return {"answer": context}

    # 6. Gemini Prompt
    prompt = f"""
You are a Mount Sinai Radiology assistant.
Give ALL answers in plain text. No markdown. No asterisks.

Use the provided text below when answering.
Notes (priority 1) always override older or conflicting information from documents.
However, still include all other correct non-conflicting information from the documents.
If the document does not contain the answer, say I am unsure.

Context:
{context}

Question:
{query}
"""

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    return {"answer": response.text.strip()}

# ===============================================================
# 5️⃣ HEALTH CHECK
# ===============================================================
@app.get("/")
def home():
    return {"message": "Supabase RAG Backend is running!"}

@app.get("/healthz")
def health():
    return {"status": "ok"}