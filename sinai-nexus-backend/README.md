# Mt. Sinai Scheduling Cleanup & Query Toolkit

A small Python toolkit that cleans Mt. Sinai’s Epic scheduling export and powers a question-answering assistant for technologists, schedulers, and support teams. The project turns the raw Excel/CSV feed into a normalized Parquet table and answers natural-language questions such as “Where is CT Head performed?” or “How long is a CT ABDOMEN visit?” using fuzzy matching and deterministic Pandas lookups, no RAG or embeddings required.

---

## Repository Layout

```
├── exams_cleanup.py          # One-off script to convert scheduling.csv → scheduling_clean.parquet
├── data/
│   ├── scheduling.csv        # Raw Epic export (input)
│   ├── mapping.json          # Room-prefix → department mapping
│   ├── scheduling_clean.parquet
│   └── updates.json          # Optional availability overrides
├── src/
│   ├── data_loader.py        # Loads parquet + mappings once for the whole app
│   ├── fuzzy_matchers.py     # RapidFuzz helpers for exam/site name resolution
│   ├── query_handlers.py     # Business logic for each supported intent
│   ├── query_interpreter.py  # Gemini prompt that turns NL into structured intents
│   ├── query_router.py       # Entry point that ties interpreter + handlers together
│   └── update_helpers.py     # Utilities for marking exams temporarily unavailable
└── archive/                  # Legacy versions kept for reference
```

---

## Data Pipeline

1. **Drop the latest Epic export** into `data/scheduling.csv` along with the current `data/mapping.json`.
2. **Run the cleanup script** (see “Usage” below). `exams_cleanup.py` normalizes multi-line cells, maps room prefixes to official departments, filters to Manhattan sites, and writes `data/scheduling_clean.parquet` for fast reloads.
3. **Query from Parquet**. `src/data_loader.py` exposes the dataset, room map, and `updates.json` overrides so every module reads the same in-memory objects.

Because the data stays structured (columns like `EAP Name`, `DEP Name`, `Visit Type Length`, `Room Name`), business logic remains transparent and debuggable compared to embedding-based search.

---

## Query Engine

| Component | Responsibility |
| --- | --- |
| `query_interpreter.py` | Uses Gemini (via `GOOGLE_API_KEY`) to detect intent (`exam_at_site`, `locations_for_exam`, `exams_at_site`, `exam_duration`, `rooms_for_exam_at_site`) and extract raw exam/site text. |
| `fuzzy_matchers.py` | Expands abbreviations, strips filler words, and runs RapidFuzz similarity search so user phrasing (“ct head wo contrast”) maps to canonical names. |
| `query_handlers.py` | Implements deterministic Pandas lookups for each intent, honoring any temporary disables recorded in `data/updates.json`. |
| `query_router.py` | Glue function: call it with a user question, it prints Gemini’s interpretation and returns a human answer string. |
| `update_helpers.py` | Optional admin helpers to disable or re-enable specific exam/site combinations without touching the parquet. |

---

## Setup

1. **Python**: 3.10+ recommended.
2. **Install dependencies**:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Environment variables**: create a `.env` alongside the repo with your Gemini key:

   ```
   GOOGLE_API_KEY=your-key-here
   ```

4. **Data files**: ensure `data/scheduling.csv` and `data/mapping.json` exist before cleaning; `data/updates.json` will be created automatically if missing.

---

## Usage

### 1. Build / refresh the parquet dataset

```bash
python3 exams_cleanup.py
```

Outputs `data/scheduling_clean.parquet`, filtering to the Manhattan locations listed inside the script.

### 2. Ask questions programmatically

```python
from src.query_router import answer_scheduling_query

print(answer_scheduling_query("Is CT HEAD WO IV CONTRAST done at 1176 Fifth Ave?"))
print(answer_scheduling_query("Where can I schedule CT CHEST W CONTRAST?"))
print(answer_scheduling_query("How long is an MRI BRAIN WO/W IV?"))
print(answer_scheduling_query("Which rooms at 1470 Madison Ave perform CT Head?"))
```

Internally this will:
1. Use Gemini to classify the question.
2. Run RapidFuzz to map free text to official exam/site names.
3. Execute deterministic Pandas filters against `data/scheduling_clean.parquet`.
4. Apply any temporary overrides from `data/updates.json`.
5. Return a readable string (and print Gemini’s parsed intent for debugging).

### 3. Manage temporary outages (optional)

```python
from src.update_helpers import disable_exam, enable_exam

disable_exam("CT HEAD WO IV CONTRAST", "1176 5TH AVE RAD CT", reason="Scanner maintenance")
enable_exam("CT HEAD WO IV CONTRAST", "1176 5TH AVE RAD CT")
```

These helpers append/remove entries inside `data/updates.json`, ensuring downstream queries know when a modality is down.

---

## How to run files
- If you want to run any file, make sure you are in the root directory, and run 'python -m folder.filename'
- i.e. To run testing/test_general.py, navigate to root directory and run 'python -m testing.test_general'

## Extending the Toolkit

- **Add new intents**: implement the handler in `query_handlers.py`, expose it in `query_router.py`, and update the Gemini prompt in `query_interpreter.py`.
- **Expand site coverage**: adjust the `manhattan_sites` list in `exams_cleanup.py` or move it into a config file.
- **New room mappings**: update `data/mapping.json` with additional prefix → department pairs before running the cleanup script.
- **Logging / telemetry**: wrap `answer_scheduling_query` to capture user questions, parsed intents, and handler outputs.

---

## Troubleshooting

- **“Parquet not found”**: run `python3 exams_cleanup.py` to regenerate it.
- **Gemini errors**: confirm `.env` is loaded before importing `query_interpreter.py`.
- **Unexpected matches**: inspect `fuzzy_matchers.normalize_text()` and thresholds; RapidFuzz scores >55 (exams) and >60 (sites) are required to accept a match.
- **Temporary overrides ignored**: ensure `data/updates.json` is writable and that `disable_exam` entries use exact exam/site strings.

---

## Why Not RAG?

The assistant already answers questions by mapping user language to structured columns and running explicit filters, so results stay deterministic, auditable, and fast. Large Language Models only classify intent and extract entities; they do not search the dataset directly. If you later ingest narrative policies or notes, you can layer RAG on top, but for tabular scheduling data this direct approach is simpler and more trustworthy.

