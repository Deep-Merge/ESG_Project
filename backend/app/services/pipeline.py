from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Document, KnowledgeEntry, utcnow
from app.services import audit
from app.services.annotator import markup_docx
from app.services.approval import supersede_family
from app.services.extractor import extract_chunks
from app.services.parser import parse_file


def family_key_for(filename: str) -> str:
    stem = Path(filename).stem.lower()
    stem = re.sub(r"[\s_\-]*(v|ver|version)[\s_\-]*\d+$", "", stem)
    stem = re.sub(r"[\s_\-]*20\d{2}(-\d{2}-\d{2})?$", "", stem)
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-")


def checksum_of(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def process_document(db: Session, document_id: str) -> Document:
    doc = db.get(Document, document_id)
    if not doc:
        raise ValueError("Document not found")
    doc.status = "processing"
    db.commit()
    try:
        path = Path(doc.original_path)
        parsed = parse_file(path)
        doc.title = parsed.title
        doc.kind = parsed.kind
        doc.paragraph_count = len(parsed.paragraphs)
        superseded = supersede_family(db, doc.family_key, doc.id)
        chunks = extract_chunks(parsed)
        entries: list[KnowledgeEntry] = []
        for chunk in chunks:
            entry = KnowledgeEntry(
                document_id=doc.id,
                entry_type=chunk.entry_type,
                body=chunk.body,
                passage_text=chunk.passage_text,
                tags=json.dumps(chunk.tags),
                paragraph_index=chunk.paragraph_index,
                page_number=chunk.page_number,
                figure_value=chunk.figure_value,
                figure_period=chunk.figure_period,
                figure_scope=chunk.figure_scope,
                figure_methodology=chunk.figure_methodology,
                status="proposed",
                date_ingested=utcnow(),
                last_reviewed=None,
                source_document=doc.filename,
                confidence=chunk.confidence,
                extractor=chunk.extractor,
            )
            db.add(entry)
            entries.append(entry)
        db.flush()
        if parsed.kind == "docx":
            marked = settings.marked_dir / f"{doc.id}.docx"
            markup_docx(path, marked, entries)
            doc.marked_path = str(marked)
        doc.status = "ready_for_review"
        audit.record(
            db,
            "document.processed",
            document_id=doc.id,
            detail={
                "proposals": len(entries),
                "superseded": superseded,
                "kind": parsed.kind,
            },
        )
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as exc:
        db.rollback()
        doc = db.get(Document, document_id)
        if doc:
            doc.status = "failed"
            doc.error_message = str(exc)
            db.commit()
        raise
