from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class Tag(BaseModel):
    id: str
    label: str
    aliases: list[str] = []


class TaxonomyOut(BaseModel):
    version: str
    owner: str
    notes: str = ""
    tags: list[Tag]


class DocumentOut(BaseModel):
    id: str
    family_key: str
    filename: str
    title: str
    kind: str
    version: int
    status: str
    error_message: str
    date_ingested: datetime
    paragraph_count: int
    marked_available: bool
    proposed_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    superseded_count: int = 0
    amended_count: int = 0
    figure_count: int = 0
    narrative_count: int = 0
    qa_count: int = 0


class EntryOut(BaseModel):
    id: str
    document_id: str
    entry_type: str
    body: str
    passage_text: str
    tags: list[str]
    paragraph_index: int
    start_offset: int
    end_offset: int
    page_number: int
    comment_id: int
    figure_value: str
    figure_period: str
    figure_scope: str
    figure_methodology: str
    status: str
    date_ingested: datetime
    last_reviewed: datetime | None
    source_document: str
    approver: str
    approved_at: datetime | None
    superseded_by_id: str
    confidence: float
    extractor: str


class ParagraphOut(BaseModel):
    index: int
    text: str
    heading: bool = False


class ReviewDecision(BaseModel):
    action: str = Field(pattern="^(approve|amend|reject)$")
    body: str | None = None
    tags: list[str] | None = None
    reviewer: str | None = None


class QAIn(BaseModel):
    question: str
    answer: str
    tags: list[str] = []
    source_document: str = "prior-approved-questionnaire"


class QAOut(BaseModel):
    id: str
    question: str
    answer: str
    tags: list[str]
    source_document: str
    status: str
    date_ingested: datetime
    last_reviewed: datetime | None
    imported_as_trusted: bool


class AuditOut(BaseModel):
    id: str
    document_id: str
    entry_id: str
    action: str
    actor: str
    detail: str
    created_at: datetime


class StatsOut(BaseModel):
    documents: int
    proposed: int
    approved: int
    rejected: int
    superseded: int
    qa_pairs: int
    extractor_mode: str


class ReviewBundle(BaseModel):
    document: DocumentOut
    paragraphs: list[ParagraphOut]
    entries: list[EntryOut]


class CitationOut(BaseModel):
    id: str
    source_type: str
    source_id: str
    excerpt: str
    title: str
    pinned_by: str


class QuestionOut(BaseModel):
    id: str
    questionnaire_id: str
    index: int
    section: str
    text: str
    locator: int
    tags: list[str]
    status: str
    origin: str
    draft_body: str
    approved_body: str
    confidence: str
    gap_reason: str
    reused_qa_id: str
    approver: str
    approved_at: datetime | None
    citations: list[CitationOut] = []


class QuestionnaireOut(BaseModel):
    id: str
    filename: str
    title: str
    kind: str
    client: str
    qtype: str
    notes: str
    due_at: str
    status: str
    error_message: str
    date_ingested: datetime
    last_reviewed: datetime | None
    question_count: int = 0
    approved_count: int = 0
    amended_count: int = 0
    gap_count: int = 0
    reused_count: int = 0
    drafted_count: int = 0
    remaining_count: int = 0
    pack_available: bool = False


class QuestionnaireBundle(BaseModel):
    questionnaire: QuestionnaireOut
    questions: list[QuestionOut]


class QuestionDecision(BaseModel):
    action: str = Field(pattern="^(approve|amend|gap|reject)$")
    body: str | None = None
    tags: list[str] | None = None
    reviewer: str | None = None


class CitationIn(BaseModel):
    source_type: str = "kb"
    source_id: str
    excerpt: str = ""
    title: str = ""


class ExportManifest(BaseModel):
    generated_at: datetime
    approved_count: int
    files: list[str]
    note: str
    extra: dict[str, Any] = {}
