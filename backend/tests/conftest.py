"""Garante que a suíte de testes NUNCA conecte no banco real (Neon).

Cada teste cria seu próprio engine SQLite em memória, mas o engine global de
`app.db.session` e o `create_local_tables()` do startup do FastAPI usam
`DATABASE_URL` — que, em desenvolvimento, aponta para o Neon. Sem isto, todo
`pytest` abria uma conexão com produção no startup do `TestClient` (consumindo
egress, ficando lento e quebrando quando a cota do Neon estoura).

Forçamos `DATABASE_URL` para SQLite em memória ANTES de qualquer import de `app`.
Usamos `setdefault` para não atropelar um `DATABASE_URL` já exportado no ambiente
(ex.: um CI que rode os testes contra um Postgres dedicado).
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("APP_ENV", "local")

import pytest


@pytest.fixture(autouse=True)
def _clear_analytics_cache():
    """Os caches de analytics/copiloto vivem no processo; limpamos entre testes
    para que dados de um teste nunca vazem para outro."""
    from app.services import analytics_cache, copilot_service

    analytics_cache.invalidate()
    copilot_service.invalidate_context_cache()
    yield
    analytics_cache.invalidate()
    copilot_service.invalidate_context_cache()
