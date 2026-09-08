from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy.orm import Session

from app.config import settings
from app.models import KnowledgeEntry
from app.services.serializers import entry_out


def approved_entries(db: Session) -> list[KnowledgeEntry]:
    return (
        db.query(KnowledgeEntry)
        .filter(KnowledgeEntry.status == "approved")
        .order_by(KnowledgeEntry.approved_at.desc())
        .all()
    )


def build_sharepoint_pack(db: Session) -> Path:
    rows = [entry_out(e).model_dump(mode="json") for e in approved_entries(db)]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    folder = settings.exports_dir / f"sharepoint-pack-{stamp}"
    folder.mkdir(parents=True, exist_ok=True)

    json_path = folder / "approved_entries.json"
    csv_path = folder / "approved_entries.csv"
    manifest_path = folder / "manifest.json"
    pa_path = folder / "power_automate_payload.json"
    readme_path = folder / "README.txt"

    json_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    _write_csv(csv_path, rows)
    payload = {
        "library": "ESG Knowledge Base",
        "items": [
            {
                "Title": row["id"],
                "Body": row["body"],
                "EntryType": row["entry_type"],
                "Tags": ";".join(row["tags"]),
                "SourceDocument": row["source_document"],
                "Passage": row["passage_text"],
                "Status": "approved",
                "Approver": row["approver"],
                "ApprovedAt": row["approved_at"],
                "DateIngested": row["date_ingested"],
                "LastReviewed": row["last_reviewed"],
                "FigureValue": row["figure_value"],
                "FigurePeriod": row["figure_period"],
                "FigureScope": row["figure_scope"],
                "FigureMethodology": row["figure_methodology"],
            }
            for row in rows
        ],
    }
    pa_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "approved_count": len(rows),
        "files": [
            "approved_entries.json",
            "approved_entries.csv",
            "power_automate_payload.json",
            "README.txt",
        ],
        "note": (
            "Only approved entries are included. Drop approved_entries.csv into the "
            "SharePoint library or POST power_automate_payload.json to the permitted flow."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    readme_path.write_text(
        "Savills IM ESG Knowledge Base — SharePoint export pack\n\n"
        "1. Preferred: trigger the agreed Power Automate flow with power_automate_payload.json.\n"
        "2. Fallback: import approved_entries.csv into the ESG KB SharePoint library.\n"
        "3. Proposed / rejected / superseded rows are intentionally omitted.\n",
        encoding="utf-8",
    )

    zip_path = settings.exports_dir / f"sharepoint-pack-{stamp}.zip"
    with ZipFile(zip_path, "w") as zf:
        for file in folder.iterdir():
            zf.write(file, arcname=file.name)
    return zip_path


def _write_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "id",
        "body",
        "entry_type",
        "tags",
        "source_document",
        "passage_text",
        "status",
        "approver",
        "approved_at",
        "date_ingested",
        "last_reviewed",
        "figure_value",
        "figure_period",
        "figure_scope",
        "figure_methodology",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    **{k: row.get(k, "") for k in fields},
                    "tags": ";".join(row.get("tags") or []),
                }
            )
