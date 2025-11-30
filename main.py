import os
import faiss
import numpy as np
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from unstructured.partition.auto import partition
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# ------------------------------
# Gaurav Scheduling Backend
# ------------------------------
from src.query_router import answer_scheduling_query
from pydantic import BaseModel

class AgentChatRequest(BaseModel):
    question: str

# ------------------------------
# Load ENV + Gemini Config
# ------------------------------
load_dotenv()

# If using Gemini API key:
if os.getenv("GOOGLE_API_KEY"):
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
else:
    # If using Vertex AI service account JSON:
    genai.configure()

# ------------------------------
# FAISS + Embedding Model Setup
# ------------------------------
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
faiss_index = None
chunks_map = {}

# ------------------------------
# FastAPI App Init + CORS
# ------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================================================
# 🔹 1. GAURAV SCHEDULING ENDPOINT  (AgentChat UI)
# ===============================================================
@app.post("/agent-chat")
def agent_chat(payload: AgentChatRequest):
    """Mount Sinai Scheduling Assistant"""
    try:
        answer = answer_scheduling_query(payload.question)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}


# ===============================================================
# 🔹 2. INITIALIZE FAISS INDEX
# ===============================================================
@app.post("/init_index")
def init_index():
    global faiss_index, chunks_map
    faiss_index = faiss.IndexFlatL2(384)
    chunks_map = {}
    return {"message": "FAISS index initialized."}


# ===============================================================
# 🔹 3. UPLOAD FILE → PARSE → CHUNK → EMBED → FAISS
# ===============================================================
@app.post("/upload")
async def upload_file(file: UploadFile):
    global faiss_index, chunks_map

    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/{file.filename}"

    with open(path, "wb") as f:
        f.write(await file.read())

    # Extract text
    elements = partition(filename=path)
    text = "\n".join([el.text for el in elements if el.text])

    # Chunk text
    chunk_size, overlap = 800, 100
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size - overlap)]

    # Embed chunks
    embeds = embedding_model.encode(chunks)

    # Create FAISS if needed
    if faiss_index is None:
        faiss_index = faiss.IndexFlatL2(embeds.shape[1])

    start = faiss_index.ntotal
    faiss_index.add(np.array(embeds))

    # Store chunk mapping
    for i, chunk in enumerate(chunks):
        chunks_map[start + i] = chunk

    return {"message": f"Indexed {len(chunks)} chunks from {file.filename}"}


# ===============================================================
# 🔹 4. RAG CHAT: QUERY FAISS + USE GEMINI
# ===============================================================
@app.post("/rag-chat")
async def rag_chat(query: str = Form(...)):
    global faiss_index, chunks_map

    if faiss_index is None:
        return {"error": "No data indexed yet. Upload a file first."}

    # Embed query
    q_emb = embedding_model.encode([query])
    D, I = faiss_index.search(np.array(q_emb), k=5)

    # Build context from nearest chunks
    context = "\n\n".join([chunks_map.get(i, "") for i in I[0]])

    # Gemini prompt
    prompt = f"""
You are a Mount Sinai Radiology assistant.
Give all answers in plain text with NO markdown, NO asterisks.
Use the provided context to answer the question.
If information is missing, say you are unsure instead of guessing.

Context:
{context}

Question:
{query}
"""

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    return {"answer": response.text.strip()}

