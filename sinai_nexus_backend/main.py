import os
import json
import uvicorn
import numpy as np
import google.generativeai as genai

from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from unstructured.partition.auto import partition
from sentence_transformers import SentenceTransformer

from supabase import create_client
from src.query_router import answer_scheduling_query


# ============================================================
# ENV + SUPABASE CLIENT
# ============================================================
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)


# ============================================================
# GEMINI CONFIG
# ============================================================
if os.getenv("GOOGLE_API_KEY"):
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
else:
    genai.configure()


# ============================================================
# LAZY-LOADED EMBEDDING MODEL
# ============================================================
embedding_model = None

def get_embedding_model():
    """Load SentenceTransformer only when first used."""
    global embedding_model
    if embedding_model is None:
        print("🔥 Loading embedding model (lazy load)...")
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return embedding_model


# ============================================================
# FASTAPI APP
# ============================================================
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
    try:
        answer = answer_scheduling_query(payload.question)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}


# ============================================================
# 2️⃣ UPLOAD → PARSE → CHUNK → EMBED → SUPABASE
# ============================================================
@app.post("/upload")
async def upload_file(file: UploadFile, priority: int = Form(3)):

    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/{file.filename}"

    # Save raw upload
    with open(path, "wb") as f:
        f.write(await file.read())

    # Parse JSON note
    if file.filename.lower().endswith(".json"):
        priority = 1  # notes always priority 1
        with open(path, "r") as f:
            data = json.load(f)
        text = data.get("content", "")
        chunks = [text] if text else []

    else:
        # Parse other docs
        elements = partition(filename=path)
        text = "\n".join([el.text for el in elements if el.text])

        chunk_size = 600
        overlap = 80
        chunks = [
            text[i:i + chunk_size]
            for i in range(0, len(text), chunk_size - overlap)
        ]

    # Lazy load embedding model
    model = get_embedding_model()
    embeddings = model.encode(chunks)

    # Insert chunks into Supabase
    rows = []
    for chunk, emb in zip(chunks, embeddings):
        rows.append({
            "content": chunk,
            "embedding": emb.tolist(),
            "priority": priority,
            "file_path": f"other-content/{file.filename}",
        })

    if rows:
        supabase.table("documents").insert(rows).execute()

    return {"message": f"Inserted {len(chunks)} chunks", "chunks_added": len(chunks)}


# ============================================================
# 3️⃣ DELETE FILE
# ============================================================
@app.post("/delete_file")
async def delete_file(file_path: str = Form(...)):
    supabase.table("documents").delete().eq("file_path", file_path).execute()
    return {"message": f"Deleted all chunks for {file_path}"}


# ============================================================
# 4️⃣ RAG CHAT
# ============================================================
@app.post("/rag-chat")
async def rag_chat(query: str = Form(...)):

    model = get_embedding_model()
    q_embed = model.encode([query]).tolist()[0]

    # Supabase vector search
    result = supabase.rpc(
        "match_documents",
        {"query_embedding": q_embed, "match_count": 20}
    ).execute()

    items = result.data or []

    # Priority re-ranking
    scored = []
    for row in items:
        dist = row.get("distance", 1.0)
        pr = row.get("priority", 3)
        score = dist * (1.0 + (pr - 1) * 0.5)
        scored.append((score, row))

    scored.sort(key=lambda x: x[0])

    notes = [row for _, row in scored if row["priority"] == 1][:3]
    docs =  [row for _, row in scored if row["priority"] > 1][:4]

    top_chunks = [row["content"] for row in notes] + \
                 [row["content"] for row in docs]

    context = "\n\n".join(top_chunks)

    # STOP-SEARCH optimization
    if query.lower() in context.lower():
        return {"answer": context}

    prompt = f"""
You are a Mount Sinai Radiology assistant.
Provide answers in plain text only.

Context:
{context}

Question:
{query}
"""

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    return {"answer": response.text.strip()}


# ============================================================
# HEALTH CHECKS
# ============================================================
@app.get("/")
def home():
    return {"message": "Supabase RAG Backend is running!"}


@app.get("/healthz")
def health():
    return {"status": "ok"}


# ============================================================
# RENDER ENTRYPOINT
# ============================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)