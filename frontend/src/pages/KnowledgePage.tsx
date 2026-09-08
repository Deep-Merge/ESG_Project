import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import ComboBox from "../components/ComboBox";
import Status from "../components/Status";
import { kbId, prettyDate } from "../lib/format";
import { topicIcon } from "../lib/topics";
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

  const tagged = rows.filter((row) => tag === "all" || row.tags.includes(tag));
  const typed = rows.filter((row) => type === "all" || row.entry_type === type);
  const visible = tagged.filter((row) => type === "all" || row.entry_type === type);
  const typeCounts = {
    all: tagged.length,
    narrative: tagged.filter((row) => row.entry_type === "narrative").length,
    figure: tagged.filter((row) => row.entry_type === "figure").length,
    qa: tagged.filter((row) => row.entry_type === "qa").length,
  };
  const topicCount = (id: string) => typed.filter((row) => id === "all" || row.tags.includes(id)).length;

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
        {(["all", "narrative", "figure", "qa"] as const).map((item) => (
          <button key={item} className={item === type ? "on" : ""} onClick={() => setType(item)}>
            {item === "all" ? "All" : item === "qa" ? "Q&A" : item[0].toUpperCase() + item.slice(1)}
            <span className="filter-count">{typeCounts[item]}</span>
          </button>
        ))}
        <ComboBox
          variant="pill"
          width={240}
          value={tag}
          onChange={setTag}
          options={[
            { value: "all", label: "All topics", icon: topicIcon("all"), count: topicCount("all") },
            ...(taxonomy?.tags || []).map((item) => ({
              value: item.id,
              label: item.label,
              icon: topicIcon(item.id),
              count: topicCount(item.id),
            })),
          ]}
        />
      </div>
      <div className="kb-list">
        {visible.map((row) => (
          <Link key={row.id} to={`/knowledge/${row.id}`} className="kb-row">
            <div className="toolbar">
              <h3>{row.body.slice(0, 96)}{row.body.length > 96 ? "…" : ""}</h3>
              <Status value="approved" />
            </div>
            <p className="muted">{row.body}</p>
            <div className="topic-row">
              {row.tags.map((id) => {
                const Icon = topicIcon(id);
                const label = taxonomy?.tags.find((item) => item.id === id)?.label || id;
                return (
                  <span className="topic-chip" key={id}>
                    <Icon size={13} strokeWidth={1.6} />
                    {label}
                  </span>
                );
              })}
            </div>
            <div className="faint">
              {kbId(row.id)} · {row.source_document} · Approved by {row.approver || "—"} · {prettyDate(row.approved_at)}
            </div>
          </Link>
        ))}
        {!visible.length && <p className="muted">No approved knowledge in this view yet.</p>}
      </div>
    </div>
  );
}
