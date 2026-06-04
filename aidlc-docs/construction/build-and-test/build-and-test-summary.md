# Build and Test Summary

## Pacote Atual

Planejamento e Projecao.

## Comandos Executados

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_planning_routes.py tests/test_planning_properties.py tests/test_projection_service.py tests/test_projection_properties.py
.\.venv\Scripts\python.exe -m ruff check app tests/test_planning_routes.py tests/test_planning_properties.py tests/test_projection_service.py tests/test_projection_properties.py
py -3.12 -c "import json, pathlib; [json.loads(p.read_text()) for p in pathlib.Path('contracts').rglob('*.json')]; print('json ok')"
npm run lint
npm run build
```

## Resultado

- Backend tests: passou.
- Backend lint: passou.
- Contracts JSON: passou.
- Frontend lint: passou.
- Frontend build: passou.
- API smoke local: passou.
- Browser interno: bloqueado por falha de sandbox do `node_repl`.

## Pacote Relatorios

Comandos executados:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_report_routes.py tests/test_report_service.py tests/test_report_properties.py
.\.venv\Scripts\python.exe -m ruff check app tests/test_report_routes.py tests/test_report_service.py tests/test_report_properties.py
py -3.12 -c "import json, pathlib; [json.loads(p.read_text()) for p in pathlib.Path('contracts').rglob('*.json')]; print('json ok')"
npm run lint
npm run build
```

Resultado:

- Backend report tests: passou.
- Backend report lint: passou apos ajuste de formatacao.
- Contracts JSON: passou.
- Frontend lint: passou.
- Frontend build: passou.
