from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

from docx import Document as DocxDocument
from docx.shared import Pt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import AuditEvent, Document, KnowledgeEntry, QuestionAnswer, Questionnaire, utcnow
from app.services import audit
from app.services.approval import apply_decision
from app.services.answering import process_questionnaire
from app.services.pipeline import checksum_of, family_key_for, process_document


PACKS: list[dict] = [
    {
        "filename": "ESG Investment Policy 2026.docx",
        "title": "ESG Investment Policy 2026",
        "days_ago": 12,
        "owner": "Sarah",
        "attention": "",
        "review": [("Noel", "approve"), ("Noel", "approve"), ("Sarah", "amend"), ("Noel", "reject")],
        "sections": [
            ("ESG Investment Policy 2026", 1),
            (
                "Savills Investment Management integrates environmental, social and governance "
                "factors across the investment lifecycle. This policy is the approved source for "
                "client questionnaires and regulatory disclosures.",
                0,
            ),
            ("ESG governance", 2),
            (
                "Our investment committee reviews ESG risks quarterly. Material findings are "
                "escalated to the Responsible Investment Committee, which holds accountability "
                "for policy implementation and annual disclosure.",
                0,
            ),
            ("Climate strategy", 2),
            (
                "The organisation has committed to achieving net zero operational carbon by 2040 "
                "for landlord-controlled assets, with interim intensity reductions reviewed each year.",
                0,
            ),
            (
                "Carbon emissions are monitored annually across the standing portfolio. In FY 2025, "
                "like-for-like Scope 1 and 2 intensity was 28.4 tCO2e per million of AUM, calculated "
                "using location-based factors and landlord-controlled data.",
                0,
            ),
            ("Investment process", 2),
            (
                "ESG screening is completed before investment committee approval. Each new "
                "acquisition includes a climate physical-risk screen, a social due-diligence "
                "checklist, and a governance review of the operating partner.",
                0,
            ),
            ("Diversity and social", 2),
            (
                "We monitor workforce diversity annually and require property managers to adopt "
                "inclusive hiring practices. Community engagement plans are required for major developments.",
                0,
            ),
            ("Reporting", 2),
            (
                "We report to PRI, participate in GRESB, and produce SFDR-related disclosures for "
                "in-scope products. Approved questionnaire answers are reused only when the "
                "underlying source document remains current.",
                0,
            ),
        ],
    },
    {
        "filename": "Climate Strategy 2026.docx",
        "title": "Climate Strategy 2026",
        "days_ago": 4,
        "owner": "Noel",
        "attention": "",
        "review": [],
        "sections": [
            ("Climate Strategy 2026", 1),
            (
                "This strategy sets out how Savills IM identifies, prices and manages climate-related "
                "risks and opportunities across real-estate portfolios.",
                0,
            ),
            ("Physical risk", 2),
            (
                "Physical climate risk is assessed at acquisition and reviewed annually using flood, "
                "heat and storm scenarios aligned to a 1.5°C and a 4°C pathway.",
                0,
            ),
            ("Transition plans", 2),
            (
                "Material assets hold a documented transition plan covering energy performance, "
                "occupier engagement and capital expenditure through 2030.",
                0,
            ),
            ("Targets", 2),
            (
                "We target a 42% reduction in operational carbon intensity by FY2025 versus a FY2019 "
                "baseline, measured on a location-based, landlord-controlled scope.",
                0,
            ),
            (
                "Where on-site generation is not feasible, high-quality energy attribute certificates "
                "are used as a last resort and disclosed separately from operational reductions.",
                0,
            ),
        ],
    },
    {
        "filename": "SFDR Article 8 Disclosure.docx",
        "title": "SFDR Article 8 Disclosure",
        "days_ago": 20,
        "owner": "Sarah",
        "attention": "",
        "review": [("Sarah", "approve"), ("Sarah", "approve"), ("Noel", "approve"), ("Sarah", "approve")],
        "sections": [
            ("SFDR Article 8 product disclosure", 1),
            (
                "This disclosure explains how environmental and social characteristics are promoted "
                "for in-scope Savills IM products classified under SFDR Article 8.",
                0,
            ),
            ("Characteristics promoted", 2),
            (
                "The product promotes climate-risk integration, occupier wellbeing standards and "
                "minimum governance expectations of operating partners.",
                0,
            ),
            ("Do no significant harm", 2),
            (
                "Principal adverse impacts are screened before commitment. Assets that cannot meet "
                "the minimum safeguards are excluded or placed on a time-bound improvement plan.",
                0,
            ),
            ("Monitoring", 2),
            (
                "Binding elements are monitored quarterly by the Responsible Investment team and "
                "reported to investors in the periodic SFDR statement.",
                0,
            ),
        ],
    },
    {
        "filename": "Annual ESG Report 2025.docx",
        "title": "Annual ESG Report 2025",
        "days_ago": 2,
        "owner": "Noel",
        "attention": "Figure context could not be determined for two intensity metrics. Confirm scope and baseline before approval.",
        "review": [("Noel", "approve")],
        "sections": [
            ("Annual ESG Report 2025", 1),
            (
                "This report summarises portfolio performance, engagement outcomes and quantitative "
                "metrics for the year ended 31 December 2025.",
                0,
            ),
            ("Portfolio carbon", 2),
            (
                "Like-for-like Scope 1 and 2 emissions fell 8% year on year. Absolute emissions were "
                "14,620 tCO2e, covering landlord-controlled energy across the standing European portfolio.",
                0,
            ),
            ("Social metrics", 2),
            (
                "Gender representation at senior investment grade was 38% in FY2025, monitored through "
                "the annual workforce census and property-manager reporting.",
                0,
            ),
            ("GRESB", 2),
            (
                "Four core funds submitted to GRESB in 2025. Two achieved 4-star ratings. Scores are "
                "used internally to prioritise asset-level improvement plans.",
                0,
            ),
        ],
    },
]

QA_PAIRS = [
    {
        "question": "Describe your ESG governance.",
        "answer": (
            "ESG risks are reviewed by the investment committee each quarter and escalated to the "
            "Responsible Investment Committee, which is accountable for policy implementation and "
            "annual disclosure."
        ),
        "tags": ["governance"],
        "source": "ABC Pension Fund DDQ 2025 (approved)",
    },
    {
        "question": "What is your net zero target?",
        "answer": (
            "Savills IM has committed to net zero operational carbon by 2040 for landlord-controlled "
            "assets, with annual intensity reviews and asset-level transition plans for material holdings."
        ),
        "tags": ["climate"],
        "source": "GRESB 2025 (approved)",
    },
    {
        "question": "How are climate risks integrated into investment decisions?",
        "answer": (
            "Each acquisition includes a climate physical-risk screen before investment committee "
            "approval. Material holdings then carry a documented transition plan through 2030."
        ),
        "tags": ["investment-process", "climate"],
        "source": "ABC Pension Fund DDQ 2025 (approved)",
    },
    {
        "question": "How do you monitor diversity?",
        "answer": (
            "Workforce diversity is monitored annually. Property managers are required to adopt "
            "inclusive hiring practices, and community engagement plans are required for major developments."
        ),
        "tags": ["social"],
        "source": "Investor DDQ — Nordic Pension (approved)",
    },
]


def write_docx(path: Path, sections: list[tuple[str, int]]) -> None:
    doc = DocxDocument()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    for text, level in sections:
        if level:
            doc.add_heading(text, level=level)
        else:
            doc.add_paragraph(text)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))


def _ingest(db: Session, pack: dict) -> Document:
    path = settings.uploads_dir / pack["filename"].replace(" ", "-").lower()
    write_docx(path, pack["sections"])
    when = utcnow() - timedelta(days=pack["days_ago"])
    existing = db.query(Document).filter(Document.filename == pack["filename"]).first()
    if existing:
        return existing
    doc = Document(
        family_key=family_key_for(pack["filename"]),
        filename=pack["filename"],
        title=pack["title"],
        kind="docx",
        version=1,
        checksum=checksum_of(path),
        original_path=str(path),
        status="queued",
        date_ingested=when,
    )
    db.add(doc)
    db.commit()
    process_document(db, doc.id)
    doc = db.get(Document, doc.id)
    if doc:
        doc.date_ingested = when
        doc.error_message = pack.get("attention") or ""
        db.commit()
        apply_scripted_review(db, doc, pack.get("review") or [])
    return doc


def apply_scripted_review(db: Session, doc: Document, actions: list[tuple[str, str]]) -> None:
    entries = (
        db.query(KnowledgeEntry)
        .filter(KnowledgeEntry.document_id == doc.id, KnowledgeEntry.status == "proposed")
        .order_by(KnowledgeEntry.paragraph_index)
        .all()
    )
    for index, (reviewer, action) in enumerate(actions):
        if index >= len(entries):
            break
        body = entries[index].body
        if action == "amend":
            body = body.replace("the firm", "Savills IM").replace("This policy", "This approved policy")
        apply_decision(db, entries[index], action, reviewer=reviewer, body=body)
        if entries[index].approved_at:
            entries[index].approved_at = utcnow() - timedelta(days=max(1, 9 - index))
    db.commit()


def seed_extra_knowledge(db: Session, doc: Document) -> None:
    extras = [
        {
            "body": (
                "Savills IM targets net zero operational carbon by 2040 for landlord-controlled assets, "
                "supported by annual intensity monitoring and asset-level transition plans."
            ),
            "passage": "net zero operational carbon by 2040",
            "tags": ["climate", "policy"],
            "type": "narrative",
            "approver": "Sarah",
            "days": 21,
        },
        {
            "body": (
                "Climate-related risks are integrated into investment decision-making through pre-IC "
                "screening and annual portfolio review by the Responsible Investment Committee."
            ),
            "passage": "ESG screening is completed before investment committee approval",
            "tags": ["climate", "investment-process", "risk"],
            "type": "narrative",
            "approver": "Noel",
            "days": 18,
        },
        {
            "body": (
                "Value: 42%\nPeriod: FY2025 vs FY2019\nScope: Operational emissions, landlord-controlled\n"
                "Methodology: Location-based factors, like-for-like standing portfolio."
            ),
            "passage": "42% reduction in operational carbon intensity by FY2025 versus a FY2019 baseline",
            "tags": ["metrics", "climate"],
            "type": "figure",
            "approver": "Noel",
            "days": 6,
            "figure": ("42%", "FY2025", "Operational emissions", "Location-based, FY2019 baseline"),
        },
        {
            "body": (
                "The firm monitors senior investment-grade gender representation annually through the "
                "workforce census and property-manager reporting."
            ),
            "passage": "Gender representation at senior investment grade was 38% in FY2025",
            "tags": ["social"],
            "type": "narrative",
            "approver": "Sarah",
            "days": 5,
        },
    ]
    for item in extras:
        exists = (
            db.query(KnowledgeEntry)
            .filter(KnowledgeEntry.body == item["body"], KnowledgeEntry.status == "approved")
            .first()
        )
        if exists:
            continue
        figure = item.get("figure") or ("", "", "", "")
        entry = KnowledgeEntry(
            document_id=doc.id,
            entry_type=item["type"],
            body=item["body"],
            passage_text=item["passage"],
            tags=json.dumps(item["tags"]),
            paragraph_index=2,
            figure_value=figure[0],
            figure_period=figure[1],
            figure_scope=figure[2],
            figure_methodology=figure[3],
            status="approved",
            date_ingested=utcnow() - timedelta(days=item["days"] + 2),
            last_reviewed=None,
            source_document=doc.filename,
            approver=item["approver"],
            approved_at=utcnow() - timedelta(days=item["days"]),
            confidence=0.86,
            extractor="seed",
        )
        db.add(entry)
        db.flush()
        audit.record(
            db,
            "entry.approve",
            actor=item["approver"],
            document_id=doc.id,
            entry_id=entry.id,
            detail={"status": "approved", "seed": True},
        )
    db.commit()


def seed_qa(db: Session) -> None:
    if db.query(QuestionAnswer).count() >= len(QA_PAIRS):
        return
    for item in QA_PAIRS:
        row = QuestionAnswer(
            question=item["question"],
            answer=item["answer"],
            tags=json.dumps(item["tags"]),
            source_document=item["source"],
            status="approved",
            date_ingested=utcnow() - timedelta(days=30),
            last_reviewed=None,
            imported_as_trusted=1,
        )
        db.add(row)
        audit.record(db, "qa.imported", actor="Sarah", detail={"source": item["source"]})
    db.commit()


def _clear_failed_pack(db: Session) -> None:
    names = {pack["filename"] for pack in PACKS}
    failed = (
        db.query(Document)
        .filter(Document.filename.in_(names), Document.status == "failed")
        .all()
    )
    for doc in failed:
        db.query(KnowledgeEntry).filter(KnowledgeEntry.document_id == doc.id).delete()
        db.query(AuditEvent).filter(AuditEvent.document_id == doc.id).delete()
        db.delete(doc)
    if failed:
        db.commit()


def ensure_demo_pack() -> None:
    db = SessionLocal()
    try:
        _clear_failed_pack(db)
        known = {
            row.filename
            for row in db.query(Document).all()
            if row.status != "failed"
        }
        created: list[Document] = []
        for pack in PACKS:
            if pack["filename"] in known:
                continue
            created.append(_ingest(db, pack))
        policy = db.query(Document).filter(Document.filename == PACKS[0]["filename"]).first()
        if policy:
            seed_extra_knowledge(db, policy)
        seed_qa(db)
        if created:
            print(f"Demo pack ready: {len(created)} document(s) seeded.")
    except Exception as exc:
        print(f"Demo seed skipped: {exc}")
    finally:
        db.close()


DDQ_PACK = {
    "filename": "ABC Pension Fund DDQ 2026.docx",
    "title": "ABC Pension Fund DDQ 2026",
    "client": "ABC Pension Fund",
    "qtype": "ddq",
    "due_at": "2026-09-30",
    "sections": [
        ("ABC Pension Fund — ESG due diligence questionnaire", 1),
        ("Governance", 2),
        ("1. Describe your ESG governance.", 0),
        ("2. Who is accountable for responsible investment policy implementation?", 0),
        ("Climate", 2),
        ("3. What is your net zero target?", 0),
        ("4. How are climate risks integrated into investment decisions?", 0),
        ("Social", 2),
        ("5. How do you monitor diversity?", 0),
        ("6. What is your biodiversity and nature policy?", 0),
        ("Reporting", 2),
        ("7. How do you report to PRI and GRESB?", 0),
        ("8. Please describe your approach to occupier wellbeing.", 0),
    ],
}


def seed_questionnaire(db: Session) -> None:
    if db.query(Questionnaire).filter(Questionnaire.filename == DDQ_PACK["filename"]).first():
        return
    path = settings.uploads_dir / "abc-pension-ddq-2026.docx"
    write_docx(path, DDQ_PACK["sections"])
    row = Questionnaire(
        filename=DDQ_PACK["filename"],
        title=DDQ_PACK["title"],
        kind="docx",
        client=DDQ_PACK["client"],
        qtype=DDQ_PACK["qtype"],
        due_at=DDQ_PACK["due_at"],
        original_path=str(path),
        status="queued",
        date_ingested=utcnow(),
    )
    db.add(row)
    db.commit()
    process_questionnaire(db, row.id)


def ensure_sample_document() -> None:
    ensure_demo_pack()
    db = SessionLocal()
    try:
        seed_questionnaire(db)
    except Exception as exc:
        print(f"Questionnaire seed skipped: {exc}")
    finally:
        db.close()
