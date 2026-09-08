import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, FileSearch, Pencil, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Status from "../components/Status";
import { reviewedCount, totalActive } from "../lib/format";
import type { Entry, ReviewBundle } from "../types";

export default function ReviewPage() {
  const { id } = useParams();
  const [bundle, setBundle] = useState<ReviewBundle | null>(null);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState("");
  const [amending, setAmending] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState("");
  const reviewer = localStorage.getItem("esg-reviewer") || "Noel";
  const focusRef = useRef<HTMLParagraphElement | null>(null);

  const load = (keepId?: string) => {
    if (!id) return;
    api.review(id).then((data) => {
      setBundle(data);
      const next = data.entries.find((e) => e.id === keepId)
        || data.entries.find((e) => e.status === "proposed")
        || data.entries[0];
      if (next) {
        setSelected(next.id);
        setDraft(next.body);
      }
    }).catch((err: Error) => setError(err.message));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected]);

  const current = bundle?.entries.find((e) => e.id === selected);
  const marked = useMemo(() => {
    const map = new Map<number, Entry[]>();
    bundle?.entries.forEach((entry) => {
      const list = map.get(entry.paragraph_index) || [];
      list.push(entry);
      map.set(entry.paragraph_index, list);
    });
    return map;
  }, [bundle]);

  function pick(entry: Entry) {
    setSelected(entry.id);
    setDraft(entry.body);
    setAmending(false);
  }

  async function decide(action: "approve" | "amend" | "reject") {
    if (!current) return;
    setError("");
    try {
      await api.reviewEntry(current.id, {
        action,
        body: action === "reject" ? undefined : draft,
        tags: current.tags,
        reviewer,
      });
      setAmending(false);
      load(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    }
  }

  if (!bundle || !current) return <p className="muted" style={{ padding: 24 }}>Loading workspace…</p>;
  const doc = bundle.document;
  const idx = current.paragraph_index;
  const prev = bundle.paragraphs.find((p) => p.index === idx - 1);
  const next = bundle.paragraphs.find((p) => p.index === idx + 1);
  const done = reviewedCount(doc);

  return (
    <div className="workspace">
      <div className="ws-head">
        <Link className="btn text" to={`/documents/${doc.id}`}><ArrowLeft size={16} /> {doc.title || doc.filename}</Link>
        <span className="muted grow">{done} / {totalActive(doc)} reviewed</span>
        {doc.marked_available && (
          <button className="btn ghost" onClick={() => api.downloadMarked(doc.id)}><Download size={15} /> Word</button>
        )}
      </div>

      <div className="ws-cols">
        <aside className="rail">
          <div className="kicker">Proposals</div>
          {bundle.entries.map((entry, i) => (
            <button key={entry.id} className={entry.id === selected ? "on" : ""} onClick={() => pick(entry)}>
              <span className={`mark ${entry.status === "approved" ? "ok" : entry.status === "rejected" ? "" : entry.id === selected ? "now" : ""}`}>
                {entry.status === "approved" ? "✓" : entry.status === "rejected" ? "✕" : entry.id === selected ? "●" : "○"}
              </span>
              <span>{String(i + 1).padStart(2, "0")} {entry.entry_type}</span>
            </button>
          ))}
        </aside>

        <section className="doc">
          <article className="doc-sheet">
            <h2>{doc.title}</h2>
            {bundle.paragraphs.map((para) => {
              const hits = marked.get(para.index) || [];
              const on = hits.some((e) => e.id === selected);
              return (
                <p
                  key={para.index}
                  ref={on ? focusRef : undefined}
                  className={`para ${para.heading ? "heading" : ""} ${hits.length ? "marked" : ""} ${on ? "on" : ""}`}
                  onClick={() => hits[0] && pick(hits[0])}
                >
                  {para.text}
                </p>
              );
            })}
          </article>
        </section>

        <aside className="inspector">
          <div className="toolbar">
            <span className="kicker">{current.entry_type}</span>
            <Status value={current.status} />
          </div>

          {current.entry_type === "figure" ? (
            <div>
              <div className="figure-hero">{current.figure_value || "—"}</div>
              <p>{current.body.split("\n")[0]}</p>
              <div className="meta-grid">
                <div><small>Period</small>{current.figure_period || "—"}</div>
                <div><small>Scope</small>{current.figure_scope || "—"}</div>
                <div><small>Method</small>{current.figure_methodology || "—"}</div>
                <div><small>Source</small>{current.source_document}</div>
              </div>
              <p className="muted">Check that scope and baseline are correct before approval.</p>
            </div>
          ) : amending || current.status === "proposed" ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <p className="knowledge-body">{current.body}</p>
          )}

          <div className="field">
            <div className="kicker">Tags</div>
            {current.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
          </div>
          <div className="field">
            <div className="kicker">Source</div>
            <p className="muted">
              {current.source_document}
              {current.page_number ? ` · Page ${current.page_number}` : ` · §${current.paragraph_index + 1}`}
            </p>
            <button className="btn text" onClick={() => setDrawer(true)}><FileSearch size={15} /> Source context</button>
          </div>

          {error && <p className="error">{error}</p>}

          {current.status === "proposed" && (
            <div className="actions">
              <button className="btn warn" onClick={() => decide("reject")}><X size={15} /> Reject</button>
              <button className="btn ghost" onClick={() => { setAmending(true); }}><Pencil size={15} /> Amend</button>
              <button className="btn brand" onClick={() => decide(amending ? "amend" : "approve")}>
                <Check size={15} /> {amending ? "Save & approve" : "Approve"}
              </button>
            </div>
          )}
        </aside>
      </div>

      {drawer && (
        <div className="drawer" onClick={() => setDrawer(false)}>
          <div className="drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="kicker">Source context</div>
            <h2 style={{ fontSize: 22 }}>{doc.title}</h2>
            <p className="muted">{current.source_document} · §{current.paragraph_index + 1}</p>
            {prev && <div className="ctx">{prev.text}</div>}
            <div className="ctx hit">{current.passage_text}</div>
            {next && <div className="ctx">{next.text}</div>}
            {doc.marked_available && (
              <button className="btn ghost" onClick={() => api.downloadMarked(doc.id)}>Open original document ↗</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
