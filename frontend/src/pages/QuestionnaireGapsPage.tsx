import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { QuestionnaireBundle } from "../types";

const REASONS: Record<string, string> = {
  no_source: "No source",
  wrong_scope: "Wrong scope",
  conflicting: "Conflicting",
  figure_incomplete: "Figure incomplete",
  out_of_date: "Out of date",
};

export default function QuestionnaireGapsPage() {
  const { id } = useParams();
  const [data, setData] = useState<QuestionnaireBundle | null>(null);

  useEffect(() => {
    if (!id) return;
    api.questionnaire(id).then(setData);
  }, [id]);

  const gaps = data?.questions.filter((item) => item.status === "gap") || [];

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>Gaps</h1>
          <p className="lead">What this questionnaire still cannot support from approved knowledge.</p>
        </div>
        <Link className="btn text" to={`/questionnaires/${id}`}>Back</Link>
      </div>
      <section className="card table-card">
        <table className="table">
          <thead>
            <tr><th>Question</th><th>Topic</th><th>Reason</th><th></th></tr>
          </thead>
          <tbody>
            {gaps.map((item) => (
              <tr key={item.id}>
                <td><strong>Q{item.index}.</strong> {item.text}</td>
                <td className="muted">{item.tags.join(", ") || "—"}</td>
                <td>{REASONS[item.gap_reason] || item.gap_reason || "No source"}</td>
                <td><Link className="btn text" to={`/questionnaires/${id}/review`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!gaps.length && <p className="muted">No gaps. Every question has evidence or an approved answer.</p>}
      </section>
    </div>
  );
}
