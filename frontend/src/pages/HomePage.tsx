import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Progress from "../components/Progress";
import SearchBox from "../components/SearchBox";
import { activityLabel, docTitle, prettyTime, progressPct, reviewedCount, totalActive } from "../lib/format";
import type { Overview, Taxonomy } from "../types";

export default function HomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [error, setError] = useState("");
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    Promise.all([api.overview(), api.taxonomy()])
      .then(([overview, tax]) => {
        setData(overview);
        setTaxonomy(tax);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!data) return <p className="muted">{error || "Loading…"}</p>;
  const name = localStorage.getItem("esg-reviewer") || "Noel";
  const cont = data.continue_document;

  return (
    <div className="page-enter">
      <h1>{hello}, {name}</h1>
      <p className="lead">
        {data.in_review_documents} document{data.in_review_documents === 1 ? " is" : "s are"} in review.
        You have {data.proposed} proposal{data.proposed === 1 ? "" : "s"} waiting, and {data.approved_week} knowledge
        items were approved this week.
      </p>

      <SearchBox />
      <div>
        {(taxonomy?.tags || []).slice(0, 5).map((tag) => (
          <Link key={tag.id} className="chip" to={`/knowledge?q=${encodeURIComponent(tag.label)}`}>{tag.label}</Link>
        ))}
      </div>

      <div className="grid g2 stagger" style={{ marginTop: 22 }}>
        <Link to="/review" className="card strong">
          <div className="kicker">Needs you</div>
          <div className="tile-num">{data.proposed}</div>
          <p>Need review across {data.in_review_documents} documents</p>
          <span className="cta-row">Continue reviewing <ArrowRight size={16} /></span>
        </Link>
        <div className="card">
          <div className="kicker">Trusted base</div>
          <div className="tile-num">{data.approved}</div>
          <p className="muted">Approved knowledge · +{data.approved_month} this month</p>
        </div>
      </div>

      <div className="grid g4 stagger" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="faint"><Inbox size={14} strokeWidth={1.6} className="ico-sm" /> Awaiting your review</div>
          <strong style={{ fontSize: 22 }}>{data.proposed}</strong>
          <div className="muted">Across {data.in_review_documents} documents</div>
        </div>
        <div className="card">
          <div className="faint"><CheckCircle2 size={14} strokeWidth={1.6} className="ico-sm" /> Approved knowledge</div>
          <strong style={{ fontSize: 22 }}>{data.approved}</strong>
          <div className="muted">+{data.approved_month} this month</div>
        </div>
        <div className="card">
          <div className="faint"><FileText size={14} strokeWidth={1.6} className="ico-sm" /> Documents processed</div>
          <strong style={{ fontSize: 22 }}>{data.documents}</strong>
          <div className="muted">{data.processing} currently processing</div>
        </div>
        <div className="card">
          <div className="faint"><AlertTriangle size={14} strokeWidth={1.6} className="ico-sm" /> Needs attention</div>
          <strong style={{ fontSize: 22 }}>{data.attention}</strong>
          <div className="muted">Processing / review issues</div>
        </div>
      </div>

      {cont && (
        <div style={{ marginTop: 28 }}>
          <div className="kicker">Continue your work</div>
          <div className="card">
            <div className="toolbar">
              <strong>{docTitle(cont)}</strong>
              <span className="faint">{reviewedCount(cont)} of {totalActive(cont)} reviewed</span>
            </div>
            <div style={{ margin: "12px 0" }}><Progress value={progressPct(cont)} /></div>
            <div className="toolbar">
              <span className="muted">
                {cont.approved_count} approved · {cont.amended_count} amended · {cont.rejected_count} rejected · {cont.proposed_count} remaining
              </span>
              <Link className="btn brand" to={`/documents/${cont.id}/review`}>
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid g2" style={{ marginTop: 28 }}>
        <div>
          <div className="kicker">Needs attention</div>
          <div className="card">
            {data.attention_documents.map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="list-row">
                <span>{docTitle(doc)}</span>
                <span className="muted">{doc.proposed_count || doc.status}</span>
              </Link>
            ))}
            {!data.attention_documents.length && <p className="muted">Nothing waiting.</p>}
            <Link className="btn text" to="/review">View review queue <ArrowRight size={14} /></Link>
          </div>
        </div>
        <div>
          <div className="kicker">Recent activity</div>
          <div className="card">
            {data.activity.map((row) => (
              <div key={row.id} className="list-row">
                <span>{row.actor} {activityLabel(row)}</span>
                <span className="faint">{prettyTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
