import json

from app.models import AuditEvent, Document, KnowledgeEntry, QuestionAnswer
from app.schemas import AuditOut, DocumentOut, EntryOut, QAOut


def document_out(doc: Document) -> DocumentOut:
    entries = doc.entries or []
    counts = {s: 0 for s in ("proposed", "approved", "rejected", "superseded", "amended")}
    for entry in entries:
        counts[entry.status] = counts.get(entry.status, 0) + 1
    types = {"narrative": 0, "figure": 0, "qa": 0}
    for entry in entries:
        if entry.status != "superseded":
            types[entry.entry_type] = types.get(entry.entry_type, 0) + 1
    return DocumentOut(
        id=doc.id,
        family_key=doc.family_key,
        filename=doc.filename,
        title=doc.title,
        kind=doc.kind,
        version=doc.version,
        status=doc.status,
        error_message=doc.error_message,
        date_ingested=doc.date_ingested,
        paragraph_count=doc.paragraph_count,
        marked_available=bool(doc.marked_path),
        proposed_count=counts["proposed"],
        approved_count=counts["approved"],
        rejected_count=counts["rejected"],
        superseded_count=counts["superseded"],
        amended_count=counts["amended"],
        figure_count=types["figure"],
        narrative_count=types["narrative"],
        qa_count=types["qa"],
    )


def entry_out(entry: KnowledgeEntry) -> EntryOut:
    return EntryOut(
        id=entry.id,
        document_id=entry.document_id,
        entry_type=entry.entry_type,
        body=entry.body,
        passage_text=entry.passage_text,
        tags=json.loads(entry.tags or "[]"),
        paragraph_index=entry.paragraph_index,
        start_offset=entry.start_offset,
        end_offset=entry.end_offset,
        page_number=entry.page_number,
        comment_id=entry.comment_id,
        figure_value=entry.figure_value,
        figure_period=entry.figure_period,
        figure_scope=entry.figure_scope,
        figure_methodology=entry.figure_methodology,
        status=entry.status,
        date_ingested=entry.date_ingested,
        last_reviewed=entry.last_reviewed,
        source_document=entry.source_document,
        approver=entry.approver,
        approved_at=entry.approved_at,
        superseded_by_id=entry.superseded_by_id,
        confidence=entry.confidence,
        extractor=entry.extractor,
    )


def qa_out(row: QuestionAnswer) -> QAOut:
    return QAOut(
        id=row.id,
        question=row.question,
        answer=row.answer,
        tags=json.loads(row.tags or "[]"),
        source_document=row.source_document,
        status=row.status,
        date_ingested=row.date_ingested,
        last_reviewed=row.last_reviewed,
        imported_as_trusted=bool(row.imported_as_trusted),
    )


def audit_out(event: AuditEvent) -> AuditOut:
    return AuditOut(
        id=event.id,
        document_id=event.document_id,
        entry_id=event.entry_id,
        action=event.action,
        actor=event.actor,
        detail=event.detail,
        created_at=event.created_at,
    )
