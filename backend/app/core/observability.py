"""Logging leve de acesso para descobrir quais endpoints mais trafegam.

Registra método, rota, status, duração e tamanho aproximado da resposta (via
Content-Length). Não loga corpo nem dados sensíveis. Em produção (Lambda) os logs
vão para o CloudWatch, ajudando a identificar os endpoints de maior payload.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

logger = logging.getLogger("scf.access")

# Rotas ruidosas e irrelevantes para análise de tráfego.
_SKIP_PATHS = {"/", "/health", "/v1/health"}


async def access_log_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    if request.url.path not in _SKIP_PATHS:
        duration_ms = (time.perf_counter() - start) * 1000.0
        size = response.headers.get("content-length", "?")
        logger.info(
            "method=%s path=%s status=%s duration_ms=%.1f approx_response_size_bytes=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            size,
        )
    return response
