"""
Pre-bake the ChromaDB index at deploy time.

Why: ChromaDB ships its default ONNX embedding model lazily — it's downloaded
on the FIRST query (~80MB, ~30s). On a Beanstalk EC2 cold start that means
the first user request after a redeploy / scale-up sees a huge stall.

This script runs at deploy time (via .ebextensions container_commands) so the
download + index build happens BEFORE the app accepts any traffic.

Idempotent: if the index is already built, this is a no-op.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `agents` importable when run as a script
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main() -> int:
    print("[prebake_kb] Starting...")
    try:
        from agents.knowledge_base import get_kb
    except Exception as e:
        print(f"[prebake_kb] ERROR: could not import knowledge_base: {e}")
        return 1

    try:
        kb = get_kb()
        stats = kb.stats()
        print(f"[prebake_kb] Backend: {stats['backend']}")
        print(f"[prebake_kb] Chunks loaded: {stats['chunks']}")
        print(f"[prebake_kb] By category: {stats['by_category']}")

        # Issue one warm-up query so embeddings are loaded into RAM and any
        # disk-cached artefacts are confirmed valid.
        hits = kb.retrieve("warmup query", k=1)
        print(f"[prebake_kb] Warm-up query returned {len(hits)} hit(s).")
        print("[prebake_kb] OK — index is ready.")
        return 0

    except Exception as e:
        # Don't fail the deploy — KB falls back to BM25 at runtime if needed.
        print(f"[prebake_kb] WARN: pre-bake failed ({e}). App will fall back to BM25 at runtime.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
