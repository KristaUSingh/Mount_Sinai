**Sinai Nexus --- Radiology Scheduling & Knowledge Assistant**
============================================================

**Sinai Nexus** is an integrated platform designed to streamline Radiology scheduling, protocol management, and knowledge lookup for the Mount Sinai Health System.\
It combines a **deterministic scheduling query engine**, a **RAG-powered document assistant**, and a **modern React/MUI admin interface** into one unified toolkit for technologists, schedulers, and support staff.

At its core, Sinai Nexus cleans and normalizes the large Epic scheduling export, turning it into a structured dataset for fast, accurate lookup of exams, locations, rooms, and visit durations.\
On top of this data layer, the platform provides two fully connected interfaces:

### **1\. Radiology Scheduling Assistant (LLM-guided, deterministic results)**

Agents can ask natural-language questions such as:

-   "Where is MRI Brain performed?"

-   "Which rooms at 1176 5th Ave do CT Abdomen?"

-   "How long is a CT Chest scan?"

The system uses Gemini to detect intent and extract exam/site text, but all answers come from **exact Pandas filters and RapidFuzz matching** --- ensuring results are trustworthy, audit-friendly, and aligned with official scheduling tables.

### **2\. Radiology Document Q&A Assistant (RAG)**

The platform ingests protocol PDFs, DOCX files, Markdown, and notes into a FAISS index.\
Agents can ask:

-   "What are the contraindications for MRI abdomen?"

-   "What's the prep for renal ultrasound?"

-   "Find the document that explains contrast rules."

This enables fast retrieval of unstructured radiology guidance without manually searching multiple folders or binders.

### **3\. Radiology Admin Dashboard (File Uploads + Knowledge Management)**

Admins can upload new documents, add internal notes, manage protocol categories, and reset the FAISS index --- all through a clean, glass-styled UI.\
A built-in toggle lets admins instantly switch between managing content and testing the assistant.

**Frontend: Radiology Admin & Agent Portal (React + MUI)**
==========================================================

The frontend provides two integrated interfaces:

1.  **Radiology Admin Dashboard** Used by supervisors or knowledge-base managers to upload documents, protocols, and internal notes, and to trigger backend FAISS re-indexing.

2.  **Radiology Agent Chat Portal** Used by scheduling agents to chat with the Mount Sinai Radiology Assistant (Scheduling Engine + RAG Engine). Supports multi-chat threads, automatic summarization, structured responses, and instant switching between Scheduling Q&A and Document Q&A.

Both UIs are built with **React + Vite**, styled using **Material UI (MUI)**, and communicate directly with the FastAPI backend.

**Frontend Features**
---------------------

### ✅ **Admin Dashboard**

-   Upload protocol files (PDF, DOCX, CSV, XLSX, Markdown)

-   Save custom policy notes (stored as JSON)

-   Submit files directly to backend ingestion

-   Trigger FAISS index resets

-   View/delete uploaded files

-   Aesthetic "Apple-style" gradient toggle between Admin ↔ Chat modes

### ✅ **Radiology Agent Chat Assistant**

-   Separate chat types:

    -   **Scheduling Chat** → calls /agent-chat

    -   **Document Q&A Chat** → calls /rag-chat

-   Automatic detection and bullet-point rendering of exam lists, rooms, and sites

-   Multi-thread, persistent chat history (stored in localStorage)

-   Automatic chat title generation based on first user question

-   Smooth auto-scroll (including delay when switching from Admin → Chat to avoid race conditions)

-   Navbar hidden automatically when embedded inside Admin view

**Frontend Directory Structure**
--------------------------------

```
frontend/
├── src/
│   ├── components/
│   │   ├── AdminDashboard.jsx      # Upload UI, policy notes, file table, index reset
│   │   ├── AgentChat.jsx           # Multi-thread AI chat interface
│   │   └── Shared/                 # Reusable UI pieces
│   ├── context/
│   │   └── useAuth.jsx             # Authentication provider (Supabase or custom)
│   ├── api/
│   │   └── supabaseClient.js       # Supabase client setup
│   ├── assets/                     # Logos and images
│   ├── App.jsx
│   └── main.jsx
└── public/
```

**Tech Stack**
--------------

| Area | Library / Tool |
| --- | --- |
| Framework | React (Vite) |
| Styling | Material-UI (MUI) |
| Authentication | Supabase Auth |
| State Management | React hooks + localStorage persistence |
| Backend Communication | `fetch()` → FastAPI endpoints |
| UI Style | Glassmorphism, layered blur cards, Apple-style gradients |
| Routing | React Router |

**Running the Frontend**
------------------------

### **1\. Install dependencies**

`
cd frontend
npm install
`

### **2\. Supabase Environment Variables (if needed)**

Create .env:

`
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_KEY=your-key
`

### **3\. Start development server**

`
npm run dev
`

The app runs at:

**http://localhost:5173**

Make sure the backend FastAPI server is running at [**http://localhost:8000**](http://localhost:8000).

**Frontend Architecture**
-------------------------

### **Admin ↔ Chat Toggle**

AdminDashboard.jsx fully replaces the page content with <AgentChat hideNavbar={true} /> when toggled, preventing duplicate navbars.

### **Chat Thread Persistence**

Stored in:

`
localStorage["msAgentChats_v1"]
`

Each chat object includes:

-   id

-   mode (schedule or rag)

-   title

-   messages[]

-   timestamps

### **Auto-scroll Behavior**

Two layers:

-   Real-time autoscroll on new messages

-   Delayed scroll after mount when switching from Admin → Chat

**Endpoints Called by the Frontend**
------------------------------------

| Endpoint | Method | Used In | Purpose |
| --- | --- | --- | --- |
| `/agent-chat` | POST | AgentChat | Structured scheduling engine |
| `/rag-chat` | POST | AgentChat | RAG/FAISS document Q&A |
| `/upload` | POST | AdminDashboard | Upload files for indexing |
| `/init_index` | POST | AdminDashboard | Reset entire FAISS store |

**Adding New Frontend Features**
--------------------------------

### New chat mode

1.  Add a new mode string

2.  Add a button in sidebar

3.  Add new endpoint logic in sendToBackend()

### PDF preview

Add a modal + <iframe /> viewer or integrate PDF.js.

### Route protection

Wrap UI inside:

`
if (!auth?.isLoggedIn) return <Navigate to="/login" />;
`

**Frontend Troubleshooting**
----------------------------

-   **Double navbar showing** → Pass hideNavbar={true} when embedding Chat inside Admin

-   **Autoscroll not working on load** → Ensure setTimeout(() => scrollIntoView(), 150) exists

-   **Messages appear but no response** → Backend URLs must match current deployment (localhost vs Vercel/Railway)

-   **Uploads show but don't index** → Backend /upload must accept file type being used

**Backend: Mt. Sinai Scheduling Cleanup & Query Toolkit**
=========================================================

A small Python toolkit that cleans Mt. Sinai's Epic scheduling export and powers a question-answering assistant for technologists, schedulers, and support teams. The project turns the raw Excel/CSV feed into a normalized Parquet table and answers natural-language questions such as "Where is CT Head performed?" or "How long is a CT ABDOMEN visit?" using fuzzy matching and deterministic Pandas lookups, no RAG or embeddings required.

**Repository Layout**
---------------------

```
├── exams_cleanup.py          # Convert scheduling.csv → scheduling_clean.parquet
├── data/
│   ├── scheduling.csv
│   ├── mapping.json
│   ├── scheduling_clean.parquet
│   └── updates.json
├── src/
│   ├── data_loader.py
│   ├── fuzzy_matchers.py
│   ├── query_handlers.py
│   ├── query_interpreter.py
│   ├── query_router.py
│   └── update_helpers.py
└── archive/
```

**Data Pipeline**
-----------------

1.  Drop latest Epic export into data/scheduling.csv

2.  Run cleanup script → Produces scheduling_clean.parquet

3.  All modules query from a single shared in-memory dataset

**Query Engine**
----------------

| Component | Responsibility |
| --- | --- |
| `query_interpreter.py` | Gemini → intent extraction |
| `fuzzy_matchers.py` | RapidFuzz name resolution |
| `query_handlers.py` | Deterministic Pandas logic |
| `query_router.py` | Intent routing + natural language answers |
| `update_helpers.py` | Temporary overrides for outages |

**Backend Setup**
-----------------

`
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
`

Environment variable:

`
GOOGLE_API_KEY=your-key-here
`

**Usage**
---------

### Build the parquet dataset

`
python3 exams_cleanup.py
`

### Ask questions

`
from src.query_router import answer_scheduling_query
print(answer_scheduling_query("Where is CT CHEST performed?"))
`

### Manage outages

`
disable_exam("CT HEAD WO IV", "1176 5TH AVE", reason="Maintenance")
`

**How to run files**
--------------------

-   Navigate to repo root

-   Use python -m folder.filename

Example:

`
python -m testing.test_general
`

**Extending the Toolkit**
-------------------------

-   Add intents

-   Expand site list

-   Update mappings

-   Add logging layers

**Backend Troubleshooting**
---------------------------

-   Parquet missing → run cleanup script

-   Gemini errors → check .env

-   Bad matches → tune RapidFuzz thresholds

-   Overrides ignored → update updates.json

**Why Not RAG?**
----------------

Structured scheduling data is best queried with deterministic lookups, not embeddings. LLM is only used for **intent detection**, not dataset search.
