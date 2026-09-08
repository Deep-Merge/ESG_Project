import { FileText, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import FileField from "../components/FileField";
import Status from "../components/Status";
import { docTitle, prettyDate, reviewedCount } from "../lib/format";
import type { DocumentRow } from "../types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "review", label: "In review" },
  { id: "processing", label: "Processing" },
  { id: "done", label: "Published" },
  { id: "attention", label: "Attention" },
] as const;

function matchesFilter(doc: DocumentRow, filter: string) {
  if (filter === "all") return doc.status !== "superseded";
  if (filter === "review") return doc.proposed_count > 0 || doc.status === "ready_for_review" || doc.status === "in_review";
  if (filter === "processing") return doc.status === "queued" || doc.status === "processing";
  if (filter === "done") return doc.proposed_count === 0 && doc.approved_count > 0 && doc.status !== "failed";
  if (filter === "attention") return doc.status === "failed";
  return true;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [reviewer, setReviewer] = useState(localStorage.getItem("esg-reviewer") || "Noel");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.documents().then(setDocs).catch((err: Error) => setError(err.message));

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    localStorage.setItem("esg-reviewer", reviewer);
    setBusy(true);
    setError("");
    try {
      await api.upload(file, reviewer);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((item) => [item.id, docs.filter((doc) => matchesFilter(doc, item.id)).length])),
    [docs],
  );
  const visible = docs.filter((doc) => matchesFilter(doc, filter));

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="lead">Approved source material only. Word first, then review in place.</p>
        </div>
        <div className="muted">{counts.all || 0} sources</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="kicker">Add a source</div>
        <div className="toolbar" style={{ marginTop: 10 }}>
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Reviewer name"
            style={{ maxWidth: 180 }}
          />
          <FileField accept=".docx,.pdf" disabled={busy} onChange={onUpload} />
          {busy && <span className="muted">Processing…</span>}
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="filters">
        {FILTERS.map((item) => (
          <button key={item.id} className={item.id === filter ? "on" : ""} onClick={() => setFilter(item.id)}>
            {item.label}
            <span className="filter-count">{counts[item.id] || 0}</span>
          </button>
        ))}
      </div>

      <div className="kb-list">
        {visible.map((doc) => {
          const started = reviewedCount(doc) > 0;
          return (
            <article key={doc.id} className="doc-item">
              <span className={`activity-mark ${doc.kind === "pdf" ? "process" : "upload"}`}>
                <FileText size={18} strokeWidth={1.5} />
              </span>
              <div>
                <div className="toolbar">
                  <Link to={`/documents/${doc.id}`}><strong>{docTitle(doc)}</strong></Link>
                  <Status value={doc.proposed_count ? "ready_for_review" : doc.status} />
                </div>
                <div className="faint">
                  {doc.filename} · v{doc.version} · {prettyDate(doc.date_ingested)}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {doc.proposed_count} remaining · {doc.approved_count} approved
                </div>
              </div>
              <Link className="btn soft" to={doc.proposed_count ? `/documents/${doc.id}/review` : `/documents/${doc.id}`}>
                <Play size={13} strokeWidth={1.6} fill="currentColor" />
                {doc.proposed_count ? (started ? "Resume" : "Start") : "Open"}
              </Link>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <p className="muted">
          {error || "No documents in this view. Upload a Word file, or restart the API for the demo pack."}
        </p>
      )}
    </div>
  );
}
