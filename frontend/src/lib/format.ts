import type { AuditRow, DocumentRow } from "../types";

export function kbId(id: string) {
  return `KB-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;
}

export function prettyDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function prettyTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function prettyAgo(value?: string | null) {
  if (!value) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return prettyDate(value);
}

export function statusLabel(value: string) {
  if (value === "ready_for_review" || value === "in_review") return "In review";
  if (value === "queued" || value === "processing") return "Processing";
  if (value === "failed") return "Needs attention";
  return value.replaceAll("_", " ");
}

export function docTitle(doc: DocumentRow) {
  return doc.title || doc.filename;
}

export function reviewedCount(doc: DocumentRow) {
  return doc.approved_count + doc.rejected_count + doc.amended_count;
}

export function totalActive(doc: DocumentRow) {
  return reviewedCount(doc) + doc.proposed_count;
}

export function progressPct(doc: DocumentRow) {
  const total = totalActive(doc);
  return total ? Math.round((reviewedCount(doc) / total) * 100) : 0;
}

export function activityLabel(row: AuditRow) {
  const map: Record<string, string> = {
    "entry.approve": "approved",
    "entry.amend": "amended",
    "entry.reject": "rejected",
    "entry.superseded": "superseded",
    "document.uploaded": "uploaded a document",
    "document.processed": "processing completed",
    "qa.imported": "imported a Q&A pair",
    "export.sharepoint": "exported to SharePoint",
  };
  return map[row.action] || row.action.replace(".", " ");
}

export function activityIcon(action: string) {
  if (action.includes("approve")) return "✓";
  if (action.includes("amend")) return "✎";
  if (action.includes("reject")) return "✕";
  if (action.includes("processed") || action.includes("upload")) return "⚙";
  if (action.includes("superseded")) return "↪";
  return "•";
}
