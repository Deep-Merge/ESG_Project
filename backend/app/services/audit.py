import json

from sqlalchemy.orm import Session

from app.models import AuditEvent, utcnow


def record(
    db: Session,
    action: str,
    *,
    actor: str = "system",
    document_id: str = "",
    entry_id: str = "",
    detail: dict | str = "",
) -> AuditEvent:
    payload = detail if isinstance(detail, str) else json.dumps(detail, default=str)
    event = AuditEvent(
        action=action,
        actor=actor,
        document_id=document_id,
        entry_id=entry_id,
        detail=payload,
        created_at=utcnow(),
    )
    db.add(event)
    return event
