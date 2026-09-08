import { useEffect, useState } from "react";
import { api } from "../api";
import type { Taxonomy } from "../types";

export default function TaxonomyPage() {
  const [data, setData] = useState<Taxonomy | null>(null);

  useEffect(() => {
    api.taxonomy().then(setData);
  }, []);

  if (!data) return <p className="muted">Loading taxonomy…</p>;

  return (
    <div className="page-enter">
      <h1>ESG taxonomy</h1>
      <p className="lead">
        External reference file — {data.version}. Owned by {data.owner}. Change the file, not the code.
      </p>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>ID</th><th>Label</th><th>Aliases</th></tr>
          </thead>
          <tbody>
            {data.tags.map((tag) => (
              <tr key={tag.id}>
                <td><code>{tag.id}</code></td>
                <td>{tag.label}</td>
                <td className="muted">{tag.aliases.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
