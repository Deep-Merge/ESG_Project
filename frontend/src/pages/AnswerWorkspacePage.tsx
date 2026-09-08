import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Search, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Status from "../components/Status";
import { kbId } from "../lib/format";
import { topicIcon } from "../lib/topics";
import type { Entry, QAPair, QuestionRow, QuestionnaireBundle } from "../types";

export default function AnswerWorkspacePage() {
  const { id } = useParams();
  const [data, setData] = useState<QuestionnaireBundle | null>(null);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Entry[]>([]);
  const [qa, setQa] = useState<QAPair[]>([]);
  const [error, setError] = useState("");
  const reviewer = localStorage.getItem("esg-reviewer") || "Noel";

  const load = (keep?: string) => {
    if (!id) return;
    api.questionnaire(id).then((bundle) => {
      setData(bundle);
      const next = bundle.questions.find((item) => item.id === keep)
        || bundle.questions.find((item) => ["reused", "drafted", "classified"].includes(item.status))
        || bundle.questions[0];
      if (next) {
        setSelected(next.id);
        setDraft(next.approved_body || next.draft_body);
      }
    }).catch((err: Error) => setError(err.message));
  };

  useEffect(() => { load(); }, [id]);

  const current = data?.questions.find((item) => item.id === selected);
  const visible = useMemo(() => {
    const rows = data?.questions || [];
    if (filter === "all") return rows;
    if (filter === "approved") return rows.filter((item) => item.status === "approved" || item.status === "amended");
    return rows.filter((item) => item.status === filter);
  }, [data, filter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!data || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      const index = visible.findIndex((item) => item.id === selected);
      if (event.key === "j" && visible[index + 1]) pick(visible[index + 1]);
      if (event.key === "k" && visible[index - 1]) pick(visible[index - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function pick(item: QuestionRow) {
    setSelected(item.id);
    setDraft(item.approved_body || item.draft_body);
    setError("");
  }

  async function decide(action: string) {
    if (!id || !current) return;
    setError("");
    try {
      await api.reviewQuestion(id, current.id, { action, body: draft, reviewer });
      load(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function searchEvidence(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setHits([]);
      return;
    }
    const [knowledge, pairs] = await Promise.all([api.search(value), api.qa()]);
    setHits(knowledge);
    setQa(pairs.filter((row) => row.question.toLowerCase().includes(value.toLowerCase()) || row.answer.toLowerCase().includes(value.toLowerCase())));
  }

  async function pin(sourceType: string, sourceId: string, excerpt: string, title: string) {
    if (!id || !current) return;
    await api.citeQuestion(id, current.id, { source_type: sourceType, source_id: sourceId, excerpt, title });
    load(current.id);
  }

  async function unpin(citationId: string) {
    if (!id || !current) return;
    await api.unciteQuestion(id, current.id, citationId);
    load(current.id);
  }

  if (!data) {
    return <div className="ans-empty"><p className={error ? "error" : "muted"}>{error || "Opening workspace…"}</p></div>;
  }

  const q = data.questionnaire;
  const done = q.approved_count + q.amended_count;

  return (
    <div className="ans">
      <header className="ans-head">
        <Link className="btn text" to={`/questionnaires/${q.id}`}><ArrowLeft size={16} /> {q.title}</Link>
        <span className="muted grow">{done} / {q.question_count} approved · {q.gap_count} gaps</span>
        <Link className="btn ghost" to={`/questionnaires/${q.id}/gaps`}>Gaps</Link>
        <Link className="btn clean" to={`/questionnaires/${q.id}/export`}>Write back</Link>
      </header>

      <div className="ans-cols">
        <aside className="ans-rail">
          <div className="ans-filters">
            {["all", "reused", "drafted", "gap", "approved"].map((item) => (
              <button key={item} className={filter === item ? "on" : ""} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          {visible.map((item) => (
            <button key={item.id} className={`ans-q ${item.id === selected ? "on" : ""}`} onClick={() => pick(item)}>
              <i className={`ans-dot ${item.status}`} />
              <span>
                <b>Q{item.index}</b>
                <em>{item.text}</em>
              </span>
            </button>
          ))}
        </aside>

        <section className="ans-main">
          {current ? (
            <>
              <div className="kicker">Question {current.index} of {q.question_count} · {current.section}</div>
              <h2>{current.text}</h2>
              <div className="ans-meta">
                <Status value={current.status} />
                <span className={`origin-pill ${current.origin}`}>{current.origin === "reuse" ? "Reused from Q&A" : current.origin === "kb" ? "Drafted from knowledge" : "Gap"}</span>
                <span className={`conf ${current.confidence}`}>{current.confidence === "none" ? "No evidence" : `${current.confidence} confidence`}</span>
                {current.tags.map((tag) => {
                  const Icon = topicIcon(tag);
                  return <span className="tag-pill" key={tag}><Icon size={12} /> {tag}</span>;
                })}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="No approved evidence yet. Do not invent. Add a source or leave as a gap."
              />
              {error && <p className="error">{error}</p>}
              <div className="ans-actions">
                <button className="btn clean" type="button" onClick={() => decide("approve")}><Check size={15} /> Approve</button>
                <button className="btn ghost" type="button" onClick={() => decide("amend")}>Amend & approve</button>
                <button className="btn ghost" type="button" onClick={() => decide("gap")}>Mark as gap</button>
                <button className="btn warn" type="button" onClick={() => decide("reject")}><X size={15} /> Reject</button>
              </div>
            </>
          ) : <p className="muted">Select a question.</p>}
        </section>

        <aside className="ans-evidence">
          <div className="section-head"><h2>Evidence</h2></div>
          {current?.citations.map((cite) => (
            <div className="cite-card" key={cite.id}>
              <div className="toolbar">
                <strong>{cite.source_type === "qa" ? "Q&A" : kbId(cite.source_id)}</strong>
                <button className="icon-btn" type="button" onClick={() => unpin(cite.id)} aria-label="Remove"><Minus size={14} /></button>
              </div>
              <div className="cite-title">{cite.title}</div>
              <p>{cite.excerpt}</p>
            </div>
          ))}
          {!current?.citations.length && <p className="muted">Zero citations turns this into a gap.</p>}
          <button className="btn ghost" type="button" onClick={() => { setDrawer(true); searchEvidence(current?.text.slice(0, 48) || ""); }} style={{ marginTop: 12 }}>
            <Search size={14} /> Find evidence
          </button>
          {current && (current.status === "approved" || current.status === "amended") && (
            <button className="btn text" type="button" onClick={() => api.promoteQuestion(q.id, current.id)} style={{ marginTop: 8 }}>
              Save to Q&A library
            </button>
          )}
        </aside>
      </div>

      {drawer && (
        <div className="drawer-fade" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="section-head"><h2>Find evidence</h2><button className="btn text" type="button" onClick={() => setDrawer(false)}>Close</button></div>
            <input type="search" placeholder="Search approved knowledge" value={query} onChange={(e) => searchEvidence(e.target.value)} />
            <p className="faint" style={{ margin: "10px 0 14px" }}>Approved knowledge and trusted Q&A only.</p>
            {hits.map((entry) => (
              <div className="cite-card" key={entry.id}>
                <div className="toolbar">
                  <strong>{kbId(entry.id)}</strong>
                  <button className="icon-btn" type="button" onClick={() => pin("kb", entry.id, entry.passage_text || entry.body, entry.source_document)}><Plus size={14} /></button>
                </div>
                <div className="cite-title">{entry.source_document}</div>
                <p>{entry.body}</p>
              </div>
            ))}
            {qa.map((row) => (
              <div className="cite-card" key={row.id}>
                <div className="toolbar">
                  <strong>Q&A</strong>
                  <button className="icon-btn" type="button" onClick={() => pin("qa", row.id, row.answer, row.source_document)}><Plus size={14} /></button>
                </div>
                <div className="cite-title">{row.question}</div>
                <p>{row.answer}</p>
              </div>
            ))}
            {!hits.length && !qa.length && query && <p className="muted">Nothing approved matches. That is a gap — not a reason to draft.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
