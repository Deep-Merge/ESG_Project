import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import ComboBox from "../components/ComboBox";
import Status from "../components/Status";
import { kbId, prettyDate } from "../lib/format";
import type { Entry, Taxonomy } from "../types";

export default function KnowledgePage() {
  const [params] = useSearchParams();
  const initial = params.get("q") || "";
  const [q, setQ] = useState(initial);
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [rows, setRows] = useState<Entry[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.taxonomy().then(setTaxonomy);
  }, []);

  useEffect(() => {
    const run = initial ? api.search(initial) : api.entries("approved");
    run.then(setRows).catch((err: Error) => setNote(err.message));
  }, [initial]);

  async function search() {
    const hits = q ? await api.search(q) : await api.entries("approved");
    setRows(hits);
  }

  const visible = rows.filter((row) => {
    if (type !== "all" && row.entry_type !== type) return false;
    if (tag !== "all" && !row.tags.includes(tag)) return false;
    return true;
  });

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Knowledge base</h1>
          <p className="lead">Approved items only. Search meaning, not a chatbot.</p>
        </div>
        <div className="toolbar">
          <span className="muted">{visible.length} approved items</span>
          <button className="btn ghost" onClick={() => api.exportPack().then(() => setNote("SharePoint pack downloaded."))}>
            Export pack
          </button>
        </div>
      </div>
      {note && <p className="muted">{note}</p>}
      <div className="search-hero">
        <form onSubmit={(e) => { e.preventDefault(); search(); }}>
          <span className="icon"><Search size={16} strokeWidth={1.6} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search approved ESG knowledge..." />
        </form>
      </div>
      <div className="filters">
        {["all", "narrative", "figure", "qa"].map((item) => (
          <button key={item} className={item === type ? "on" : ""} onClick={() => setType(item)}>{item}</button>
        ))}
        <ComboBox
          variant="pill"
          width={180}
          value={tag}
          onChange={setTag}
          options={[
            { value: "all", label: "All topics" },
            ...(taxonomy?.tags || []).map((item) => ({ value: item.id, label: item.label })),
          ]}
        />
      </div>
      {visible.map((row) => (
        <Link key={row.id} to={`/knowledge/${row.id}`} className="kb-row">
          <div className="toolbar">
            <h3>{row.body.slice(0, 96)}{row.body.length > 96 ? "…" : ""}</h3>
            <Status value="approved" />
          </div>
          <p className="muted">{row.body}</p>
          <div className="faint">
            {kbId(row.id)} · {row.tags.join(" · ")} · {row.source_document} · Approved by {row.approver || "—"} · {prettyDate(row.approved_at)}
          </div>
        </Link>
      ))}
      {!visible.length && <p className="muted">No approved knowledge in this view yet.</p>}
    </div>
  );
}
