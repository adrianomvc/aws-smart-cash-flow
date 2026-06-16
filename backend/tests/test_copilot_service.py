"""Valida o cache de contexto do copiloto (reduz egress: não refaz as varreduras
de transações a cada turno da conversa)."""

from app.services.copilot_service import CopilotService, invalidate_context_cache


def test_context_is_cached_and_invalidated(monkeypatch):
    invalidate_context_cache()  # estado limpo
    calls = {"n": 0}

    def fake_build(self, workspace_id: str) -> str:
        calls["n"] += 1
        return f"ctx-{workspace_id}-{calls['n']}"

    monkeypatch.setattr(CopilotService, "_build_context", fake_build)
    svc = CopilotService(db=None)  # type: ignore[arg-type]

    first = svc._context("ws1")
    second = svc._context("ws1")
    assert first == second  # segundo turno vem do cache
    assert calls["n"] == 1  # construído só uma vez

    # workspace diferente é cacheado separadamente
    other = svc._context("ws2")
    assert other != first
    assert calls["n"] == 2

    # invalidar (ex.: após import) força reconstrução só daquele workspace
    invalidate_context_cache("ws1")
    third = svc._context("ws1")
    assert calls["n"] == 3
    assert third != first
    # ws2 segue cacheado
    svc._context("ws2")
    assert calls["n"] == 3
