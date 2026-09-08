from __future__ import annotations

import json
import re
from pathlib import Path

from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Citation, KnowledgeEntry, Question, QuestionAnswer, Questionnaire, utcnow
from app.services import audit
from app.services.parser import parse_file
from app.services.taxonomy import load_taxonomy

STOP = {
    "the", "and", "for", "are", "you", "your", "how", "what", "does", "do",
    "please", "describe", "with", "that", "this", "from", "into", "have",
    "has", "was", "were", "not", "any", "all", "our", "its",
}

QUESTION_START = re.compile(
    r"^(q\s*\d+|please\s+|describe|what|how|when|where|why|which|who|is |are |do |does |have |explain|outline|confirm|provide)",
    re.I,
)
NUMBERED = re.compile(r"^(\d+[\.\)]\s+|q\d+[:.\)]\s*)", re.I)


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]{3,}", (text or "").lower())
    return {w for w in words if w not in STOP}


def _overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a)


def classify(text: str) -> list[str]:
    tags = load_taxonomy().get("tags") or []
    q = _tokens(text)
    scored: list[tuple[float, str]] = []
    for tag in tags:
        bag = _tokens(" ".join([tag["id"], tag["label"], " ".join(tag.get("aliases") or [])]))
        score = _overlap(q, bag) + (0.35 if tag["id"] in q or tag["label"].lower() in text.lower() else 0)
        for alias in tag.get("aliases") or []:
            if alias.lower() in text.lower():
                score += 0.45
        if score:
            scored.append((score, tag["id"]))
    scored.sort(reverse=True)
    picked = [tid for score, tid in scored if score >= 0.2][:2]
    return picked or (["governance"] if "govern" in text.lower() else [])


def extract_questions(path: Path) -> list[dict]:
    parsed = parse_file(path)
    found: list[dict] = []
    section = parsed.title
    for para in parsed.paragraphs:
        text = para.text.strip()
        if para.heading and not text.endswith("?"):
            section = text
            continue
        clean = NUMBERED.sub("", text).strip()
        looks = text.endswith("?") or bool(QUESTION_START.match(clean)) or bool(NUMBERED.match(text))
        if looks and len(clean) > 12:
            found.append({"text": clean, "section": section, "locator": para.index})
    if len(found) < 3:
        found = []
        section = parsed.title
        for para in parsed.paragraphs:
            if para.heading:
                section = para.text
                continue
            if len(para.text) > 24:
                found.append({"text": para.text.strip(), "section": section, "locator": para.index})
    return found[:60]


def _best_reuse(text: str, pairs: list[QuestionAnswer]) -> tuple[QuestionAnswer | None, float]:
    q = _tokens(text)
    best: QuestionAnswer | None = None
    best_score = 0.0
    for row in pairs:
        score = _overlap(q, _tokens(row.question))
        if text.lower().rstrip("?") in row.question.lower() or row.question.lower().rstrip("?") in text.lower():
            score = max(score, 0.92)
        if score > best_score:
            best, best_score = row, score
    if best and best_score >= 0.42:
        return best, best_score
    return None, 0.0


def _retrieve(text: str, tags: list[str], entries: list[KnowledgeEntry]) -> list[KnowledgeEntry]:
    q = _tokens(text)
    ranked: list[tuple[float, KnowledgeEntry]] = []
    for entry in entries:
        etags = json.loads(entry.tags or "[]")
        tag_hit = len(set(tags) & set(etags))
        score = tag_hit * 0.35 + _overlap(q, _tokens(entry.body + " " + entry.passage_text))
        if score >= 0.18:
            ranked.append((score, entry))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [row for _, row in ranked[:4]]


def _compose(hits: list[KnowledgeEntry]) -> str:
    parts = []
    for entry in hits[:3]:
        body = (entry.body or "").strip()
        if len(body) > 320:
            body = body[:317].rsplit(" ", 1)[0] + "…"
        parts.append(body)
    return " ".join(parts)


def refresh_status(row: Questionnaire) -> None:
    questions = row.questions or []
    if not questions:
        row.status = "processing"
        return
    open_ones = [q for q in questions if q.status in {"classified", "reused", "drafted"}]
    approved = [q for q in questions if q.status in {"approved", "amended"}]
    if open_ones:
        row.status = "in_review"
    elif approved:
        row.status = "ready_to_write" if not row.pack_path else "written_back"
    else:
        row.status = "ready_for_review"


def process_questionnaire(db: Session, questionnaire_id: str) -> None:
    row = db.get(Questionnaire, questionnaire_id)
    if not row:
        return
    row.status = "processing"
    db.commit()
    try:
        items = extract_questions(Path(row.original_path))
        if not items:
            raise ValueError("No questions could be read from this file.")
        entries = db.query(KnowledgeEntry).filter(KnowledgeEntry.status == "approved").all()
        pairs = db.query(QuestionAnswer).filter(QuestionAnswer.status == "approved").all()
        existing = db.query(Question).filter(Question.questionnaire_id == row.id).all()
        ids = [item.id for item in existing]
        if ids:
            db.query(Citation).filter(Citation.question_id.in_(ids)).delete(synchronize_session=False)
            db.query(Question).filter(Question.id.in_(ids)).delete(synchronize_session=False)
            db.flush()
        for index, item in enumerate(items, start=1):
            tags = classify(item["text"])
            reused, reuse_score = _best_reuse(item["text"], pairs)
            hits = [] if reused else _retrieve(item["text"], tags, entries)
            question = Question(
                questionnaire_id=row.id,
                index=index,
                section=item["section"],
                text=item["text"],
                locator=item["locator"],
                tags=json.dumps(tags),
            )
            if reused:
                question.origin = "reuse"
                question.status = "reused"
                question.draft_body = reused.answer
                question.reused_qa_id = reused.id
                question.confidence = "high" if reuse_score >= 0.7 else "medium"
                question.gap_reason = ""
                db.add(question)
                db.flush()
                db.add(Citation(
                    question_id=question.id,
                    source_type="qa",
                    source_id=reused.id,
                    excerpt=reused.answer[:280],
                    title=reused.source_document or "Approved Q&A",
                    pinned_by="system",
                ))
                audit.record(db, "answer.reused", document_id=row.id, entry_id=question.id, detail={"q": index})
            elif hits:
                question.origin = "kb"
                question.status = "drafted"
                question.draft_body = _compose(hits)
                question.confidence = "high" if len(hits) >= 3 else "medium" if len(hits) == 2 else "low"
                question.gap_reason = ""
                db.add(question)
                db.flush()
                for entry in hits:
                    db.add(Citation(
                        question_id=question.id,
                        source_type="kb",
                        source_id=entry.id,
                        excerpt=(entry.passage_text or entry.body)[:280],
                        title=entry.source_document or "Approved knowledge",
                        pinned_by="system",
                    ))
                audit.record(db, "answer.drafted", document_id=row.id, entry_id=question.id, detail={"q": index, "cites": len(hits)})
            else:
                question.origin = "gap"
                question.status = "gap"
                question.draft_body = ""
                question.confidence = "none"
                question.gap_reason = "no_source"
                db.add(question)
                db.flush()
                audit.record(db, "answer.gap", document_id=row.id, entry_id=question.id, detail={"q": index, "reason": "no_source"})
        row.error_message = ""
        db.flush()
        row = db.query(Questionnaire).options(joinedload(Questionnaire.questions)).filter(Questionnaire.id == questionnaire_id).first()
        if row:
            refresh_status(row)
        audit.record(db, "questionnaire.processed", document_id=questionnaire_id, detail={"questions": len(items)})
        db.commit()
    except Exception as exc:
        db.rollback()
        failed = db.get(Questionnaire, questionnaire_id)
        if failed:
            failed.status = "failed"
            failed.error_message = str(exc)
            db.commit()


def apply_question_decision(
    db: Session,
    question: Question,
    action: str,
    reviewer: str,
    body: str | None = None,
    tags: list[str] | None = None,
) -> Question:
    reviewer = reviewer or settings.default_reviewer
    if tags is not None:
        question.tags = json.dumps(tags)
    if action == "approve":
        if not question.citations:
            raise ValueError("An answer needs at least one approved citation.")
        question.status = "approved"
        question.approved_body = (body or question.draft_body or "").strip()
        if not question.approved_body:
            raise ValueError("Approve needs answer text.")
        question.approver = reviewer
        question.approved_at = utcnow()
        audit.record(db, "answer.approved", actor=reviewer, document_id=question.questionnaire_id, entry_id=question.id)
    elif action == "amend":
        if not question.citations:
            raise ValueError("An amended answer still needs a citation.")
        text = (body or "").strip()
        if not text:
            raise ValueError("Amended text is empty.")
        question.draft_body = text
        question.approved_body = text
        question.status = "amended"
        question.approver = reviewer
        question.approved_at = utcnow()
        audit.record(db, "answer.amended", actor=reviewer, document_id=question.questionnaire_id, entry_id=question.id)
    elif action == "gap":
        question.status = "gap"
        question.origin = "gap"
        question.confidence = "none"
        question.gap_reason = question.gap_reason or "no_source"
        question.approved_body = ""
        question.approver = reviewer
        question.approved_at = None
        audit.record(db, "answer.gap", actor=reviewer, document_id=question.questionnaire_id, entry_id=question.id)
    elif action == "reject":
        question.status = "rejected"
        question.approved_body = ""
        question.approver = reviewer
        question.approved_at = None
        audit.record(db, "answer.reject", actor=reviewer, document_id=question.questionnaire_id, entry_id=question.id)
    else:
        raise ValueError("Unknown action")
    question.questionnaire.last_reviewed = utcnow()
    refresh_status(question.questionnaire)
    return question
