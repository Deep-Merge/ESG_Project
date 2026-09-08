from __future__ import annotations

import json
from pathlib import Path

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models import AuditEvent, Citation, Document, KnowledgeEntry, Question, QuestionAnswer, Questionnaire, utcnow
from app.schemas import (
    CitationIn,
    QAIn,
    QuestionDecision,
    QuestionnaireBundle,
    ReviewBundle,
    ReviewDecision,
    StatsOut,
    TaxonomyOut,
)
from app.services import audit
from app.services.approval import apply_decision
from app.services.comment_review import parse_review_replies
from app.services.export import approved_entries, build_sharepoint_pack
from app.services.extractor import extractor_mode
from app.services.parser import parse_file
from app.services.answering import apply_question_decision, process_questionnaire
from app.services.pipeline import checksum_of, family_key_for, process_document
from app.services.writeback import build_answers_pack
from app.services.serializers import (
    audit_out,
    citation_out,
    document_out,
    entry_out,
    qa_out,
    question_out,
    questionnaire_out,
)
from app.services.taxonomy import load_taxonomy, reload as reload_taxonomy, tag_ids

router = APIRouter()


def _run_answers(questionnaire_id: str) -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        process_questionnaire(db, questionnaire_id)
    finally:
        db.close()


def _run_pipeline(document_id: str) -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        process_document(db, document_id)
    finally:
        db.close()


@router.get("/health")
def health():
    return {"ok": True, "phase": 2}


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    def count_status(status: str) -> int:
        return db.query(func.count(KnowledgeEntry.id)).filter(KnowledgeEntry.status == status).scalar() or 0

    return StatsOut(
        documents=db.query(func.count(Document.id)).scalar() or 0,
        proposed=count_status("proposed"),
        approved=count_status("approved"),
        rejected=count_status("rejected"),
        superseded=count_status("superseded"),
        qa_pairs=db.query(func.count(QuestionAnswer.id)).scalar() or 0,
        extractor_mode=extractor_mode(),
    )


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    docs = (
        db.query(Document)
        .options(joinedload(Document.entries))
        .order_by(Document.date_ingested.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)
    week_ago = now - timedelta(days=7)
    proposed = 0
    approved = 0
    approved_month = 0
    approved_week = 0
    attention = []
    continue_doc = None
    in_review_docs = 0
    processing = 0
    for doc in docs:
        row = document_out(doc)
        proposed += row.proposed_count
        approved += row.approved_count
        if row.proposed_count:
            in_review_docs += 1
            progressed = row.approved_count + row.rejected_count
            if continue_doc is None:
                continue_doc = row
            else:
                prev = continue_doc.approved_count + continue_doc.rejected_count
                if progressed > prev:
                    continue_doc = row
        if doc.status in {"failed", "processing"}:
            processing += 1
            attention.append(row)
        elif row.proposed_count:
            attention.append(row)
        for entry in doc.entries:
            if entry.status == "approved" and entry.approved_at:
                stamp = entry.approved_at
                if stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=timezone.utc)
                if stamp >= month_ago:
                    approved_month += 1
                if stamp >= week_ago:
                    approved_week += 1
    events = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(8).all()
    return {
        "reviewer": settings.default_reviewer,
        "proposed": proposed,
        "in_review_documents": in_review_docs,
        "approved": approved,
        "approved_month": approved_month,
        "approved_week": approved_week,
        "documents": len(docs),
        "processing": processing,
        "attention": processing,
        "continue_document": continue_doc,
        "attention_documents": attention[:5],
        "activity": [audit_out(e) for e in events],
        "extractor_mode": extractor_mode(),
        "in_review_questionnaires": db.query(func.count(Questionnaire.id)).filter(
            Questionnaire.status.in_(["in_review", "ready_for_review", "processing", "queued"])
        ).scalar() or 0,
        "answers_waiting": db.query(func.count(Question.id)).filter(
            Question.status.in_(["reused", "drafted", "classified"])
        ).scalar() or 0,
        "continue_questionnaire": (
            questionnaire_out(cont_q) if (cont_q := (
                db.query(Questionnaire)
                .options(joinedload(Questionnaire.questions))
                .filter(Questionnaire.status.in_(["in_review", "ready_for_review"]))
                .order_by(Questionnaire.date_ingested.desc())
                .first()
            )) else None
        ),
    }


@router.get("/taxonomy", response_model=TaxonomyOut)
def taxonomy():
    return TaxonomyOut(**load_taxonomy())


@router.post("/taxonomy/reload", response_model=TaxonomyOut)
def taxonomy_reload():
    return TaxonomyOut(**reload_taxonomy())


@router.get("/documents")
def list_documents(db: Session = Depends(get_db)):
    docs = (
        db.query(Document)
        .options(joinedload(Document.entries))
        .order_by(Document.date_ingested.desc())
        .all()
    )
    return [document_out(doc) for doc in docs]


@router.post("/documents")
def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    reviewer: str = Form(default=""),
    db: Session = Depends(get_db),
):
    name = file.filename or "upload.bin"
    suffix = Path(name).suffix.lower()
    if suffix not in {".docx", ".pdf"}:
        raise HTTPException(400, "Upload a .docx (preferred) or .pdf file.")
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    raw = file.file.read()
    family = family_key_for(name)
    version = (
        db.query(func.coalesce(func.max(Document.version), 0))
        .filter(Document.family_key == family)
        .scalar()
        or 0
    ) + 1
    stored = settings.uploads_dir / f"{family}-v{version}{suffix}"
    stored.write_bytes(raw)
    doc = Document(
        family_key=family,
        filename=name,
        title=Path(name).stem,
        kind=suffix.lstrip("."),
        version=version,
        checksum=checksum_of(stored),
        original_path=str(stored),
        status="queued",
        date_ingested=utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    audit.record(
        db,
        "document.uploaded",
        actor=reviewer or settings.default_reviewer,
        document_id=doc.id,
        detail={"filename": name, "version": version},
    )
    db.commit()
    background.add_task(_run_pipeline, doc.id)
    return document_out(doc)


@router.get("/documents/{document_id}")
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = (
        db.query(Document)
        .options(joinedload(Document.entries))
        .filter(Document.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(404, "Document not found")
    return document_out(doc)


@router.get("/documents/{document_id}/review", response_model=ReviewBundle)
def review_bundle(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    parsed = parse_file(Path(doc.original_path))
    return ReviewBundle(
        document=document_out(doc),
        paragraphs=[
            {"index": p.index, "text": p.text, "heading": p.heading} for p in parsed.paragraphs
        ],
        entries=[entry_out(e) for e in doc.entries],
    )


@router.get("/documents/{document_id}/download")
def download_marked(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc or not doc.marked_path or not Path(doc.marked_path).exists():
        raise HTTPException(404, "Marked-up Word file is not ready.")
    return FileResponse(
        doc.marked_path,
        filename=f"review-{doc.filename}",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.post("/documents/{document_id}/import-review")
def import_word_review(
    document_id: str,
    file: UploadFile = File(...),
    reviewer: str = Form(default=""),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    tmp = settings.uploads_dir / f"reviewed-{document_id}.docx"
    tmp.write_bytes(file.file.read())
    decisions = parse_review_replies(tmp)
    applied = 0
    for item in decisions:
        entry = db.get(KnowledgeEntry, item["entry_id"])
        if not entry or entry.document_id != document_id:
            continue
        apply_decision(
            db,
            entry,
            item["action"],
            reviewer=reviewer or settings.default_reviewer,
            body=item.get("body") or None,
        )
        applied += 1
    db.commit()
    return {"applied": applied, "found": len(decisions)}


@router.get("/search")
def search_knowledge(q: str = "", db: Session = Depends(get_db)):
    query = db.query(KnowledgeEntry).filter(KnowledgeEntry.status == "approved")
    needle = q.strip().lower()
    if needle:
        query = query.filter(
            or_(
                func.lower(KnowledgeEntry.body).contains(needle),
                func.lower(KnowledgeEntry.tags).contains(needle),
                func.lower(KnowledgeEntry.source_document).contains(needle),
                func.lower(KnowledgeEntry.passage_text).contains(needle),
            )
        )
    rows = query.order_by(KnowledgeEntry.approved_at.desc()).limit(40).all()
    return [entry_out(row) for row in rows]


@router.get("/entries/{entry_id}")
def get_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.get(KnowledgeEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.entry_id == entry_id)
        .order_by(AuditEvent.created_at.asc())
        .all()
    )
    return {"entry": entry_out(entry), "history": [audit_out(e) for e in events]}


@router.get("/entries")
def list_entries(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(KnowledgeEntry)
    if status:
        query = query.filter(KnowledgeEntry.status == status)
    else:
        query = query.filter(KnowledgeEntry.status == "approved")
    rows = query.order_by(KnowledgeEntry.date_ingested.desc()).all()
    return [entry_out(row) for row in rows]


@router.post("/entries/{entry_id}/review")
def review_entry(entry_id: str, payload: ReviewDecision, db: Session = Depends(get_db)):
    entry = db.get(KnowledgeEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    if payload.tags:
        unknown = [t for t in payload.tags if t not in tag_ids()]
        if unknown:
            raise HTTPException(400, f"Unknown tags: {', '.join(unknown)}")
    try:
        apply_decision(
            db,
            entry,
            payload.action,
            reviewer=payload.reviewer,
            body=payload.body,
            tags=payload.tags,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    db.commit()
    db.refresh(entry)
    return entry_out(entry)


@router.get("/qa")
def list_qa(db: Session = Depends(get_db)):
    rows = db.query(QuestionAnswer).order_by(QuestionAnswer.date_ingested.desc()).all()
    return [qa_out(row) for row in rows]


@router.post("/qa")
def import_qa(payload: QAIn, db: Session = Depends(get_db)):
    unknown = [t for t in payload.tags if t not in tag_ids()]
    if unknown:
        raise HTTPException(400, f"Unknown tags: {', '.join(unknown)}")
    row = QuestionAnswer(
        question=payload.question.strip(),
        answer=payload.answer.strip(),
        tags=json.dumps(payload.tags),
        source_document=payload.source_document,
        status="approved",
        date_ingested=utcnow(),
        last_reviewed=None,
        imported_as_trusted=1,
    )
    db.add(row)
    audit.record(db, "qa.imported", detail={"source": payload.source_document})
    db.commit()
    db.refresh(row)
    return qa_out(row)


@router.get("/audit")
def list_audit(limit: int = 80, db: Session = Depends(get_db)):
    rows = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit).all()
    return [audit_out(row) for row in rows]


@router.post("/export/sharepoint")
def export_sharepoint(db: Session = Depends(get_db)):
    path = build_sharepoint_pack(db)
    audit.record(db, "export.sharepoint", detail={"file": path.name})
    db.commit()
    return FileResponse(path, filename=path.name, media_type="application/zip")


@router.get("/export/preview")
def export_preview(db: Session = Depends(get_db)):
    rows = approved_entries(db)
    return {
        "approved_count": len(rows),
        "entries": [entry_out(row) for row in rows],
    }


def _questionnaire(db: Session, questionnaire_id: str) -> Questionnaire:
    row = (
        db.query(Questionnaire)
        .options(joinedload(Questionnaire.questions).joinedload(Question.citations))
        .filter(Questionnaire.id == questionnaire_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Questionnaire not found")
    return row


@router.get("/questionnaires")
def list_questionnaires(db: Session = Depends(get_db)):
    rows = (
        db.query(Questionnaire)
        .options(joinedload(Questionnaire.questions))
        .order_by(Questionnaire.date_ingested.desc())
        .all()
    )
    return [questionnaire_out(row) for row in rows]


@router.post("/questionnaires")
def upload_questionnaire(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    reviewer: str = Form(default=""),
    title: str = Form(default=""),
    client: str = Form(default=""),
    qtype: str = Form(default="ddq"),
    due_at: str = Form(default=""),
    notes: str = Form(default=""),
    db: Session = Depends(get_db),
):
    name = file.filename or "questionnaire.docx"
    suffix = Path(name).suffix.lower()
    if suffix not in {".docx", ".pdf"}:
        raise HTTPException(400, "Upload a .docx questionnaire (PDF later).")
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    stored = settings.uploads_dir / f"q-{utcnow().strftime('%Y%m%d%H%M%S')}{suffix}"
    stored.write_bytes(file.file.read())
    row = Questionnaire(
        filename=name,
        title=title.strip() or Path(name).stem,
        kind=suffix.lstrip("."),
        client=client.strip(),
        qtype=qtype or "ddq",
        notes=notes.strip(),
        due_at=due_at,
        original_path=str(stored),
        status="queued",
        date_ingested=utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    audit.record(
        db,
        "questionnaire.uploaded",
        actor=reviewer or settings.default_reviewer,
        document_id=row.id,
        detail={"filename": name, "client": row.client},
    )
    db.commit()
    background.add_task(_run_answers, row.id)
    return questionnaire_out(row)


@router.get("/questionnaires/{questionnaire_id}", response_model=QuestionnaireBundle)
def get_questionnaire(questionnaire_id: str, db: Session = Depends(get_db)):
    row = _questionnaire(db, questionnaire_id)
    return QuestionnaireBundle(questionnaire=questionnaire_out(row), questions=[question_out(q) for q in sorted(row.questions, key=lambda item: item.index)])


@router.post("/questionnaires/{questionnaire_id}/questions/{question_id}/review")
def review_question(
    questionnaire_id: str,
    question_id: str,
    payload: QuestionDecision,
    db: Session = Depends(get_db),
):
    question = db.get(Question, question_id)
    if not question or question.questionnaire_id != questionnaire_id:
        raise HTTPException(404, "Question not found")
    question = (
        db.query(Question)
        .options(joinedload(Question.citations), joinedload(Question.questionnaire).joinedload(Questionnaire.questions))
        .filter(Question.id == question_id)
        .first()
    )
    if payload.tags:
        unknown = [t for t in payload.tags if t not in tag_ids()]
        if unknown:
            raise HTTPException(400, f"Unknown tags: {', '.join(unknown)}")
    try:
        apply_question_decision(
            db,
            question,
            payload.action,
            reviewer=payload.reviewer or settings.default_reviewer,
            body=payload.body,
            tags=payload.tags,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    db.commit()
    db.refresh(question)
    return question_out(question)


@router.post("/questionnaires/{questionnaire_id}/questions/{question_id}/cite")
def pin_citation(
    questionnaire_id: str,
    question_id: str,
    payload: CitationIn,
    db: Session = Depends(get_db),
):
    question = db.get(Question, question_id)
    if not question or question.questionnaire_id != questionnaire_id:
        raise HTTPException(404, "Question not found")
    if payload.source_type == "kb":
        source = db.get(KnowledgeEntry, payload.source_id)
        if not source or source.status != "approved":
            raise HTTPException(400, "Only approved knowledge can be cited.")
        excerpt = payload.excerpt or source.passage_text or source.body
        title = payload.title or source.source_document
    else:
        source = db.get(QuestionAnswer, payload.source_id)
        if not source:
            raise HTTPException(400, "Q&A pair not found.")
        excerpt = payload.excerpt or source.answer
        title = payload.title or source.source_document
    row = Citation(
        question_id=question.id,
        source_type=payload.source_type,
        source_id=payload.source_id,
        excerpt=excerpt[:280],
        title=title,
        pinned_by="human",
    )
    db.add(row)
    if question.status == "gap":
        question.status = "drafted"
        question.origin = "kb"
        question.confidence = "low"
        question.gap_reason = ""
        if not question.draft_body:
            question.draft_body = excerpt[:400]
    db.commit()
    db.refresh(row)
    return citation_out(row)


@router.post("/questionnaires/{questionnaire_id}/questions/{question_id}/uncite/{citation_id}")
def unpin_citation(questionnaire_id: str, question_id: str, citation_id: str, db: Session = Depends(get_db)):
    question = db.get(Question, question_id)
    cite = db.get(Citation, citation_id)
    if not question or not cite or cite.question_id != question_id or question.questionnaire_id != questionnaire_id:
        raise HTTPException(404, "Citation not found")
    db.delete(cite)
    db.flush()
    left = db.query(func.count(Citation.id)).filter(Citation.question_id == question_id).scalar() or 0
    if left == 0 and question.status not in {"rejected"}:
        question.status = "gap"
        question.origin = "gap"
        question.confidence = "none"
        question.gap_reason = "no_source"
        question.approved_body = ""
    db.commit()
    return {"ok": True}


@router.post("/questionnaires/{questionnaire_id}/questions/{question_id}/promote")
def promote_answer(questionnaire_id: str, question_id: str, db: Session = Depends(get_db)):
    question = db.get(Question, question_id)
    if not question or question.questionnaire_id != questionnaire_id:
        raise HTTPException(404, "Question not found")
    if question.status not in {"approved", "amended"} or not question.approved_body:
        raise HTTPException(400, "Only approved answers can join the Q&A library.")
    parent = db.get(Questionnaire, questionnaire_id)
    row = QuestionAnswer(
        question=question.text,
        answer=question.approved_body,
        tags=question.tags,
        source_document=parent.title if parent else "Approved questionnaire",
        status="approved",
        date_ingested=utcnow(),
        imported_as_trusted=0,
    )
    db.add(row)
    audit.record(db, "qa.imported", document_id=questionnaire_id, entry_id=question.id, detail={"promoted": True})
    db.commit()
    db.refresh(row)
    return qa_out(row)


@router.post("/questionnaires/{questionnaire_id}/export")
def export_questionnaire(questionnaire_id: str, db: Session = Depends(get_db)):
    row = _questionnaire(db, questionnaire_id)
    path = build_answers_pack(db, row)
    db.commit()
    return FileResponse(
        path,
        filename=f"answers-{row.title or row.filename}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
