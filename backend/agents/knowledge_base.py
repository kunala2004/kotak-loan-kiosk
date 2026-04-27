"""
Knowledge base retriever for grounding LLM calls.

The KB is a folder of markdown files under backend/data/knowledge_base/,
each with YAML frontmatter for metadata (id, category, tags, etc.).

At process start we load all files, parse the frontmatter, and index them
in a ChromaDB collection backed by ONNX embeddings (no external API needed
for retrieval). LLM agents call `kb.retrieve(query, k=3, category=...)` to
pull relevant chunks before composing a prompt — this is the RAG pattern.

If ChromaDB import fails (sandboxed environment, missing native dep), we
fall back to a pure-Python BM25 implementation so the demo never breaks.
"""
from __future__ import annotations

import os
import re
import math
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from collections import Counter

KB_ROOT = Path(__file__).parent.parent / "data" / "knowledge_base"

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)
_KV_RE = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)\s*$")


@dataclass
class Chunk:
    id:       str
    category: str
    tags:     list[str]
    content:  str
    metadata: dict = field(default_factory=dict)
    score:    float = 0.0

    def render_for_prompt(self) -> str:
        return f"[{self.category}/{self.id}]\n{self.content.strip()}"


def _parse_frontmatter(raw: str) -> tuple[dict, str]:
    m = _FRONTMATTER_RE.match(raw)
    if not m:
        return {}, raw
    fm_block, body = m.group(1), m.group(2)
    meta: dict = {}
    for line in fm_block.splitlines():
        kv = _KV_RE.match(line)
        if not kv:
            continue
        key, val = kv.group(1), kv.group(2).strip()
        if val.startswith("[") and val.endswith("]"):
            items = [v.strip().strip("'\"") for v in val[1:-1].split(",") if v.strip()]
            meta[key] = items
        else:
            meta[key] = val.strip("'\"")
    return meta, body.strip()


def _load_all_chunks() -> list[Chunk]:
    if not KB_ROOT.exists():
        return []
    chunks: list[Chunk] = []
    for md_path in KB_ROOT.rglob("*.md"):
        try:
            raw = md_path.read_text(encoding="utf-8")
        except Exception:
            continue
        meta, body = _parse_frontmatter(raw)
        chunk_id = meta.get("id") or md_path.stem
        category = meta.get("category") or md_path.parent.name
        tags = meta.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        chunks.append(Chunk(
            id=chunk_id,
            category=category,
            tags=tags,
            content=body,
            metadata=meta,
        ))
    return chunks


# ── BM25 fallback ────────────────────────────────────────────────────────

_TOKEN_RE = re.compile(r"[a-z0-9]+")

def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class _BM25Index:
    """Pure-Python BM25 — no native deps. Used as fallback when ChromaDB unavailable."""

    def __init__(self, chunks: list[Chunk], k1: float = 1.5, b: float = 0.75):
        self.chunks = chunks
        self.k1, self.b = k1, b
        self.doc_tokens = [_tokenize(c.content) for c in chunks]
        self.doc_lens   = [len(d) for d in self.doc_tokens]
        self.avgdl      = sum(self.doc_lens) / max(len(self.doc_lens), 1)
        self.df: Counter = Counter()
        for tokens in self.doc_tokens:
            for tok in set(tokens):
                self.df[tok] += 1
        self.N = len(chunks)

    def _idf(self, term: str) -> float:
        n_qi = self.df.get(term, 0)
        return math.log((self.N - n_qi + 0.5) / (n_qi + 0.5) + 1.0)

    def search(self, query: str, k: int = 3, category: Optional[str] = None) -> list[Chunk]:
        q_tokens = _tokenize(query)
        scores: list[tuple[float, int]] = []
        for i, doc in enumerate(self.doc_tokens):
            if category and self.chunks[i].category != category:
                continue
            tf = Counter(doc)
            score = 0.0
            for t in q_tokens:
                if t not in tf:
                    continue
                idf = self._idf(t)
                num = tf[t] * (self.k1 + 1)
                den = tf[t] + self.k1 * (1 - self.b + self.b * self.doc_lens[i] / self.avgdl)
                score += idf * (num / den)
            if score > 0:
                scores.append((score, i))
        scores.sort(reverse=True)
        out: list[Chunk] = []
        for score, idx in scores[:k]:
            ch = self.chunks[idx]
            out.append(Chunk(
                id=ch.id, category=ch.category, tags=ch.tags,
                content=ch.content, metadata=ch.metadata, score=round(score, 3),
            ))
        return out


# ── ChromaDB primary path ────────────────────────────────────────────────

class _ChromaIndex:
    def __init__(self, chunks: list[Chunk]):
        import chromadb
        self.chunks = chunks
        # Persistent so first-run embedding cost is paid once
        persist_dir = str((Path(__file__).parent.parent / "data" / "_chroma").resolve())
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name="loan_kb",
            metadata={"hnsw:space": "cosine"},
        )
        # If collection is empty (first run), index everything
        if self.collection.count() == 0:
            self._index_all()

    def _index_all(self) -> None:
        ids       = [c.id for c in self.chunks]
        documents = [c.content for c in self.chunks]
        metadatas = [{"category": c.category, "tags": ",".join(c.tags)} for c in self.chunks]
        self.collection.add(ids=ids, documents=documents, metadatas=metadatas)

    def search(self, query: str, k: int = 3, category: Optional[str] = None) -> list[Chunk]:
        where = {"category": category} if category else None
        res = self.collection.query(
            query_texts=[query],
            n_results=k,
            where=where,
        )
        out: list[Chunk] = []
        ids       = (res.get("ids") or [[]])[0]
        docs      = (res.get("documents") or [[]])[0]
        metas     = (res.get("metadatas") or [[]])[0]
        distances = (res.get("distances") or [[]])[0]
        for cid, doc, meta, dist in zip(ids, docs, metas, distances):
            out.append(Chunk(
                id=cid,
                category=meta.get("category", ""),
                tags=(meta.get("tags") or "").split(",") if meta.get("tags") else [],
                content=doc,
                metadata=meta or {},
                score=round(1.0 - float(dist), 3),
            ))
        return out


# ── Public API ───────────────────────────────────────────────────────────

class KnowledgeBase:
    """
    Singleton wrapper. Tries ChromaDB first; falls back to BM25 if Chroma
    can't load (e.g. missing onnxruntime on a slim deploy).
    """

    def __init__(self):
        self.chunks = _load_all_chunks()
        self.backend = "none"
        self._index: _ChromaIndex | _BM25Index | None = None

        if not self.chunks:
            print("[knowledge_base] WARN: no chunks found under", KB_ROOT)
            return

        force_bm25 = os.getenv("KB_BACKEND", "").lower() == "bm25"

        if not force_bm25:
            try:
                self._index = _ChromaIndex(self.chunks)
                self.backend = "chromadb"
                print(f"[knowledge_base] ChromaDB loaded · {len(self.chunks)} chunks")
                return
            except Exception as e:
                print(f"[knowledge_base] ChromaDB unavailable ({e}) — falling back to BM25")

        self._index = _BM25Index(self.chunks)
        self.backend = "bm25"
        print(f"[knowledge_base] BM25 loaded · {len(self.chunks)} chunks")

    def retrieve(
        self,
        query: str,
        k: int = 3,
        category: Optional[str] = None,
    ) -> list[Chunk]:
        if not self._index:
            return []
        return self._index.search(query, k=k, category=category)

    def stats(self) -> dict:
        by_cat: Counter = Counter(c.category for c in self.chunks)
        return {
            "backend": self.backend,
            "chunks":  len(self.chunks),
            "by_category": dict(by_cat),
        }


# Lazy singleton — first import builds the index
_kb_instance: Optional[KnowledgeBase] = None

def get_kb() -> KnowledgeBase:
    global _kb_instance
    if _kb_instance is None:
        _kb_instance = KnowledgeBase()
    return _kb_instance


def format_chunks_for_prompt(chunks: list[Chunk]) -> str:
    """Render retrieved chunks as a single text block to inject into a prompt."""
    if not chunks:
        return "(no relevant policy context found)"
    return "\n\n".join(c.render_for_prompt() for c in chunks)
