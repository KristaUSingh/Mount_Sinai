import os
import faiss
import numpy as np
import google.generativeai as genai

from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from unstructured.partition.auto import partition
from sentence_transformers import SentenceTransformer

# ------------------------------
# Sinai Nexus Scheduling Backend
# ------------------------------
from src.query_router import answer_scheduling_query


# ------------------------------
# Load ENV + Configure Gemini
# ------------------------------
load_dotenv()

if os.getenv("GOOGLE_API_KEY"):
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
else:
    genai.configure()   # uses ADC / Vertex service account


# ------------------------------
# FAISS + Embedding Model Setup
# ------------------------------
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

faiss_index = None
chunks_map = {}


# ------------------------------
# FastAPI App Init
# ------------------------------
app = FastAPI(title="Sinai Nexus Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # ⭐ Vercel frontend allowed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------
# Models
# ------------------------------
class AgentChatRequest(BaseModel):
    question: str


# ===============================================================
# 1️⃣ Scheduling Assistant Endpoint
# ===============================================================
@app.post("/agent-chat")
def agent_chat(payload: AgentChatRequest):
    """Deterministic scheduling Q&A"""
    try:
        answer = answer_scheduling_query(payload.question)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}


# ===============================================================
# 2️⃣ Initialize FAISS Index
# ===============================================================
@app.post("/init_index")
def init_index():
    """Creates a fresh FAISS index"""
    global faiss_index, chunks_map

    faiss_index = faiss.IndexFlatL2(384)
    chunks_map = {}

    return {"message": "FAISS index initialized."}


# ===============================================================
# 3️⃣ Upload → Parse → Chunk → Embed → Add to FAISS
# ===============================================================
@app.post("/upload")
async def upload_file(file: UploadFile):
    """Upload document and add to RAG index"""
    global faiss_index, chunks_map

    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/{file.filename}"

    # Save file
    with open(path, "wb") as f:
        f.write(await file.read())

    # Extract text
    elements = partition(filename=path)
    text = "\n".join([el.text for el in elements if el.text])

    # Chunking
    chunk_size = 800
    overlap = 100
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size - overlap)]

    # Embed chunks
    embeddings = embedding_model.encode(chunks)

    # Create index if needed
    if faiss_index is None:
        faiss_index = faiss.IndexFlatL2(embeddings.shape[1])

    start_index = faiss_index.ntotal
    faiss_index.add(np.array(embeddings))

    # Store mapping
    for i, chunk in enumerate(chunks):
        chunks_map[start_index + i] = chunk

    return {
        "message": f"Indexed {len(chunks)} chunks from {file.filename}",
        "chunks_added": len(chunks)
    }


# ===============================================================
# 4️⃣ RAG Chat (FAISS + Gemini)
# ===============================================================
@app.post("/rag-chat")
async def rag_chat(query: str = Form(...)):
    global faiss_index, chunks_map

    if faiss_index is None:
        return {"error": "No documents indexed yet. Upload a file first."}

    # Embed query
    q_embed = embedding_model.encode([query])
    D, I = faiss_index.search(np.array(q_embed), k=5)

    # Gather retrieved chunks
    context = "\n\n".join([chunks_map.get(i, "") for i in I[0]])

    # Gemini Prompt
    prompt = f"""
You are a Mount Sinai Radiology assistant.
Give ALL answers in plain text. No markdown. No asterisks.

Use the provided text below when answering. 
If the document does not contain the answer, say you are unsure.

Context:
{context}

Question:
{query}
"""

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    return {"answer": response.text.strip()}


# ===============================================================
# HEALTH CHECK
# ===============================================================
@app.get("/")
def home():
    return {"message": "Sinai Nexus Backend is running!"}