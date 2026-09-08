from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from app.config import settings
from app.services.parser import ParsedDocument, ParsedParagraph
from app.services.taxonomy import suggest_tags, tag_ids


FIGURE_RE = re.compile(
    r"(\d[\d,]*(?:\.\d+)?\s*(?:%|tCO2e|tCO₂e|MWh|GWh|£[\d,.]*|\$[\d,.]*|AUM)?)",
    re.I,
)
PERIOD_RE = re.compile(
    r"(FY\s?\d{4}|20\d{2}|Q[1-4]\s?20\d{2}|annual(?:ly)?|quarter(?:ly)?)",
    re.I,
)


@dataclass
class ProposedChunk:
    entry_type: str
    body: str
    passage_text: str
    paragraph_index: int
    page_number: int
    tags: list[str]
    confidence: float
    extractor: str
    figure_value: str = ""
    figure_period: str = ""
    figure_scope: str = ""
    figure_methodology: str = ""
    extra: dict = field(default_factory=dict)


def extract_chunks(parsed: ParsedDocument) -> list[ProposedChunk]:
    if settings.anthropic_api_key:
        try:
            return extract_with_claude(parsed)
        except Exception:
            return extract_heuristic(parsed)
    return extract_heuristic(parsed)


def extractor_mode() -> str:
    return "claude" if settings.anthropic_api_key else "heuristic"


def extract_heuristic(parsed: ParsedDocument) -> list[ProposedChunk]:
    chunks: list[ProposedChunk] = []
    current_heading = parsed.title
    for para in parsed.paragraphs:
        if para.heading:
            current_heading = para.text
            continue
        text = para.text.strip()
        if len(text) < 40:
            continue
        figure = _figure_fields(text)
        tags = suggest_tags(f"{current_heading} {text}") or ["policy"]
        body = text
        if figure["value"]:
            bits = [
                f"Value: {figure['value']}" if figure["value"] else "",
                f"Period: {figure['period']}" if figure["period"] else "",
                f"Scope: {figure['scope'] or current_heading}",
                f"Methodology: {figure['methodology']}" if figure["methodology"] else "",
            ]
            body = f"{text}\n\n" + "\n".join(b for b in bits if b)
        chunks.append(
            ProposedChunk(
                entry_type="figure" if figure["value"] else "narrative",
                body=body,
                passage_text=text,
                paragraph_index=para.index,
                page_number=para.page,
                tags=tags,
                confidence=0.62 if figure["value"] else 0.55,
                extractor="heuristic",
                figure_value=figure["value"],
                figure_period=figure["period"],
                figure_scope=figure["scope"] or current_heading,
                figure_methodology=figure["methodology"],
            )
        )
    return _dedupe(chunks)


def extract_with_claude(parsed: ParsedDocument) -> list[ProposedChunk]:
    import anthropic

    allowed = sorted(tag_ids())
    catalog = [
        {"index": p.index, "heading": p.heading, "page": p.page, "text": p.text}
        for p in parsed.paragraphs
    ]
    prompt = f"""You extract reusable ESG knowledge entries from an approved source document.

Rules:
- Single-topic entries only. Do not invent facts.
- Keep figures whole: value + period + scope + methodology together.
- Tag only from this controlled list: {allowed}
- Return JSON object: {{"entries":[...]}}
- Each entry: entry_type (narrative|figure|qa), body, paragraph_index, tags[], confidence (0-1),
  figure_value, figure_period, figure_scope, figure_methodology (empty strings if unused).

Document title: {parsed.title}
Paragraphs:
{json.dumps(catalog, ensure_ascii=False)}
"""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = "".join(block.text for block in message.content if getattr(block, "type", "") == "text")
    data = _parse_json_object(raw)
    by_index = {p.index: p for p in parsed.paragraphs}
    chunks: list[ProposedChunk] = []
    for item in data.get("entries", []):
        idx = int(item.get("paragraph_index", 0))
        para: ParsedParagraph | None = by_index.get(idx)
        if not para:
            continue
        tags = [t for t in item.get("tags", []) if t in allowed] or suggest_tags(para.text)
        chunks.append(
            ProposedChunk(
                entry_type=item.get("entry_type", "narrative"),
                body=(item.get("body") or para.text).strip(),
                passage_text=para.text,
                paragraph_index=idx,
                page_number=para.page,
                tags=tags,
                confidence=float(item.get("confidence") or 0.7),
                extractor="claude",
                figure_value=item.get("figure_value") or "",
                figure_period=item.get("figure_period") or "",
                figure_scope=item.get("figure_scope") or "",
                figure_methodology=item.get("figure_methodology") or "",
            )
        )
    return _dedupe(chunks) or extract_heuristic(parsed)


def _figure_fields(text: str) -> dict[str, str]:
    value = ""
    match = FIGURE_RE.search(text)
    if match and any(ch.isdigit() for ch in match.group(1)):
        value = match.group(1).strip()
    period = ""
    pmatch = PERIOD_RE.search(text)
    if pmatch:
        period = pmatch.group(1)
    method = ""
    if "method" in text.lower() or "measured" in text.lower() or "calculated" in text.lower():
        method = text
    return {
        "value": value,
        "period": period,
        "scope": "",
        "methodology": method[:400],
    }


def _dedupe(chunks: list[ProposedChunk]) -> list[ProposedChunk]:
    seen: set[tuple[int, str]] = set()
    out: list[ProposedChunk] = []
    for chunk in chunks:
        key = (chunk.paragraph_index, chunk.body[:120])
        if key in seen:
            continue
        seen.add(key)
        out.append(chunk)
    return out


def _parse_json_object(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
    return json.loads(raw)
