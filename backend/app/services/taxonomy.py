import json
from functools import lru_cache
from pathlib import Path

from app.config import settings


@lru_cache(maxsize=1)
def _load_raw(path: str, mtime: float) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_taxonomy() -> dict:
    path = settings.taxonomy_path
    if not path.exists():
        raise FileNotFoundError(f"Taxonomy file not found: {path}")
    return _load_raw(str(path.resolve()), path.stat().st_mtime)


def all_tags() -> list[dict]:
    return load_taxonomy().get("tags", [])


def tag_ids() -> set[str]:
    return {t["id"] for t in all_tags()}


def suggest_tags(text: str, limit: int = 3) -> list[str]:
    hay = text.lower()
    scored: list[tuple[int, str]] = []
    for tag in all_tags():
        needles = [tag["id"], tag["label"].lower(), *tag.get("aliases", [])]
        hits = sum(1 for n in needles if n.lower() in hay)
        if hits:
            scored.append((hits, tag["id"]))
    scored.sort(reverse=True)
    return [tag_id for _, tag_id in scored[:limit]]


def reload() -> dict:
    _load_raw.cache_clear()
    return load_taxonomy()
