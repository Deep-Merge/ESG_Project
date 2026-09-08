import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Status from "../components/Status";
import type { QuestionnaireBundle } from "../types";

export default function QuestionnaireExportPage() {
  const { id } = useParams();
  const [data, setData] = useState<QuestionnaireBundle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.questionnaire(id).then(setData).catch((err: Error) => setError(err.message));
  }, [id]);

  if (!data) return <div className="page page-enter"><p className={error ? "error" : "muted"}>{error || "Loading write-back…"}</p></div>;
  const q = data.questionnaire;
  const rows = [
    ["Approved answers", q.approved_count],
    ["Amended answers", q.amended_count],
    ["Gaps (comment only)", q.gap_count],
    ["Still draft (excluded)", q.remaining_count],
  ];

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>Write back</h1>
          <p className="lead">{q.title}. Drafts and rejected wording are not included.</p>
        </div>
        <Status value={q.status} />
      </div>
      <section className="card">
        {rows.map(([label, value]) => (
          <div className="summary-line" key={String(label)}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
        <div className="toolbar" style={{ marginTop: 18 }}>
          <button className="btn clean" type="button" onClick={() => id && api.exportQuestionnaire(id)}>Download answers pack</button>
          <Link className="btn ghost" to={`/questionnaires/${q.id}/review`}>Back to workspace</Link>
        </div>
      </section>
    </div>
  );
}
