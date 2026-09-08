import { ArrowRight, MessagesSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import FileMark from "../components/FileMark";
import Progress from "../components/Progress";
import Status from "../components/Status";
import { prettyDate } from "../lib/format";
import type { QuestionnaireRow } from "../types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "review", label: "In review" },
  { id: "gaps", label: "Gaps" },
  { id: "ready", label: "Ready to write back" },
  { id: "done", label: "Completed" },
] as const;

function matches(row: QuestionnaireRow, filter: string) {
  if (filter === "all") return true;
  if (filter === "review") return ["queued", "processing", "ready_for_review", "in_review"].includes(row.status);
  if (filter === "gaps") return row.gap_count > 0 && row.status !== "written_back";
  if (filter === "ready") return row.status === "ready_to_write";
  if (filter === "done") return row.status === "written_back";
  return true;
}

export default function QuestionnairesPage() {
  const [rows, setRows] = useState<QuestionnaireRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [error, setError] = useState("");

  const load = () => api.questionnaires().then(setRows).catch((err: Error) => setError(err.message));

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((item) => [item.id, rows.filter((row) => matches(row, item.id)).length])),
    [rows],
  );
  const visible = rows.filter((row) => matches(row, filter));

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>Questionnaires</h1>
          <p className="lead">Reuse approved answers first. Draft only from the knowledge base. Flag gaps — never invent.</p>
        </div>
        <Link className="btn clean" to="/questionnaires/new">Upload questionnaire</Link>
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
        {visible.map((row) => {
          const total = row.question_count || 1;
          const done = row.approved_count + row.amended_count;
          const pct = Math.round((done / total) * 100);
          return (
            <article key={row.id} className="doc-item">
              <FileMark kind={row.kind} size={40} />
              <div>
                <div className="toolbar">
                  <Link to={`/questionnaires/${row.id}`}><strong>{row.title}</strong></Link>
                  <Status value={row.status} />
                </div>
                <div className="faint">
                  {row.client || "Client"} · {row.qtype.toUpperCase()} · {prettyDate(row.date_ingested)}
                  {row.due_at ? ` · due ${prettyDate(row.due_at)}` : ""}
                </div>
                <div style={{ marginTop: 8, maxWidth: 320 }}><Progress value={pct} /></div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {done} / {row.question_count} approved
                  {row.gap_count ? ` · ${row.gap_count} gaps` : ""}
                  {row.remaining_count ? ` · ${row.remaining_count} remaining` : ""}
                </div>
              </div>
              <Link className="btn clean" to={`/questionnaires/${row.id}/review`}>
                {row.remaining_count ? "Resume" : "Open"} <ArrowRight size={15} />
              </Link>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="card empty-card">
          <MessagesSquare size={22} strokeWidth={1.6} />
          <p>Upload a questionnaire. VERITY will draft from approved knowledge only.</p>
          <Link className="btn clean" to="/questionnaires/new">Upload questionnaire</Link>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
