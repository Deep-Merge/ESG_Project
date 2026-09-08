import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Progress from "../components/Progress";
import Status from "../components/Status";
import { docTitle, prettyDate, progressPct, reviewedCount, totalActive } from "../lib/format";
import type { DocumentRow } from "../types";

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState<DocumentRow | null>(null);

  useEffect(() => {
    if (id) api.document(id).then(setDoc);
  }, [id]);

  if (!doc) return <p className="muted">Loading document…</p>;

  const steps = [
    ["Document parsed", doc.paragraph_count > 0],
    [`${doc.narrative_count + doc.figure_count + doc.qa_count} proposals extracted`, doc.status !== "queued"],
    ["Taxonomy suggested", doc.status === "ready_for_review" || reviewedCount(doc) > 0],
    ["Source locations identified", doc.marked_available || doc.kind === "pdf"],
    ["Human review", doc.proposed_count === 0 && totalActive(doc) > 0],
    ["Publish approved knowledge", doc.approved_count > 0 && doc.proposed_count === 0],
  ] as const;

  const current = steps.findIndex(([, done]) => !done);

  return (
    <div className="page-enter">
      <Link className="btn text" to="/documents">← Documents</Link>
      <div className="page-head">
        <div>
          <h1>{docTitle(doc)}</h1>
          <p className="lead">{doc.filename} · version {doc.version}</p>
        </div>
        <Status value={doc.proposed_count ? "ready_for_review" : doc.status} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="kicker">Processing</div>
          <div className="pipeline" style={{ marginTop: 12 }}>
            {steps.map(([label, done], index) => (
              <div key={label} className={`pipe ${done ? "done" : index === current ? "now" : ""}`}>
                <span className="dot" />
                <span>{done ? `✓ ${label}` : index === current ? `● ${label}` : `○ ${label}`}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="kicker">{totalActive(doc)} proposals</div>
          <p>Narrative {doc.narrative_count}</p>
          <p>Figures {doc.figure_count}</p>
          <p>Q&A {doc.qa_count}</p>
          <div className="kicker" style={{ marginTop: 16 }}>Review progress</div>
          <div style={{ margin: "10px 0" }}><Progress value={progressPct(doc)} /></div>
          <p className="muted">
            {doc.approved_count} approved · {doc.amended_count} amended · {doc.rejected_count} rejected · {doc.proposed_count} remaining
          </p>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <Link className="btn soft" to={`/documents/${doc.id}/review`}>
              <Play size={13} strokeWidth={1.6} fill="currentColor" />
              {doc.proposed_count === 0 ? "Open" : reviewedCount(doc) > 0 ? "Resume" : "Start"}
            </Link>
            {doc.marked_available && (
              <button className="btn ghost" onClick={() => api.downloadMarked(doc.id)}>Open marked Word</button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="grid g3">
          <div><div className="faint">Uploaded</div>{prettyDate(doc.date_ingested)}</div>
          <div><div className="faint">Source</div>Local ingest · {doc.kind.toUpperCase()}</div>
          <div><div className="faint">Paragraphs</div>{doc.paragraph_count}</div>
        </div>
      </div>
    </div>
  );
}
