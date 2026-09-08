import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Heart,
  Inbox,
  Lock,
  Play,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Progress from "../components/Progress";
import Status from "../components/Status";
import { activityLabel, docTitle, prettyDate, prettyTime, progressPct, reviewedCount, totalActive } from "../lib/format";
import type { DocumentRow, Overview, Taxonomy } from "../types";

const COLLECTIONS = [
  {
    title: "Climate & net zero",
    query: "climate",
    tint: "tint-a",
    images: [
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=240&q=70",
      "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=240&q=70",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=240&q=70",
    ],
  },
  {
    title: "Policies & governance",
    query: "governance",
    tint: "tint-b",
    images: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ae?auto=format&fit=crop&w=240&q=70",
      "https://images.unsplash.com/photo-1487956382158-bb926046304a?auto=format&fit=crop&w=240&q=70",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=240&q=70",
    ],
  },
  {
    title: "Social & reporting",
    query: "diversity",
    tint: "tint-c",
    images: [
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=240&q=70",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=240&q=70",
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=240&q=70",
    ],
  },
];

export default function HomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [error, setError] = useState("");
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    api.overview().then(setData).catch((err: Error) => setError(err.message));
    api.documents().then(setDocs).catch(() => undefined);
    api.taxonomy().then(setTaxonomy).catch(() => undefined);
  }, []);

  if (!data) {
    return (
      <div className="page-enter overview">
        <h1>Overview</h1>
        <p className={error ? "error" : "muted"}>{error || "Loading the knowledge workbench…"}</p>
      </div>
    );
  }

  const name = localStorage.getItem("esg-reviewer") || "Noel";
  const cont = data.continue_document;

  return (
    <div className="page-enter overview">
      <h1>{hello}, {name}</h1>
      <p className="lead">
        {data.in_review_documents} documents are in review. You have <strong>{data.proposed}</strong> proposals
        waiting, and <strong>{data.approved_week}</strong> knowledge items were approved this week.
      </p>

      <div className="overview-board">
        <div>
          <div className="section-head">
            <h2>Your collection</h2>
            <Link className="btn text" to="/knowledge">Show all</Link>
          </div>
          <div className="collections stagger">
            {COLLECTIONS.map((item) => {
              const count = data.approved;
              return (
                <Link key={item.title} to={`/knowledge?q=${item.query}`} className={`collection ${item.tint}`}>
                  <div className="fan">
                    {item.images.map((src) => (
                      <img key={src} src={src} alt="" />
                    ))}
                  </div>
                  <h3>{item.title}</h3>
                  <div className="faint">{count} approved items · updated today</div>
                </Link>
              );
            })}
          </div>

          {cont && (
            <div className="card" style={{ marginTop: 22 }}>
              <div className="toolbar">
                <strong>Continue {docTitle(cont)}</strong>
                <span className="faint">{reviewedCount(cont)} / {totalActive(cont)}</span>
              </div>
              <div style={{ margin: "12px 0" }}><Progress value={progressPct(cont)} /></div>
              <div className="toolbar">
                <span className="muted">{cont.proposed_count} remaining</span>
                <Link className="btn soft" to={`/documents/${cont.id}/review`}>
                  <Play size={13} strokeWidth={1.6} fill="currentColor" /> Resume
                </Link>
              </div>
            </div>
          )}

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>Source documents</h2>
            <Link className="btn text" to="/documents">Open library</Link>
          </div>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Docs</th>
                  <th>Status</th>
                  <th>Remaining</th>
                  <th>Approved</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <Link to={`/documents/${doc.id}`}><strong>{docTitle(doc)}</strong></Link>
                    </td>
                    <td><Status value={doc.status} /></td>
                    <td>{doc.proposed_count}</td>
                    <td>{doc.approved_count}</td>
                    <td className="muted">{prettyDate(doc.date_ingested)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside>
          <div className="card">
            <div className="kicker">Daily summary</div>
            <p>
              You reviewed work across <strong>{data.in_review_documents} documents</strong>.
              There are <strong>{data.proposed}</strong> proposals waiting and{" "}
              <strong>{data.approved}</strong> trusted knowledge items in the base.
            </p>
            <div className="toolbar">
              <span className="faint"><Inbox size={14} strokeWidth={1.6} /> {data.proposed} to review</span>
              <span className="faint"><CheckCircle2 size={14} strokeWidth={1.6} /> {data.approved_month} this month</span>
            </div>
          </div>

          <div className="kicker" style={{ marginTop: 18 }}>Quick access</div>
          <div className="quick">
            <Link to="/review"><Lock size={18} strokeWidth={1.6} /> Review</Link>
            <Link to="/knowledge"><Heart size={18} strokeWidth={1.6} /> Knowledge</Link>
            <Link to="/activity"><Trash2 size={18} strokeWidth={1.6} /> Activity</Link>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="kicker">Needs attention</div>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <div>
                <div className="tile-num" style={{ fontSize: 28 }}>{data.attention}</div>
                <div className="faint"><AlertTriangle size={14} strokeWidth={1.6} /> Processing issues</div>
              </div>
              <div>
                <div className="tile-num" style={{ fontSize: 28 }}>{data.proposed}</div>
                <div className="faint"><FileText size={14} strokeWidth={1.6} /> Awaiting review</div>
              </div>
            </div>
            {data.attention_documents.slice(0, 3).map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="list-row">
                <span>{docTitle(doc)}</span>
                <span className="muted">{doc.proposed_count}</span>
              </Link>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="kicker">Coverage</div>
            <div className="storage">
              {(taxonomy?.tags || []).slice(0, 4).map((tag, index) => {
                const widths = [82, 64, 48, 36];
                const colors = ["#8aa4c2", "#c9b48a", "#6f8f73", "#c4c0b8"];
                return (
                  <div className="storage-row" key={tag.id}>
                    <span>{tag.label.split(" ")[0]}</span>
                    <div className="track"><i style={{ width: `${widths[index]}%`, background: colors[index] }} /></div>
                    <span className="faint">{widths[index]}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="kicker">Recent activity</div>
            {data.activity.slice(0, 5).map((row) => (
              <div key={row.id} className="list-row">
                <span>{row.actor} {activityLabel(row)}</span>
                <span className="faint">{prettyTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
