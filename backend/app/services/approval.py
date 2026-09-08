from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.config import settings
from app.models import KnowledgeEntry, utcnow
from app.services import audit


LIVE_STATUSES = {"proposed", "amended", "approved"}


def apply_decision(
    db: Session,
    entry: KnowledgeEntry,
    action: str,
    *,
    reviewer: str | None = None,
    body: str | None = None,
    tags: list[str] | None = None,
) -> KnowledgeEntry:
    actor = reviewer or settings.default_reviewer
    action = action.lower().strip()
    if entry.status == "superseded":
        raise ValueError("Superseded entries cannot be reviewed.")
    if action == "approve":
        if body:
            entry.body = body
        if tags is not None:
            entry.tags = json.dumps(tags)
        entry.status = "approved"
        entry.approver = actor
        entry.approved_at = utcnow()
        entry.last_reviewed = None  # reserved; Phase 1 leaves this null
    elif action == "amend":
        if not body:
            raise ValueError("Amend needs the edited knowledge text.")
        entry.body = body
        if tags is not None:
            entry.tags = json.dumps(tags)
        entry.status = "approved"
        entry.approver = actor
        entry.approved_at = utcnow()
        entry.last_reviewed = None
    elif action == "reject":
        entry.status = "rejected"
        entry.approver = actor
        entry.approved_at = None
        entry.last_reviewed = None
    else:
        raise ValueError(f"Unknown action: {action}")

    audit.record(
        db,
        f"entry.{action}",
        actor=actor,
        document_id=entry.document_id,
        entry_id=entry.id,
        detail={"status": entry.status},
    )
    return entry


def supersede_family(db: Session, family_key: str, except_document_id: str) -> int:
    """Older entries must not silently coexist with a newer ingest."""
    from app.models import Document

    docs = db.query(Document).filter(Document.family_key == family_key).all()
    count = 0
    for doc in docs:
        if doc.id == except_document_id:
            continue
        for entry in doc.entries:
            if entry.status in LIVE_STATUSES:
                entry.status = "superseded"
                entry.superseded_by_id = except_document_id
                count += 1
                audit.record(
                    db,
                    "entry.superseded",
                    document_id=doc.id,
                    entry_id=entry.id,
                    detail={"replaced_by_document": except_document_id},
                )
        if doc.status != "superseded":
            doc.status = "superseded"
    return count
