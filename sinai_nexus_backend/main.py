# Full Supabase RAG backend replacing FAISS
# Priority ranking included (Option A) + delete endpoint + JSON note handling
# UPDATED: Uses Hugging Face Inference API for embeddings (no local SentenceTransformer)

import os
import json
import numpy as np
import requests
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
import pdfplumber
from pathlib import Path


# ------------------------------
# FastAPI App FIRST
# ------------------------------
app = FastAPI(title="Sinai Nexus Backend (Supabase RAG)")

ALLOWED_ORIGINS = [
    "https://sinainexus.vercel.app",
    "https://www.sinainexus.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

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




def extract_text_from_file(local_path: str, filename: str, content_type: str | None = None) -> str:
    ext = Path(filename).suffix.lower()

    # ✅ PDFs → pdfplumber (fast, pure python, no poppler needed)
    if ext == ".pdf" or (content_type and "pdf" in content_type.lower()):
        with pdfplumber.open(local_path) as pdf:
            texts = []
            for page in pdf.pages:
                t = page.extract_text() or ""
                if t.strip():
                    texts.append(t)
        return "\n\n".join(texts).strip()

    # ✅ Everything else → unstructured
    elements = partition(filename=local_path)
    return "\n".join([el.text for el in elements if getattr(el, "text", None)]).strip()

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
        text = extract_text_from_file(local_path, file.filename, file.content_type)

        chunk_size = 600
        overlap = 80
        chunks = (
            [text[i:i + chunk_size] for i in range(0, len(text), chunk_size - overlap)]
            if text else []
        )


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
# ===============================================================
# 3️⃣ Delete File Endpoint (DELETE EMBEDDINGS + STORAGE OBJECT)
# ===============================================================
class DeleteFileRequest(BaseModel):
    file_path: str  # expected like: "other-content/Other/file.pdf"

def _parse_bucket_and_object(file_path: str):
    """
    Accepts:
      - "bucket/folder/file.ext"
    Returns:
      (bucket, "folder/file.ext")
    """
    fp = (file_path or "").strip().lstrip("/")
    if "/" not in fp:
        # fallback: treat as object inside other-content
        return "other-content", fp
    bucket, obj = fp.split("/", 1)
    return bucket, obj

def _storage_remove(bucket: str, obj_path: str):
    """
    supabase-py versions differ: from_ vs from
    """
    # Try supabase-py v2 style: supabase.storage.from_(bucket)
    try:
        return supabase.storage.from_(bucket).remove([obj_path])
    except Exception:
        # Try older style: supabase.storage.from(bucket)
        return supabase.storage.from_(bucket).remove([obj_path])

@app.post("/delete-file")
async def delete_file(request: DeleteFileRequest):
    """
    Deletes:
      1) All embeddings (rows) for file_path from Supabase `documents`
      2) The actual file from Supabase Storage bucket
    """
    file_path = (request.file_path or "").strip()
    print(f"\n🗑️ DELETE REQUEST for file_path: {file_path}")

    if not file_path:
        return {"ok": False, "error": "file_path is required"}

    bucket, obj_path = _parse_bucket_and_object(file_path)

    # 1) Delete embeddings (exact match)
    deleted_count = 0
    try:
        result = supabase.table("documents").delete().eq("file_path", file_path).execute()
        deleted_count = len(result.data) if result.data else 0
    except Exception as e:
        print("❌ documents delete error:", e)
        return {"ok": False, "error": f"documents delete error: {str(e)}"}

    # Fallback: if older rows stored without bucket prefix, delete those too
    # Example older: "Other/file.pdf" instead of "other-content/Other/file.pdf"
    if deleted_count == 0 and obj_path:
        try:
            result2 = supabase.table("documents").delete().eq("file_path", obj_path).execute()
            deleted_count += len(result2.data) if result2.data else 0
        except Exception as e:
            print("fallback documents delete error:", e)

    print(f"✅ Deleted {deleted_count} rows from documents table")

    # 2) Delete from storage bucket
    storage_deleted = False
    storage_error = None
    try:
        _storage_remove(bucket, obj_path)
        storage_deleted = True
        print(f"✅ Deleted storage object: bucket={bucket}, path={obj_path}")
    except Exception as e:
        storage_error = str(e)
        print("❌ storage remove error:", storage_error)

    return {
        "ok": True,
        "message": f"Deleted embeddings + storage for {file_path}",
        "embeddings_deleted": deleted_count,
        "storage_deleted": storage_deleted,
        "storage_error": storage_error,
        "bucket": bucket,
        "object_path": obj_path,
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



# Add this model near the top with your other models
class TriggerWorkflowRequest(BaseModel):
    file_path: str  # e.g., "Locations_Rooms/scheduling.csv"

# Add this endpoint before your health check endpoints
@app.post("/trigger_csv_processing")
async def trigger_csv_processing(request: TriggerWorkflowRequest):
    """
    Triggers GitHub Action to process CSV → Parquet conversion
    """
    try:
        GITHUB_TOKEN = os.getenv("GH_WORKFLOW_TOKEN")
        GITHUB_REPO = os.getenv("GH_REPO")  # Should be "KristalSingh/Mount_Sinai"
        
        if not GITHUB_TOKEN or not GITHUB_REPO:
            return {
                "ok": False,
                "error": "GitHub integration not configured. Missing GH_WORKFLOW_TOKEN or GH_REPO."
            }
        
        # Trigger workflow dispatch
        url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/process_scheduling_csv.yml/dispatches"
        
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        payload = {
            "ref": "main",  # Change to "master" if that's your default branch
            "inputs": {
                "file_path": request.file_path
            }
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 204:
            return {
                "ok": True,
                "message": "CSV processing workflow triggered successfully",
                "file_path": request.file_path
            }
        else:
            return {
                "ok": False,
                "error": f"GitHub API error: {response.status_code} - {response.text}"
            }
            
    except Exception as e:
        print(f"❌ Error triggering workflow: {str(e)}")
        return {"ok": False, "error": str(e)}

# ===============================================================
# 5️⃣ HEALTH CHECK
# ===============================================================
@app.get("/")
def home():
    return {"message": "Supabase RAG Backend is running!"}

@app.get("/healthz")
def health():
    return {"status": "ok"}