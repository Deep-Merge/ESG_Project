import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Status from "../components/Status";
import { docTitle, prettyDate } from "../lib/format";
import type { DocumentRow } from "../types";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [reviewer, setReviewer] = useState(localStorage.getItem("esg-reviewer") || "Noel");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.documents().then(setDocs).catch((err: Error) => setError(err.message));

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    localStorage.setItem("esg-reviewer", reviewer);
    setBusy(true);
    setError("");
    try {
      await api.upload(file, reviewer);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head page-enter">
        <div>
          <h1>Documents</h1>
          <p className="lead">Approved source material only. Word first, then review in place.</p>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <input type="text" value={reviewer} onChange={(e) => setReviewer(e.target.value)} style={{ maxWidth: 200 }} />
          <input type="file" accept=".docx,.pdf" onChange={(e) => onUpload(e.target.files?.[0])} disabled={busy} />
          {busy && <span className="muted">Processing…</span>}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Remaining</th>
              <th>Approved</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <Link to={`/documents/${doc.id}`}><strong>{docTitle(doc)}</strong></Link>
                  <div className="faint">{doc.filename} · v{doc.version} · {prettyDate(doc.date_ingested)}</div>
                </td>
                <td><Status value={doc.status} /></td>
                <td>{doc.proposed_count}</td>
                <td>{doc.approved_count}</td>
                <td><Link className="btn ghost" to={`/documents/${doc.id}`}>Open</Link></td>
              </tr>
            ))}
            {!docs.length && (
              <tr>
                <td colSpan={5} className="muted">
                  {error || "No documents yet. Restart the API to load the Savills demo pack, or upload a Word file."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
