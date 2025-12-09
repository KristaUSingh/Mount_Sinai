import os
import json
import numpy as np
import google.generativeai as genai
import pdfplumber

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from unstructured.partition.auto import partition
from uuid import uuid4
from huggingface_hub import InferenceClient            # ✅ ADDED

from supabase import create_client
from src.query_router import answer_scheduling_query


# ------------------------------
# ENV + Supabase Client
# ------------------------------
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

HF_TOKEN = os.getenv("HF_TOKEN")   # ✅ ADDED
hf_client = InferenceClient(provider="hf-inference", api_key=HF_TOKEN)  # ✅ ADDED


# ------------------------------
# Gemini Setup
# ------------------------------
if os.getenv("GOOGLE_API_KEY"):
   genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
else:
   genai.configure()


# ------------------------------
# HuggingFace Embedding Wrapper
# ------------------------------
def embed_text_list(text_list):
    """Return embeddings from HuggingFace Inference API."""
    embeddings = []
    for chunk in text_list:
        try:
            out = hf_client.feature_extraction(
                inputs=chunk,
                model="sentence-transformers/all-MiniLM-L6-v2"
            )
            embeddings.append(out)
        except Exception as e:
            print("Embedding error:", e)
            embeddings.append([0.0] * 384)  # fallback
    return embeddings


# ------------------------------
# FastAPI App
# ------------------------------
app = FastAPI(title="Sinai Nexus Backend (Supabase RAG)")
app.add_middleware(
   CORSMiddleware,
   allow_origins=["*"],
   allow_credentials=True,
   allow_methods=["*"],
   allow_headers=["*"],
)

class AgentChatRequest(BaseModel):
   question: str


# ============================================================
# 1️⃣ SCHEDULING AGENT
# ============================================================
@app.post("/agent-chat")
def agent_chat(payload: AgentChatRequest):
    """Deterministic scheduling Q&A"""
    try:
        answer = answer_scheduling_query(payload.question)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}


# ============================================================
# 2️⃣ UPLOAD → PARSE → CHUNK → EMBED → SUPABASE
# ============================================================
@app.post("/upload")
async def upload_file(
   file: UploadFile = File(...),
   priority: int = Form(3),
   path: str = Form(...)
):
    """
    Upload → Parse → Chunk → Embed → Insert into Supabase.
    """

    os.makedirs("uploads", exist_ok=True)
    local_path = f"uploads/{uuid4()}_{file.filename}"

    with open(local_path, "wb") as f:
        f.write(await file.read())

    # JSON notes
    if file.content_type == "application/json":
        priority = 1
        with open(local_path, "r") as f:
            data = json.load(f)
        text = data.get("content", "")
        chunks = [text] if text else []

    else:
        # PDF
        if file.filename.lower().endswith(".pdf"):
            elements = []
            with pdfplumber.open(local_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        elements.append(extracted)
            text = "\n".join(elements)

        else:
            elements = partition(filename=local_path, strategy="text")
            text = "\n".join([el.text for el in elements if el.text])

        chunk_size = 600
        overlap = 80
        chunks = [
            text[i : i + chunk_size]
            for i in range(0, len(text), chunk_size - overlap)
        ]

    # -------------------------------
    # ✅ USE HF INFERENCE FOR EMBEDDING
    # -------------------------------
    embeddings = embed_text_list(chunks)

    rows = []
    for chunk, emb in zip(chunks, embeddings):
        rows.append({
            "content": chunk,
            "embedding": emb,   # HF returns a usable list
            "priority": priority,
            "file_path": path
        })

    if rows:
        supabase.table("documents").insert(rows).execute()

    return {
        "message": f"Inserted {len(chunks)} chunks into Supabase",
        "chunks_added": len(chunks),
        "stored_path": path
    }


# ============================================================
# 3️⃣ DELETE FILE
# ============================================================
class DeleteRequest(BaseModel):
   file_path: str

@app.post("/delete_file")
async def delete_file(req: DeleteRequest):
    response = (
        supabase.table("documents")
        .delete()
        .eq("file_path", req.file_path)
        .execute()
    )

    return {
        "message": f"Deleted {len(response.data)} chunks",
        "file_path_received": req.file_path,
        "deleted_rows": response.data,
    }


# ============================================================
# 4️⃣ RAG CHAT
# ============================================================
@app.post("/rag-chat")
async def rag_chat(query: str = Form(...)):

    # -------------------------------
    # ✅ HF Inference embed for query
    # -------------------------------
    q_embed = embed_text_list([query])[0]

    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": q_embed,
            "match_count": 20
        }
    ).execute()

    items = result.data or []

    scored = []
    for row in items:
        dist = row.get("distance", 1.0)
        pr = row.get("priority", 3)
        score = dist * (1.0 + (pr - 1) * 0.5)
        scored.append((score, row))

    scored.sort(key=lambda x: x[0])

    notes = [row for score, row in scored if row["priority"] == 1][:3]
    docs  = [row for score, row in scored if row["priority"] > 1][:4]

    top_chunks = [r["content"] for r in notes] + [r["content"] for r in docs]
    context = "\n\n".join(top_chunks)

    if query.lower() in context.lower():
        return {"answer": context}

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


# ============================================================
# HEALTH
# ============================================================
@app.get("/")
def home():
    return {"message": "Supabase RAG Backend is running!"}

@app.get("/healthz")
def health():
    return {"status": "ok"}
