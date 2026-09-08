import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  FileCheck,
  FileClock,
  FileText,
  FileWarning,
  Inbox,
  ListChecks,
  Minus,
  MoreHorizontal,
  PenLine,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import FileMark from "../components/FileMark";
import Progress from "../components/Progress";
import Status from "../components/Status";
import { activityLabel, docTitle, prettyAgo, prettyDate, progressPct, reviewedCount, totalActive } from "../lib/format";
import { topicIcon } from "../lib/topics";
import type { DocumentRow, Overview, Taxonomy } from "../types";

function activityTone(action: string) {
  if (action.includes("approve")) return { icon: Check, tone: "ok" };
  if (action.includes("amend")) return { icon: PenLine, tone: "edit" };
  if (action.includes("reject")) return { icon: Minus, tone: "bad" };
  return { icon: FileText, tone: "doc" };
}

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
      <div className="verity page-enter">
        <h1>Overview</h1>
        <p className={error ? "error" : "muted"}>{error || "Loading the knowledge workbench…"}</p>
      </div>
    );
  }

  const name = localStorage.getItem("esg-reviewer") || "Noel";
  const cont = data.continue_document;
  const kpis = [
    { to: "/review", label: "Proposals waiting for review", value: data.proposed, tone: "doc", icon: FileClock },
    { to: "/knowledge", label: "Approved knowledge items", value: data.approved, tone: "ok", icon: CircleCheck },
    { to: "/documents", label: "Documents processed", value: data.documents, tone: "mint", icon: FileCheck },
    { to: "/review", label: "Needs attention", value: data.attention, tone: "warn", icon: FileWarning },
  ];

  return (
    <div className="verity page-enter">
      <div className="verity-layout">
        <div className="verity-feed">
          <section className="verity-banner">
            <img src="/collections/dashboard-hero.png" alt="" />
            <div className="verity-banner-fade" />
            <div className="verity-hero-copy">
              <h1>{hello}, {name}.</h1>
              <p>
                You have {data.proposed} proposals waiting for review, {data.in_review_documents} documents
                in progress, and {data.approved_week} trusted knowledge items were approved this week.
              </p>
              <div className="toolbar">
                <Link className="btn" to={cont ? `/documents/${cont.id}/review` : "/review"}>
                  Continue review <ArrowRight size={16} strokeWidth={1.6} />
                </Link>
                <Link className="btn ghost light" to="/knowledge">
                  <Search size={15} strokeWidth={1.6} /> Search knowledge
                </Link>
              </div>
            </div>
          </section>

          <div className="kpi-row">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.to} className="kpi-card">
                  <span className={`kpi-ico ${item.tone}`}><Icon size={18} strokeWidth={1.5} /></span>
                  <ChevronRight className="kpi-go" size={16} strokeWidth={1.6} />
                  <div className="tile-num">{item.value}</div>
                  <div className="muted">{item.label}</div>
                </Link>
              );
            })}
          </div>

          {cont && (
            <div className="continue-row">
              <FileMark kind="docx" />
              <div className="grow">
                <div className="toolbar">
                  <strong>{docTitle(cont)}</strong>
                  <Status value={cont.proposed_count ? "in_review" : cont.status} />
                </div>
                <div className="faint">{reviewedCount(cont)} / {totalActive(cont)} reviewed</div>
                <div style={{ marginTop: 8 }}><Progress value={progressPct(cont)} /></div>
              </div>
              <Link className="btn clean" to={`/documents/${cont.id}/review`}>Resume</Link>
              <button type="button" className="icon-btn" aria-label="More"><MoreHorizontal size={16} /></button>
            </div>
          )}

          <section className="card table-card">
            <div className="section-head">
              <h2>Recent documents</h2>
              <Link className="btn text" to="/documents">View all</Link>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Proposals</th>
                  <th>Approved</th>
                  <th>Last updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <Link to={`/documents/${doc.id}`} className="doc-name">
                        <FileMark kind={doc.kind} size={28} />
                        <strong>{docTitle(doc)}</strong>
                      </Link>
                    </td>
                    <td className="muted">{doc.kind.toUpperCase()}</td>
                    <td><Status value={doc.proposed_count ? "in_review" : doc.status} /></td>
                    <td>{doc.proposed_count}</td>
                    <td>{doc.approved_count}</td>
                    <td className="muted">{prettyDate(doc.date_ingested)}</td>
                    <td><button type="button" className="icon-btn" aria-label="More"><MoreHorizontal size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="verity-split">
            <section className="card">
              <div className="section-head"><h2>Recent activity</h2></div>
              {data.activity.slice(0, 6).map((row) => {
                const meta = activityTone(row.action);
                const Icon = meta.icon;
                return (
                  <div key={row.id} className="act-row">
                    <span className={`activity-mark ${meta.tone}`}><Icon size={14} strokeWidth={1.6} /></span>
                    <div>
                      <div><strong>{row.actor}</strong> {activityLabel(row)}</div>
                      <div className="faint">{prettyAgo(row.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="card">
              <div className="section-head"><h2>Knowledge by topic</h2></div>
              {(taxonomy?.tags || []).map((tag) => {
                const Icon = topicIcon(tag.id);
                return (
                  <Link key={tag.id} to={`/knowledge?q=${tag.id}`} className="topic-line">
                    <span className="topic-ico"><Icon size={15} strokeWidth={1.6} /></span>
                    <span className="grow">{tag.label}</span>
                    <span className="faint">{data.approved}</span>
                  </Link>
                );
              })}
            </section>
          </div>
        </div>

        <aside className="verity-rail">
          <section className="card">
            <div className="section-head">
              <h2>Today’s summary</h2>
              <span className="faint">{prettyDate(new Date().toISOString())}</span>
            </div>
            <div className="summary-line"><Inbox size={14} /> Proposals waiting <b>{data.proposed}</b></div>
            <div className="summary-line"><Check size={14} /> Items approved <b>{data.approved}</b></div>
            <div className="summary-line"><PenLine size={14} /> Approved this week <b>{data.approved_week}</b></div>
            <div className="summary-line"><FileText size={14} /> Needs attention <b>{data.attention}</b></div>
          </section>

          <section className="card">
            <div className="section-head"><h2>Quick actions</h2></div>
            <div className="qa-grid">
              <Link to="/documents"><Upload size={16} /> Upload document</Link>
              <Link to="/knowledge"><BookOpen size={16} /> Browse knowledge</Link>
              <Link to="/review"><ListChecks size={16} /> Open review</Link>
              <Link to="/activity"><ArrowUpRight size={16} /> View activity</Link>
            </div>
          </section>

          <section className="card">
            <div className="section-head"><h2>Knowledge coverage</h2></div>
            <div className="storage">
              {["Environmental", "Social", "Governance", "General"].map((label, index) => {
                const widths = [82, 64, 71, 38];
                return (
                  <div className="storage-row" key={label}>
                    <span>{label}</span>
                    <div className="track"><i style={{ width: `${widths[index]}%` }} /></div>
                    <span className="faint">{widths[index]}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="quote-card">
            <img src="/collections/hero-city.jpg" alt="" />
            <div className="quote-fade" />
            <p>From knowledge to impact.</p>
          </section>

          <section className="card">
            <div className="section-head"><h2>Helpful links</h2></div>
            <Link className="help-link" to="/taxonomy">ESG taxonomy <ArrowUpRight size={13} /></Link>
            <Link className="help-link" to="/qa">Approved Q&A <ArrowUpRight size={13} /></Link>
            <a className="help-link" href="https://www.savillsim.com" target="_blank" rel="noreferrer">
              Contact support <ArrowUpRight size={13} />
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
