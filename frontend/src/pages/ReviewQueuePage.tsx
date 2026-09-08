import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Progress from "../components/Progress";
import { docTitle, progressPct, reviewedCount, totalActive } from "../lib/format";
import type { DocumentRow } from "../types";

const FILTERS = ["all", "figures", "narrative", "qa"] as const;

export default function ReviewQueuePage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    api.documents().then(setDocs);
  }, []);

  const queue = useMemo(() => {
    return docs.filter((doc) => {
      if (doc.status === "superseded") return false;
      if (!doc.proposed_count && doc.status !== "failed") return false;
      if (filter === "figures") return doc.figure_count > 0 && doc.proposed_count > 0;
      if (filter === "narrative") return doc.narrative_count > 0 && doc.proposed_count > 0;
      if (filter === "qa") return doc.qa_count > 0 && doc.proposed_count > 0;
      return true;
    });
  }, [docs, filter]);

  const proposals = queue.reduce((sum, doc) => sum + doc.proposed_count, 0);

  return (
    <div>
      <div className="page-head page-enter">
        <div>
          <h1>Review queue</h1>
          <p className="lead">An inbox of work. Nothing enters the knowledge base until someone here says yes.</p>
        </div>
        <div className="muted">{proposals} proposals</div>
      </div>
      <div className="filters">
        {FILTERS.map((item) => (
          <button key={item} className={item === filter ? "on" : ""} onClick={() => setFilter(item)}>
            {item === "all" ? "All" : item === "qa" ? "Q&A" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {queue.map((doc) => {
        const started = reviewedCount(doc) > 0;
        return (
          <div className="card queue-card" key={doc.id}>
            <div className="toolbar">
              <strong>{docTitle(doc)}</strong>
              {doc.status === "failed" && <span className="status rejected">Needs attention</span>}
            </div>
            <div style={{ margin: "12px 0 8px" }}><Progress value={progressPct(doc)} /></div>
            <div className="toolbar">
              <span className="muted">
                {started
                  ? `${reviewedCount(doc)} / ${totalActive(doc)} · ${doc.proposed_count} remaining`
                  : `${doc.proposed_count} proposals · Not started`}
              </span>
              <Link className="btn brand" to={`/documents/${doc.id}/review`}>
                {started ? "Continue review" : "Start review"} <ArrowRight size={15} />
              </Link>
            </div>
            {doc.error_message && <p className="error">{doc.error_message}</p>}
          </div>
        );
      })}
      {!queue.length && <p className="muted">The queue is clear.</p>}
    </div>
  );
}
