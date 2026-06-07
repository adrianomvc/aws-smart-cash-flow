"""
Slice 11 — Embedding-based auto-categorization service.

Strategy:
  1. If ANTHROPIC_API_KEY is set: use voyage-3-lite embeddings via Anthropic API.
  2. Fallback (always available): Jaccard similarity over word tokens.
"""

from __future__ import annotations

import re


class EmbeddingService:
    """Generate embeddings and find best matching category for a transaction description."""

    def __init__(self, settings) -> None:
        self.settings = settings

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_embedding(self, text: str) -> list[float] | None:
        """Return a float vector for *text*, or None if API is unavailable.

        TODO: call Anthropic Embeddings API with self.settings.ANTHROPIC_API_KEY
              and self.settings.CATEGORIZATION_EMBEDDING_MODEL when key is set.
        """
        if not self.settings.ANTHROPIC_API_KEY:
            return None

        # TODO: implement real API call, e.g.:
        #   import anthropic
        #   client = anthropic.Anthropic(api_key=self.settings.ANTHROPIC_API_KEY)
        #   response = client.embeddings.create(
        #       model=self.settings.CATEGORIZATION_EMBEDDING_MODEL,
        #       input=[text],
        #   )
        #   return response.embeddings[0].embedding
        return None  # pragma: no cover

    def text_similarity(self, text_a: str, text_b: str) -> float:
        """Jaccard similarity over lower-cased word tokens. Always available."""
        tokens_a = self._tokenize(text_a)
        tokens_b = self._tokenize(text_b)
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        return len(intersection) / len(union)

    def find_best_category(
        self,
        description: str,
        categorized_examples: list[tuple[str, str]],  # (description, category_id)
    ) -> tuple[str | None, float]:
        """Return (category_id, confidence) for *description*.

        Uses embeddings when available, otherwise falls back to Jaccard similarity.
        The returned confidence is the highest similarity score found.
        """
        if not categorized_examples:
            return None, 0.0

        best_category_id: str | None = None
        best_score = 0.0

        for example_desc, category_id in categorized_examples:
            score = self.text_similarity(description, example_desc)
            if score > best_score:
                best_score = score
                best_category_id = category_id

        return best_category_id, best_score

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        """Lower-case and split on non-alphanumeric characters, filtering short tokens."""
        tokens = re.split(r"[^a-z0-9]+", text.lower())
        return {t for t in tokens if len(t) >= 2}
