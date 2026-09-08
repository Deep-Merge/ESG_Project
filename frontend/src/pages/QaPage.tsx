import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import ComboBox from "../components/ComboBox";
import { topicIcon } from "../lib/topics";
import type { QAPair, Taxonomy } from "../types";

export default function QaPage() {
  const [rows, setRows] = useState<QAPair[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tag, setTag] = useState("governance");
  const [source, setSource] = useState("Prior approved questionnaire");
  const [error, setError] = useState("");

  const load = () => api.qa().then(setRows);

  useEffect(() => {
    load();
    api.taxonomy().then(setTaxonomy);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.addQa({ question, answer, tags: [tag], source_document: source });
      setQuestion("");
      setAnswer("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import");
    }
  }

  return (
    <div>
      <h1>Approved Q&A</h1>
      <p className="lead">Prior human-approved answers only. Fresh extraction from documents still goes through review.</p>
      <div className="grid g2">
        <form className="card" onSubmit={onSubmit}>
          <div className="kicker">Import a trusted pair</div>
          <div className="field"><input type="text" placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required /></div>
          <div className="field"><textarea placeholder="Approved answer" value={answer} onChange={(e) => setAnswer(e.target.value)} required /></div>
          <div className="field">
            <ComboBox
              value={tag}
              onChange={setTag}
              options={(taxonomy?.tags || []).map((item) => ({
                value: item.id,
                label: item.label,
                icon: topicIcon(item.id),
              }))}
            />
          </div>
          <div className="field"><input type="text" value={source} onChange={(e) => setSource(e.target.value)} /></div>
          {error && <p className="error">{error}</p>}
          <button className="btn brand" type="submit">Add to library</button>
        </form>
        <div className="kb-list">
          {rows.map((row) => (
            <div key={row.id} className="kb-row">
              <strong>{row.question}</strong>
              <p>{row.answer}</p>
              <div className="faint">{row.source_document} · imported as trusted</div>
            </div>
          ))}
          {!rows.length && <p className="muted">No Q&A pairs yet.</p>}
        </div>
      </div>
    </div>
  );
}
