import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { activityIcon, activityLabel, prettyTime } from "../lib/format";
import type { AuditRow } from "../types";

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    api.audit().then(setRows);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, AuditRow[]>();
    rows.forEach((row) => {
      const key = dayLabel(row.created_at);
      map.set(key, [...(map.get(key) || []), row]);
    });
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="page-enter">
      <h1>Activity</h1>
      <p className="lead">Who approved what, when, and from which document. No charts.</p>
      {groups.map(([label, items]) => (
        <div key={label} style={{ marginBottom: 28 }}>
          <div className="kicker">{label}</div>
          <div className="card">
            {items.map((row) => (
              <div key={row.id} className="list-row">
                <div>
                  {activityIcon(row.action)} {row.actor} {activityLabel(row)}
                  {row.entry_id && <div className="faint">{row.entry_id.slice(0, 8)}</div>}
                </div>
                <span className="faint">{prettyTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
