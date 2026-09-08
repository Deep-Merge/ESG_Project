import { ArrowRight, CircleCheck, FileText, MessagesSquare, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import FileMark from "../components/FileMark";
import Progress from "../components/Progress";
import Status from "../components/Status";
import { prettyDate } from "../lib/format";
import type { QuestionnaireBundle } from "../types";

export default function QuestionnaireHomePage() {
  const { id } = useParams();
  const [data, setData] = useState<QuestionnaireBundle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = () => api.questionnaire(id).then(setData).catch((err: Error) => setError(err.message));
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [id]);

  if (!data) {
    return <div className="page page-enter"><p className={error ? "error" : "muted"}>{error || "Loading questionnaire…"}</p></div>;
  }

  const q = data.questionnaire;
  const done = q.approved_count + q.amended_count;
  const pct = q.question_count ? Math.round((done / q.question_count) * 100) : 0;
  const gaps = data.questions.filter((item) => item.status === "gap").slice(0, 5);
  const kpis = [
    { label: "Questions parsed", value: q.question_count, tone: "info", icon: MessagesSquare },
    { label: "Drafts ready", value: q.drafted_count + q.reused_count, tone: "mint", icon: FileText },
    { label: "Approved", value: done, tone: "ok", icon: CircleCheck },
    { label: "Gaps", value: q.gap_count, tone: "warn", icon: TriangleAlert },
  ];

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>{q.title}</h1>
          <p className="lead">{q.client || "Client"} · {q.qtype.toUpperCase()} · {q.due_at ? `Due ${prettyDate(q.due_at)}` : "No due date"}</p>
        </div>
        <Status value={q.status} />
      </div>

      <div className="kpi-row">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="kpi-card">
              <span className={`kpi-ico ${item.tone}`}><Icon size={20} strokeWidth={1.85} /></span>
              <div className="kpi-body">
                <div className="tile-num">{item.value}</div>
                <div className="kpi-label">{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="continue-row">
        <FileMark kind={q.kind} size={44} />
        <div className="grow">
          <div className="toolbar">
            <strong>Continue answering</strong>
            <Status value={q.status} />
          </div>
          <div style={{ marginTop: 10 }}><Progress value={pct} /></div>
          <div className="continue-meta">
            {q.remaining_count} remaining · {q.reused_count} reused · {q.gap_count} gaps
            <span>{done} / {q.question_count} approved</span>
          </div>
        </div>
        <Link className="btn clean" to={`/questionnaires/${q.id}/review`}>
          Resume <ArrowRight size={15} />
        </Link>
      </div>

      <div className="verity-split">
        <section className="card">
          <div className="section-head"><h2>Top gaps</h2><Link className="btn text" to={`/questionnaires/${q.id}/gaps`}>View all</Link></div>
          {gaps.map((item) => (
            <div className="summary-line" key={item.id}>
              <span className="summary-ico edit">{item.index}</span>
              <span>{item.text}</span>
            </div>
          ))}
          {!gaps.length && <p className="muted">No gaps on this questionnaire.</p>}
        </section>
        <section className="card">
          <div className="section-head"><h2>Write back</h2></div>
          <p className="muted">Only approved answers leave the tool. Gaps stay comments — never invented prose.</p>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <Link className="btn clean" to={`/questionnaires/${q.id}/export`}>Write back</Link>
            <Link className="btn ghost" to={`/questionnaires/${q.id}/review`}>Open workspace</Link>
          </div>
        </section>
      </div>
      {q.error_message && <p className="error">{q.error_message}</p>}
    </div>
  );
}
