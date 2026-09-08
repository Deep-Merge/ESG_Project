from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

from lxml import etree

from app.models import KnowledgeEntry

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NSMAP = {"w": W, "r": R}


def markup_docx(source: Path, dest: Path, entries: list[KnowledgeEntry]) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source, "r") as zin:
        parts = {name: zin.read(name) for name in zin.namelist()}

    doc_xml = etree.fromstring(parts["word/document.xml"])
    paragraphs = doc_xml.xpath(".//w:body/w:p", namespaces=NSMAP)
    usable = [p for p in paragraphs if _para_text(p).strip()]

    comments_root = etree.Element(f"{{{W}}}comments", nsmap={"w": W})
    comment_id = 1
    for entry in entries:
        if entry.paragraph_index >= len(usable):
            continue
        para = usable[entry.paragraph_index]
        _highlight_paragraph(para)
        _wrap_comment(para, comment_id)
        comments_root.append(_comment_element(comment_id, entry))
        entry.comment_id = comment_id
        comment_id += 1

    parts["word/document.xml"] = etree.tostring(doc_xml, xml_declaration=True, encoding="UTF-8")
    parts["word/comments.xml"] = etree.tostring(comments_root, xml_declaration=True, encoding="UTF-8")
    parts["[Content_Types].xml"] = _ensure_content_types(parts["[Content_Types].xml"])
    rels_name = "word/_rels/document.xml.rels"
    parts[rels_name] = _ensure_comments_rel(parts.get(rels_name, _empty_rels()))

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, data in parts.items():
            zout.writestr(name, data)
    dest.write_bytes(buffer.getvalue())
    return dest


def _para_text(para) -> str:
    return "".join(para.xpath(".//w:t/text()", namespaces=NSMAP))


def _highlight_paragraph(para) -> None:
    for run in para.xpath("./w:r", namespaces=NSMAP):
        rpr = run.find(f"{{{W}}}rPr")
        if rpr is None:
            rpr = etree.Element(f"{{{W}}}rPr")
            run.insert(0, rpr)
        highlight = rpr.find(f"{{{W}}}highlight")
        if highlight is None:
            highlight = etree.SubElement(rpr, f"{{{W}}}highlight")
        highlight.set(f"{{{W}}}val", "yellow")


def _wrap_comment(para, comment_id: int) -> None:
    start = etree.Element(f"{{{W}}}commentRangeStart")
    start.set(f"{{{W}}}id", str(comment_id))
    end = etree.Element(f"{{{W}}}commentRangeEnd")
    end.set(f"{{{W}}}id", str(comment_id))
    ref_run = etree.Element(f"{{{W}}}r")
    rpr = etree.SubElement(ref_run, f"{{{W}}}rPr")
    etree.SubElement(rpr, f"{{{W}}}rStyle").set(f"{{{W}}}val", "CommentReference")
    ref = etree.SubElement(ref_run, f"{{{W}}}commentReference")
    ref.set(f"{{{W}}}id", str(comment_id))
    children = list(para)
    # Keep paragraph properties first
    insert_at = 1 if children and children[0].tag == f"{{{W}}}pPr" else 0
    para.insert(insert_at, start)
    para.append(end)
    para.append(ref_run)


def _comment_element(comment_id: int, entry: KnowledgeEntry):
    comment = etree.Element(f"{{{W}}}comment")
    comment.set(f"{{{W}}}id", str(comment_id))
    comment.set(f"{{{W}}}author", "ESG Knowledge Base")
    comment.set(f"{{{W}}}initials", "ESG")
    tags = entry.tags.replace('"', "")
    lines = [
        f"Proposed knowledge [{entry.entry_type}]",
        f"Tags: {tags}",
        f"Entry ID: {entry.id}",
        "",
        "Reply APPROVE, REJECT, or AMEND: <edited text>",
        "",
        entry.body[:1500],
    ]
    para = etree.SubElement(comment, f"{{{W}}}p")
    run = etree.SubElement(para, f"{{{W}}}r")
    text = etree.SubElement(run, f"{{{W}}}t")
    text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    text.text = "\n".join(lines)
    return comment


def _ensure_content_types(raw: bytes) -> bytes:
    root = etree.fromstring(raw)
    existing = root.xpath(
        "//*[local-name()='Override' and contains(@PartName, '/word/comments.xml')]"
    )
    if not existing:
        override = etree.SubElement(root, f"{{{CT}}}Override")
        override.set("PartName", "/word/comments.xml")
        override.set(
            "ContentType",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml",
        )
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8")


def _empty_rels() -> bytes:
    return (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    )


def _ensure_comments_rel(raw: bytes) -> bytes:
    rels_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
    root = etree.fromstring(raw)
    for rel in root:
        target = rel.get("Target", "")
        if target.endswith("comments.xml"):
            return raw
    ids = [int(rel.get("Id", "rId0").replace("rId", "") or 0) for rel in root]
    next_id = max(ids or [0]) + 1
    rel = etree.SubElement(root, f"{{{rels_ns}}}Relationship")
    rel.set("Id", f"rId{next_id}")
    rel.set(
        "Type",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
    )
    rel.set("Target", "comments.xml")
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8")
