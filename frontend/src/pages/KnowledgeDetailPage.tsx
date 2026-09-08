import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Status from "../components/Status";
import { activityLabel, kbId, prettyDate, prettyTime } from "../lib/format";
import type { AuditRow, Entry } from "../types";

export default function KnowledgeDetailPage() {
  const { id } = useParams();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!id) return;
    api.entry(id).then((data) => {
      setEntry(data.entry);
      setHistory(data.history);
    });
  }, [id]);

  if (!entry) return <p className="muted">Loading knowledge…</p>;

  return (
    <div className="page-enter">
      <Link className="btn text" to="/knowledge">← Knowledge</Link>
      <div className="page-head">
        <div>
          <div className="kicker">{kbId(entry.id)}</div>
          <h1>{entry.tags[0] ? entry.tags[0].replace("-", " ") : entry.entry_type}</h1>
        </div>
        <Status value={entry.status} />
      </div>

      <div className="card">
        <p className="knowledge-body">{entry.body}</p>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="kicker">Classification</div>
          <p>{entry.tags.join(" → ") || "Untagged"}</p>
          <div className="kicker">Evidence</div>
          <p className="muted">{entry.passage_text}</p>
          <p className="faint">{entry.source_document} · §{entry.paragraph_index + 1}</p>
          <Link className="btn text" to={`/documents/${entry.document_id}`}>Open source →</Link>
        </div>
        <div className="card">
          <div className="kicker">Approval</div>
          <p>Proposed by {entry.extractor === "claude" ? "ESG extraction (Claude)" : "ESG extraction"}</p>
          <p>Reviewed by {entry.approver || "—"}</p>
          <p>Approved {prettyDate(entry.approved_at)}</p>
          <div className="kicker" style={{ marginTop: 16 }}>History</div>
          <div className="timeline">
            {history.map((row) => (
              <p key={row.id}>
                {prettyTime(row.created_at)} · {row.actor} {activityLabel(row)}
              </p>
            ))}
            {!history.length && <p className="muted">No history stored yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
