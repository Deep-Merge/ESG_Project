# Savills IM — ESG Knowledge Base (Phase 1)

Governed knowledge capture for ESG questionnaires. Specialists review and approve — the model never publishes on its own.

Phase 1 covers ingest → extract → in-document review → verified gate → SharePoint export pack. Answering questionnaires is Phase 2.

## What you can do

1. Upload an approved ESG Word file (PDF extract is supported for review in the dashboard).
2. See proposed knowledge marked on the exact passages.
3. Approve, amend, or reject each item. Nothing unverified becomes live knowledge.
4. Re-ingest a newer version of a document — older entries are **superseded**, they do not sit beside the new ones.
5. Export only approved entries as a SharePoint-ready pack (JSON + CSV + Power Automate payload).

## Layout

```
backend/          FastAPI, pipeline, Word markup, export
frontend/         Review dashboard
data/             External taxonomy file (not hardcoded)
_docs/            Briefs — gitignored
_work/            Scratch — gitignored
```

## Run locally

Backend (from `backend/`):

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. API is at `http://localhost:8000`.

Optional: set `ANTHROPIC_API_KEY` in `.env` for Claude extraction. Without it, the tool still runs using taxonomy-guided heuristics so you can walk the full review loop.

## Design rules (locked)

- Every AI-extracted item needs explicit ESG approval. No exceptions.
- Taxonomy is an external JSON file the tool reads. Change tags without touching code.
- Schema includes `date_ingested`, `status`, `source_document`. `last_reviewed` is stored and left null in Phase 1.
- Full version history and staleness alerts are out of scope, but the fields are reserved.
- Only `approved` entries are exportable / retrievable.
