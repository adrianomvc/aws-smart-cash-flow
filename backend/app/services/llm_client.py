"""Shared LLM client (provider-pluggable: Groq or Gemini).

Selected by LLM_PROVIDER, or auto-detected (groq if GROQ_API_KEY set, else gemini
if GEMINI_API_KEY set). httpx verifies against the OS trust store so it works
behind a corporate TLS-inspecting proxy where the certifi bundle fails.
"""
from __future__ import annotations

import logging
import ssl

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)
_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
SSL_CONTEXT = ssl.create_default_context()


def resolve_provider() -> tuple[str, str]:
    """Returns (provider, api_key)."""
    provider = (getattr(settings, "llm_provider", "") or "").lower()
    if not provider:
        if getattr(settings, "groq_api_key", ""):
            provider = "groq"
        elif getattr(settings, "gemini_api_key", ""):
            provider = "gemini"
    if provider == "groq":
        return "groq", getattr(settings, "groq_api_key", "")
    if provider == "gemini":
        return "gemini", getattr(settings, "gemini_api_key", "")
    return provider, ""


def llm_available() -> bool:
    return bool(resolve_provider()[1])


def chat(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int | None = None,
    json_mode: bool = False,
    timeout: float = 60,
) -> str | None:
    """Chat completion. `messages` is a list of {"role", "content"}. Returns the
    assistant text, or None if no provider is configured or the call fails."""
    provider, api_key = resolve_provider()
    if not api_key:
        return None
    try:
        if provider == "groq":
            body: dict = {
                "model": getattr(settings, "groq_model", "") or "llama-3.3-70b-versatile",
                "messages": messages,
                "temperature": temperature,
            }
            if max_tokens:
                body["max_tokens"] = max_tokens
            if json_mode:
                body["response_format"] = {"type": "json_object"}
            response = httpx.post(
                _GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=body,
                timeout=timeout,
                verify=SSL_CONTEXT,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        # gemini: flatten the messages into a single prompt
        text = "\n\n".join(m["content"] for m in messages)
        config: dict = {"temperature": temperature}
        if json_mode:
            config["responseMimeType"] = "application/json"
        if max_tokens:
            config["maxOutputTokens"] = max_tokens
        response = httpx.post(
            f"{_GEMINI_URL}?key={api_key}",
            json={"contents": [{"parts": [{"text": text}]}], "generationConfig": config},
            timeout=timeout,
            verify=SSL_CONTEXT,
        )
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:
        logger.warning("LLM chat failed (%s): %s", provider, exc)
        return None
