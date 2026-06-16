"""Valida o cache de analytics: cacheia leituras públicas por (workspace, args),
invalida por workspace e deixa métodos privados intactos."""

from app.services.analytics_cache import cache_public_reads, invalidate


def test_public_reads_are_cached_and_invalidated():
    invalidate()
    calls = {"n": 0}

    @cache_public_reads
    class Dummy:
        def value(self, workspace_id, x):
            calls["n"] += 1
            return f"{workspace_id}-{x}-{calls['n']}"

        def _private(self, workspace_id):
            calls["n"] += 1
            return calls["n"]

    d = Dummy()

    a = d.value("ws", 1)
    b = d.value("ws", 1)
    assert a == b
    assert calls["n"] == 1  # segunda chamada veio do cache

    c = d.value("ws", 2)  # argumento diferente -> nova chave
    assert c != a
    assert calls["n"] == 2

    d.value("other", 1)  # workspace diferente -> nova chave
    assert calls["n"] == 3

    invalidate("ws")  # invalida só "ws"
    d.value("ws", 1)
    assert calls["n"] == 4  # reconstruído
    d.value("other", 1)
    assert calls["n"] == 4  # "other" segue cacheado

    # métodos privados não são cacheados
    before = calls["n"]
    d._private("ws")
    d._private("ws")
    assert calls["n"] == before + 2
