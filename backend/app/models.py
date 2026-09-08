import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    family_key: Mapped[str] = mapped_column(String(255), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(500), default="")
    kind: Mapped[str] = mapped_column(String(20))  # docx | pdf | qa_pack
    version: Mapped[int] = mapped_column(Integer, default=1)
    checksum: Mapped[str] = mapped_column(String(64), default="")
    original_path: Mapped[str] = mapped_column(String(1000))
    marked_path: Mapped[str] = mapped_column(String(1000), default="")
    status: Mapped[str] = mapped_column(String(40), default="uploaded")
    error_message: Mapped[str] = mapped_column(Text, default="")
    date_ingested: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    paragraph_count: Mapped[int] = mapped_column(Integer, default=0)

    entries: Mapped[list["KnowledgeEntry"]] = relationship(back_populates="document")


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    entry_type: Mapped[str] = mapped_column(String(20), default="narrative")
    body: Mapped[str] = mapped_column(Text)
    passage_text: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="[]")
    paragraph_index: Mapped[int] = mapped_column(Integer, default=0)
    start_offset: Mapped[int] = mapped_column(Integer, default=0)
    end_offset: Mapped[int] = mapped_column(Integer, default=0)
    page_number: Mapped[int] = mapped_column(Integer, default=0)
    comment_id: Mapped[int] = mapped_column(Integer, default=0)
    figure_value: Mapped[str] = mapped_column(String(200), default="")
    figure_period: Mapped[str] = mapped_column(String(200), default="")
    figure_scope: Mapped[str] = mapped_column(String(400), default="")
    figure_methodology: Mapped[str] = mapped_column(String(800), default="")
    status: Mapped[str] = mapped_column(String(20), default="proposed", index=True)
    date_ingested: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_document: Mapped[str] = mapped_column(String(255), default="")
    approver: Mapped[str] = mapped_column(String(200), default="")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    superseded_by_id: Mapped[str] = mapped_column(String(36), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    extractor: Mapped[str] = mapped_column(String(40), default="heuristic")

    document: Mapped[Document] = relationship(back_populates="entries")


class QuestionAnswer(Base):
    __tablename__ = "question_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    tags: Mapped[str] = mapped_column(Text, default="[]")
    source_document: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="approved")
    date_ingested: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    imported_as_trusted: Mapped[int] = mapped_column(Integer, default=1)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    entry_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    action: Mapped[str] = mapped_column(String(80))
    actor: Mapped[str] = mapped_column(String(200), default="system")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
