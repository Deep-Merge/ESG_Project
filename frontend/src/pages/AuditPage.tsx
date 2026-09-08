import {
  BadgeCheck,
  FilePlus2,
  History,
  MessagesSquare,
  MinusCircle,
  Package,
  PenLine,
  ScanText,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { kbId, prettyTime } from "../lib/format";
import type { AuditRow } from "../types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "approve", label: "Approved" },
  { id: "amend", label: "Amended" },
  { id: "reject", label: "Rejected" },
  { id: "document", label: "Documents" },
  { id: "qa", label: "Q&A" },
] as const;

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function matchesFilter(row: AuditRow, filter: string) {
  if (filter === "all") return true;
  if (filter === "document") return row.action.startsWith("document.") || row.action.includes("export");
  if (filter === "qa") return row.action.startsWith("qa.");
  return row.action.includes(filter);
}

function activityMeta(action: string): { icon: LucideIcon; tone: string; title: string } {
  if (action.includes("approve")) return { icon: BadgeCheck, tone: "ok", title: "approved a knowledge item" };
  if (action.includes("amend")) return { icon: PenLine, tone: "edit", title: "amended a proposal" };
  if (action.includes("reject")) return { icon: MinusCircle, tone: "bad", title: "rejected a proposal" };
  if (action.includes("upload")) return { icon: FilePlus2, tone: "upload", title: "uploaded a document" };
  if (action.includes("processed")) return { icon: ScanText, tone: "process", title: "finished processing" };
  if (action.includes("superseded")) return { icon: History, tone: "mute", title: "superseded an older item" };
  if (action.includes("qa")) return { icon: MessagesSquare, tone: "qa", title: "imported a Q&A pair" };
  if (action.includes("export")) return { icon: Package, tone: "export", title: "exported to SharePoint" };
  return { icon: ScanText, tone: "mute", title: action.replace(".", " ") };
}

function detailText(value: string) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      const prefer = ["file", "source", "filename", "title", "document"];
      const picked = prefer.map((key) => parsed[key]).filter((item) => typeof item === "string" && item);
      if (picked.length) return picked.join(" · ");
      return Object.values(parsed).filter((item) => typeof item === "string" && item).join(" · ");
    }
  } catch {
    return value;
  }
  return "";
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  useEffect(() => {
    api.audit().then(setRows);
  }, []);

  const counts = useMemo(() => {
    return Object.fromEntries(FILTERS.map((item) => [item.id, rows.filter((row) => matchesFilter(row, item.id)).length]));
  }, [rows]);

  const groups = useMemo(() => {
    const visible = rows.filter((row) => matchesFilter(row, filter));
    const map = new Map<string, AuditRow[]>();
    visible.forEach((row) => {
      const key = dayLabel(row.created_at);
      map.set(key, [...(map.get(key) || []), row]);
    });
    return [...map.entries()];
  }, [rows, filter]);

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="lead">Who approved what, when, and from which document.</p>
        </div>
        <div className="muted">{counts.all || 0} events</div>
      </div>

      <div className="filters">
        {FILTERS.map((item) => (
          <button key={item.id} className={item.id === filter ? "on" : ""} onClick={() => setFilter(item.id)}>
            {item.label}
            <span className="filter-count">{counts[item.id] || 0}</span>
          </button>
        ))}
      </div>

      {groups.map(([label, items]) => (
        <section className="activity-day" key={label}>
          <div className="kicker">{label}</div>
          <div className="kb-list">
            {items.map((row) => {
              const meta = activityMeta(row.action);
              const Icon = meta.icon;
              const extra = detailText(row.detail);
              return (
                <article key={row.id} className="activity-item">
                  <span className={`activity-mark ${meta.tone}`}>
                    <Icon size={18} strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="activity-copy">
                      <strong>{row.actor}</strong> {meta.title}
                    </div>
                    <div className="faint">
                      {row.entry_id && <span>{kbId(row.entry_id)}</span>}
                      {row.document_id && (
                        <>
                          {row.entry_id ? " · " : ""}
                          <Link to={`/documents/${row.document_id}`}>Source</Link>
                        </>
                      )}
                      {extra && <> · {extra}</>}
                    </div>
                  </div>
                  <time className="faint">{prettyTime(row.created_at)}</time>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!groups.length && <p className="muted">No activity in this view yet.</p>}
    </div>
  );
}
