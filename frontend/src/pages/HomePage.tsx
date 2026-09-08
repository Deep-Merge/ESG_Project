import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Heart,
  Inbox,
  ListChecks,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Fold from "../components/Fold";
import Progress from "../components/Progress";
import Status from "../components/Status";
import { activityLabel, docTitle, prettyDate, prettyTime, progressPct, reviewedCount, totalActive } from "../lib/format";
import type { DocumentRow, Overview, Taxonomy } from "../types";

const COLLECTIONS = [
  {
    title: "Climate & net zero",
    query: "climate",
    cover: "/collections/climate-3.jpg",
    images: ["/collections/climate-1.jpg", "/collections/climate-2.jpg", "/collections/climate-3.jpg"],
  },
  {
    title: "Policies & governance",
    query: "governance",
    cover: "/collections/policy-1.jpg",
    images: ["/collections/policy-1.jpg", "/collections/policy-2.jpg", "/collections/policy-3.jpg"],
  },
  {
    title: "Social & reporting",
    query: "diversity",
    cover: "/collections/social-1.jpg",
    images: ["/collections/social-1.jpg", "/collections/social-2.jpg", "/collections/policy-2.jpg"],
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
      <section className="hero">
        <img className="hero-bg" src="/collections/climate-3.jpg" alt="" />
        <div className="hero-fade" />
        <div className="hero-copy">
          <div className="kicker">Savills IM · ESG knowledge</div>
          <h1>{hello}, {name}</h1>
          <p>
            {data.in_review_documents} documents are in review. You have <strong>{data.proposed}</strong> proposals
            waiting, and <strong>{data.approved_week}</strong> knowledge items were approved this week.
          </p>
        </div>
      </section>

      <div className="overview-board">
        <div>
          <Fold id="collection" title="Your collection" extra={<Link className="btn text" to="/knowledge">Show all</Link>}>
            <div className="collections">
              {COLLECTIONS.map((item) => (
                <Link key={item.title} to={`/knowledge?q=${item.query}`} className="shot">
                  <div className="shot-media">
                    <img src={item.cover} alt="" />
                    <div className="shot-fade" />
                    <div className="shot-fan">
                      {item.images.map((src) => (
                        <img key={src} src={src} alt="" />
                      ))}
                    </div>
                  </div>
                  <div className="shot-body">
                    <h3>{item.title}</h3>
                    <div className="faint">{data.approved} approved items · updated today</div>
                  </div>
                </Link>
              ))}
            </div>
          </Fold>

          {cont && (
            <Fold id="continue" title="Continue review">
              <div className="resume-card">
                <img src="/collections/policy-3.jpg" alt="" />
                <div className="resume-fade" />
                <div className="resume-copy">
                  <strong>{docTitle(cont)}</strong>
                  <div className="faint">{reviewedCount(cont)} / {totalActive(cont)} reviewed · {cont.proposed_count} remaining</div>
                  <div style={{ margin: "12px 0 14px" }}><Progress value={progressPct(cont)} /></div>
                  <Link className="btn soft" to={`/documents/${cont.id}/review`}>
                    <Play size={13} strokeWidth={1.6} fill="currentColor" /> Resume
                  </Link>
                </div>
              </div>
            </Fold>
          )}

          <Fold id="sources" title="Source documents" extra={<Link className="btn text" to="/documents">Open library</Link>}>
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
          </Fold>
        </div>

        <aside className="rail-stack">
          <div className="wash-card sage">
            <img src="/collections/climate-1.jpg" alt="" />
            <div className="wash-fade" />
            <div className="kicker">Daily summary</div>
            <p>
              You reviewed work across <strong>{data.in_review_documents} documents</strong>.
              There are <strong>{data.proposed}</strong> proposals waiting and{" "}
              <strong>{data.approved}</strong> trusted items in the base.
            </p>
            <div className="toolbar">
              <span className="faint"><Inbox size={14} strokeWidth={1.6} /> {data.proposed} to review</span>
              <span className="faint"><CheckCircle2 size={14} strokeWidth={1.6} /> {data.approved_month} this month</span>
            </div>
          </div>

          <div className="kicker">Quick access</div>
          <div className="quick">
            <Link to="/review"><ListChecks size={18} strokeWidth={1.6} /> Review</Link>
            <Link to="/knowledge"><Heart size={18} strokeWidth={1.6} /> Knowledge</Link>
            <Link to="/activity"><Activity size={18} strokeWidth={1.6} /> Activity</Link>
          </div>

          <Fold id="attention" title="Needs attention">
            <div className="wash-card sand">
              <img src="/collections/policy-1.jpg" alt="" />
              <div className="wash-fade" />
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
          </Fold>

          <Fold id="coverage" title="Coverage">
            <div className="card">
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
          </Fold>

          <Fold id="activity" title="Recent activity">
            <div className="card">
              {data.activity.slice(0, 5).map((row) => (
                <div key={row.id} className="list-row">
                  <span>{row.actor} {activityLabel(row)}</span>
                  <span className="faint">{prettyTime(row.created_at)}</span>
                </div>
              ))}
            </div>
          </Fold>
        </aside>
      </div>
    </div>
  );
}
