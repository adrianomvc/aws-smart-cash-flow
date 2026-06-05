"""
Slice 12 — LLM-based categorization service.

Called only when embedding/rule confidence falls below the configured threshold.
Requires ANTHROPIC_API_KEY to be set; otherwise returns a "not configured" stub response.
"""

from __future__ import annotations


class LLMCategorizationService:
    """Use an LLM (Claude) to categorize ambiguous transactions."""

    def __init__(self, settings) -> None:
        self.settings = settings

    async def suggest_category(
        self,
        description: str,
        available_categories: list[dict],  # [{"id": str, "name": str, "path": str}]
        context_examples: list[dict] | None = None,
    ) -> tuple[str | None, float, str]:
        """Return (category_id, confidence, reason).

        When ANTHROPIC_API_KEY is not set returns a graceful stub.
        When key is set but implementation is missing raises NotImplementedError
        so callers know the feature is pending.
        """
        if not self.settings.ANTHROPIC_API_KEY:
            return None, 0.0, "LLM not configured — set ANTHROPIC_API_KEY"

        # TODO: build prompt and call Claude:
        #
        #   import anthropic
        #   client = anthropic.Anthropic(api_key=self.settings.ANTHROPIC_API_KEY)
        #
        #   categories_text = "\n".join(
        #       f'- id={c["id"]} name={c["name"]} path={c.get("path", "")}'
        #       for c in available_categories
        #   )
        #   examples_text = ""
        #   if context_examples:
        #       examples_text = "\n".join(
        #           f'  {e["description"]} -> {e["category_name"]}' for e in context_examples
        #       )
        #
        #   prompt = (
        #       f"Categorize the following financial transaction:\n"
        #       f"Description: {description}\n\n"
        #       f"Available categories:\n{categories_text}\n\n"
        #       f"Examples of already categorized transactions:\n{examples_text}\n\n"
        #       "Reply with JSON: {\"category_id\": \"<id>\", \"confidence\": 0.0-1.0, \"reason\": \"...\"}'"
        #   )
        #
        #   response = client.messages.create(
        #       model=self.settings.CATEGORIZATION_LLM_MODEL,
        #       max_tokens=256,
        #       messages=[{"role": "user", "content": prompt}],
        #   )
        #   # parse JSON from response.content[0].text
        #   ...

        raise NotImplementedError("LLM categorization not yet implemented")
