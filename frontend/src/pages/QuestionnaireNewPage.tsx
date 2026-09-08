import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import ComboBox from "../components/ComboBox";
import FileField from "../components/FileField";

const TYPES = [
  { value: "ddq", label: "DDQ" },
  { value: "gresb", label: "GRESB" },
  { value: "sfdr", label: "SFDR" },
  { value: "bespoke", label: "Bespoke" },
  { value: "other", label: "Other" },
];

export default function QuestionnaireNewPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | undefined>();
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [qtype, setQtype] = useState("ddq");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reviewer = localStorage.getItem("esg-reviewer") || "Noel";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a Word questionnaire first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const row = await api.uploadQuestionnaire(file, {
        reviewer,
        title: title || file.name.replace(/\.[^.]+$/, ""),
        client,
        qtype,
        due_at: due,
        notes,
      });
      navigate(`/questionnaires/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-enter">
      <div className="page-head">
        <div>
          <h1>New questionnaire</h1>
          <p className="lead">Drafts use approved knowledge only. Gaps will be flagged, not filled.</p>
        </div>
        <Link className="btn text" to="/questionnaires">Cancel</Link>
      </div>
      <form className="card" onSubmit={onSubmit}>
        <div className="kicker">Source file</div>
        <div className="field">
          <FileField accept=".docx,.pdf" disabled={busy} onChange={(next) => {
            setFile(next);
            if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, ""));
          }} />
        </div>
        <div className="field"><input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><input type="text" placeholder="Client / requestor" value={client} onChange={(e) => setClient(e.target.value)} /></div>
        <div className="field">
          <ComboBox value={qtype} onChange={setQtype} options={TYPES} />
        </div>
        <div className="field"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="field"><textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button className="btn clean" type="submit" disabled={busy}>{busy ? "Starting…" : "Start processing"}</button>
          <Link className="btn ghost" to="/questionnaires">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
