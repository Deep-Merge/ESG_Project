export type DocumentRow = {
  id: string;
  family_key: string;
  filename: string;
  title: string;
  kind: string;
  version: number;
  status: string;
  error_message: string;
  date_ingested: string;
  paragraph_count: number;
  marked_available: boolean;
  proposed_count: number;
  approved_count: number;
  rejected_count: number;
  superseded_count: number;
  amended_count: number;
  figure_count: number;
  narrative_count: number;
  qa_count: number;
};

export type Entry = {
  id: string;
  document_id: string;
  entry_type: string;
  body: string;
  passage_text: string;
  tags: string[];
  paragraph_index: number;
  start_offset: number;
  end_offset: number;
  page_number: number;
  comment_id: number;
  figure_value: string;
  figure_period: string;
  figure_scope: string;
  figure_methodology: string;
  status: string;
  date_ingested: string;
  last_reviewed: string | null;
  source_document: string;
  approver: string;
  approved_at: string | null;
  superseded_by_id: string;
  confidence: number;
  extractor: string;
};

export type Paragraph = {
  index: number;
  text: string;
  heading: boolean;
};

export type ReviewBundle = {
  document: DocumentRow;
  paragraphs: Paragraph[];
  entries: Entry[];
};

export type Taxonomy = {
  version: string;
  owner: string;
  notes: string;
  tags: { id: string; label: string; aliases: string[] }[];
};

export type QAPair = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  source_document: string;
  status: string;
  date_ingested: string;
  last_reviewed: string | null;
  imported_as_trusted: boolean;
};

export type AuditRow = {
  id: string;
  document_id: string;
  entry_id: string;
  action: string;
  actor: string;
  detail: string;
  created_at: string;
};

export type Overview = {
  reviewer: string;
  proposed: number;
  in_review_documents: number;
  approved: number;
  approved_month: number;
  approved_week: number;
  documents: number;
  processing: number;
  attention: number;
  continue_document: DocumentRow | null;
  attention_documents: DocumentRow[];
  activity: AuditRow[];
  extractor_mode: string;
};
