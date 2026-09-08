from pathlib import Path

from docx import Document as DocxDocument
from docx.shared import Pt

from app.config import settings
from app.database import SessionLocal
from app.models import Document
from app.services.pipeline import checksum_of, family_key_for, process_document


SAMPLE_NAME = "Responsible Investment Policy (sample).docx"


def sample_path() -> Path:
    path = settings.uploads_dir / "sample-ri-policy.docx"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def write_sample_docx(path: Path) -> None:
    doc = DocxDocument()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    doc.add_heading("Responsible Investment Policy", level=1)
    doc.add_paragraph(
        "Savills Investment Management integrates environmental, social and governance "
        "factors across the investment lifecycle. This policy sets out how the firm "
        "identifies, manages and reports ESG issues on behalf of clients."
    )
    doc.add_heading("ESG governance", level=2)
    doc.add_paragraph(
        "Our investment committee reviews ESG risks quarterly. Material findings are "
        "escalated to the Responsible Investment Committee, which holds accountability "
        "for policy implementation and annual disclosure."
    )
    doc.add_heading("Climate strategy", level=2)
    doc.add_paragraph(
        "Carbon emissions are monitored annually across the standing portfolio. "
        "In FY 2025, like-for-like Scope 1 and 2 intensity was 28.4 tCO2e per million "
        "of AUM, calculated using location-based factors and landlord-controlled data."
    )
    doc.add_paragraph(
        "We are committed to a net-zero pathway aligned with a 1.5°C scenario, with "
        "asset-level transition plans for material holdings and engagement with "
        "occupiers on operational energy performance."
    )
    doc.add_heading("Investment process", level=2)
    doc.add_paragraph(
        "ESG screening is completed before investment committee approval. Each new "
        "acquisition includes a climate physical-risk screen, a social due-diligence "
        "checklist, and a governance review of the operating partner."
    )
    doc.add_heading("Diversity and social", level=2)
    doc.add_paragraph(
        "We monitor workforce diversity annually and require property managers to "
        "adopt inclusive hiring practices. Community engagement plans are required "
        "for major developments."
    )
    doc.add_heading("Reporting", level=2)
    doc.add_paragraph(
        "We report to PRI, participate in GRESB, and produce SFDR-related disclosures "
        "for in-scope products. Approved questionnaire answers are reused only when "
        "the underlying source document remains current."
    )
    doc.save(str(path))


def ensure_sample_document() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Document).filter(Document.filename == SAMPLE_NAME).first()
        if existing:
            return
        path = sample_path()
        write_sample_docx(path)
        doc = Document(
            family_key=family_key_for(SAMPLE_NAME),
            filename=SAMPLE_NAME,
            title="Responsible Investment Policy",
            kind="docx",
            version=1,
            checksum=checksum_of(path),
            original_path=str(path),
            status="queued",
        )
        db.add(doc)
        db.commit()
        process_document(db, doc.id)
    except Exception as exc:
        print(f"Sample document seed skipped: {exc}")
    finally:
        db.close()
