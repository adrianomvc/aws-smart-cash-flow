"""Cache em processo para leituras de analytics (dashboard).

Os números de analytics só mudam quando há um novo import, então cacheamos os
resultados por workspace com um TTL curto e invalidamos no import. Isso evita
repetir varreduras de transações no banco a cada request (reduz egress).

Só é seguro para métodos que retornam estruturas serializáveis (dict/list) — NÃO
use em métodos que retornam entidades ORM ligadas a uma sessão.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from functools import wraps
from typing import Any

_TTL_SECONDS = 300.0
_store: dict[tuple, tuple[float, Any]] = {}


def invalidate(workspace_id: str | None = None) -> None:
    """Limpa o cache. Sem argumento, limpa tudo; com workspace_id, só o dele."""
    if workspace_id is None:
        _store.clear()
        return
    for key in [k for k in _store if k and k[0] == workspace_id]:
        _store.pop(key, None)


def ws_cached(method: Callable) -> Callable:
    """Cacheia um método cujo 1º argumento (após self) é o workspace_id.

    A chave é derivada de TODOS os argumentos, evitando erro de chave manual.
    Se algum argumento não for hasheável, o cache é ignorado (chama direto).
    """

    @wraps(method)
    def wrapper(self: object, workspace_id: str, *args: Any, **kwargs: Any) -> Any:
        try:
            key = (workspace_id, method.__qualname__, args, tuple(sorted(kwargs.items())))
            hash(key)
        except TypeError:
            return method(self, workspace_id, *args, **kwargs)
        now = time.monotonic()
        entry = _store.get(key)
        if entry is not None and now - entry[0] < _TTL_SECONDS:
            return entry[1]
        value = method(self, workspace_id, *args, **kwargs)
        _store[key] = (now, value)
        return value

    return wrapper


def cache_public_reads(cls: type) -> type:
    """Decorator de classe: cacheia todos os métodos públicos (não-`_`) via
    ``ws_cached``. Métodos privados (que podem retornar ORM) ficam intactos."""
    for name, attr in list(vars(cls).items()):
        if callable(attr) and not name.startswith("_"):
            setattr(cls, name, ws_cached(attr))
    return cls
