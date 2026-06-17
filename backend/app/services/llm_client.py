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


def _provider_key(provider: str) -> str:
    if provider == "groq":
        return getattr(settings, "groq_api_key", "") or ""
    if provider == "gemini":
        return getattr(settings, "gemini_api_key", "") or ""
    return ""


def resolve_provider() -> tuple[str, str]:
    """Default provider (from LLM_PROVIDER, else auto-detected). Returns (provider, key)."""
    provider = (getattr(settings, "llm_provider", "") or "").lower()
    if not provider:
        if _provider_key("groq"):
            provider = "groq"
        elif _provider_key("gemini"):
            provider = "gemini"
    return provider, _provider_key(provider)


def _provider_chain(prefer: str | None) -> list[tuple[str, str]]:
    """Ordered (provider, key) list to try: preferred first, then the configured
    default, then the remaining provider. Only providers with a key are kept, so a
    function that prefers Gemini automatically falls back to Groq (and vice-versa)."""
    order = [(prefer or "").lower(), resolve_provider()[0], "groq", "gemini"]
    chain: list[tuple[str, str]] = []
    seen: set[str] = set()
    for provider in order:
        if not provider or provider in seen:
            continue
        seen.add(provider)
        key = _provider_key(provider)
        if key:
            chain.append((provider, key))
    return chain


def llm_available() -> bool:
    return bool(_provider_chain(None))


def chat(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int | None = None,
    json_mode: bool = False,
    timeout: float = 60,
    prefer: str | None = None,
) -> str | None:
    """Chat completion. `messages` is a list of {"role", "content"}. Tries the
    preferred provider first and falls back to the other configured one on failure
    (e.g. rate limit). Returns the assistant text, or None if all attempts fail."""
    chain = _provider_chain(prefer)
    if not chain:
        return None
    for provider, api_key in chain:
        result = _call_provider(
            provider, api_key, messages, temperature, max_tokens, json_mode, timeout
        )
        if result is not None:
            return result
    return None


def _call_provider(
    provider: str,
    api_key: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int | None,
    json_mode: bool,
    timeout: float,
) -> str | None:
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
