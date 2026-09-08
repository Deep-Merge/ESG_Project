from __future__ import annotations

import re
import zipfile
from pathlib import Path

from lxml import etree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NSMAP = {"w": W}


def parse_review_replies(path: Path) -> list[dict]:
    """Read Word comment replies: APPROVE / REJECT / AMEND: ..."""
    if path.suffix.lower() != ".docx":
        return []
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        xmls = []
        if "word/comments.xml" in names:
            xmls.append(zf.read("word/comments.xml"))
        if "word/commentsExtended.xml" in names:
            xmls.append(zf.read("word/commentsExtended.xml"))
        extras = [n for n in names if n.startswith("word/comments") and n.endswith(".xml")]
        for name in extras:
            xmls.append(zf.read(name))

    decisions: list[dict] = []
    seen: set[str] = set()
    for raw in xmls:
        root = etree.fromstring(raw)
        for comment in root.xpath(".//w:comment", namespaces=NSMAP):
            text = " ".join(comment.xpath(".//w:t/text()", namespaces=NSMAP))
            entry_id = _find_entry_id(text)
            action, body = _parse_action(text)
            if not entry_id or not action:
                continue
            key = f"{entry_id}:{action}:{body}"
            if key in seen:
                continue
            seen.add(key)
            decisions.append({"entry_id": entry_id, "action": action, "body": body})
    return decisions


def _find_entry_id(text: str) -> str:
    match = re.search(
        r"Entry ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
        text,
        re.I,
    )
    return match.group(1) if match else ""


def _parse_action(text: str) -> tuple[str, str]:
    if re.search(r"\bREJECT\b", text):
        return "reject", ""
    amend = re.search(r"AMEND:\s*(.+)$", text, re.I | re.S)
    if amend:
        return "amend", amend.group(1).strip()
    if re.search(r"\bAPPROVE\b", text) and "Reply APPROVE" not in text:
        return "approve", ""
    # Last non-instruction line that is just the verb
    compact = text.upper()
    if compact.strip().endswith("APPROVE"):
        return "approve", ""
    return "", ""
