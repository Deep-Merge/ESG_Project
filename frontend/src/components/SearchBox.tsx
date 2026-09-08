import { Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { kbId } from "../lib/format";
import type { Entry } from "../types";
import Status from "./Status";

export default function SearchBox({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (compact) {
      navigate(`/knowledge?q=${encodeURIComponent(q)}`);
      return;
    }
    setBusy(true);
    try {
      setHits(await api.search(q));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "top-search" : "search-hero"}>
      <span className="icon"><Search size={16} strokeWidth={1.6} /></span>
      <form onSubmit={onSubmit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={compact ? "Search approved knowledge" : "Search approved ESG knowledge..."}
        />
      </form>
      {!compact && hits && (
        <div className="card search-results">
          <p className="faint">{busy ? "Searching…" : `${hits.length} approved knowledge items`}</p>
          {hits.map((hit) => (
            <Link key={hit.id} to={`/knowledge/${hit.id}`} className="kb-row">
              <div className="toolbar">
                <h3>{hit.body.slice(0, 90)}{hit.body.length > 90 ? "…" : ""}</h3>
                <Status value="approved" />
              </div>
              <p className="muted">{hit.body.slice(0, 180)}</p>
              <div className="faint">{kbId(hit.id)} · {hit.source_document} · {hit.tags.join(" · ")}</div>
            </Link>
          ))}
          {!hits.length && <p className="muted">No approved knowledge matched. The search never invents an answer.</p>}
        </div>
      )}
    </div>
  );
}
