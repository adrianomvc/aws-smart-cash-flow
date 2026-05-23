# Changelog

Este projeto usa Git tags como fonte de verdade para changelogs.

## v0.1.0 - 2026-05-23

### Added

- MVP operacional com frontend React/Vite e backend FastAPI para importar,
  consultar e classificar dados financeiros.
- Importacao de extratos TXT e faturas CSV com validacao, persistencia,
  rastreabilidade de linhas e tratamento de erros.
- Modelo canonico inicial para arquivos, importacoes, transacoes, categorias,
  regras de categorizacao, workspaces e usuarios.
- Dashboard inicial com resumo financeiro, fluxo mensal, categorias,
  estabelecimentos, qualidade de dados, recorrencias iniciais e drill-down para
  transacoes/importacoes.
- Listagem de transacoes com filtros por periodo, origem, categoria,
  subcategoria, descricao, dia da semana, importacao, ordenacao e paginacao.
- Categorias, subcategorias, classificacao manual, limpeza de categoria,
  exclusao de transacao e ajuste manual de tipo financeiro.
- Regras financeiras e de categorizacao com preview, aplicacao, direcao alvo e
  base para identificar pagamentos de fatura.
- Conciliacao inicial de pagamento de fatura por valor e janela de datas.
- Infraestrutura AWS com Amplify, Lambda, API Gateway, Terraform, tags de custo,
  guardrails iniciais e deploy automatizado.
- Backlog estruturado para indicadores de saude financeira, dashboard executivo,
  telas futuras, IA, UX, seguranca AWS e evolucao serverless.

### Changed

- Fluxo de deploy simplificado para `main`, com validacoes em branches
  `feature/**`, `codex/**`, `develop`, `main` e tags `v*`.
- Changelogs passam a ser baseados em Git tags anotadas.
- Normalizacao de descricoes evoluida para preservar dados relevantes de
  estabelecimentos, canais e marketplaces sem alterar `raw_description`.
- Dashboard e graficos ajustados para respeitar filtros, periodo de origem,
  eixos dinamicos, valores altos, saldos negativos e pagamentos de fatura sem
  dupla contagem.
- Documentacao AI-DLC/SDD ampliada com contratos, riscos, decisoes e backlog de
  evolucao.

### Fixed

- Corrigidas migracoes e aplicacao automatica no Neon antes do deploy backend.
- Corrigidos erros de schema online para colunas recentes de transacoes e regras.
- Corrigido lint do backend no CI.
- Corrigidos problemas de CORS/API Gateway, runtime Lambda e empacotamento do
  backend.
- Corrigidos fluxos de autenticacao/demo, upload sem storage remoto e erros de
  importacao em ambiente online.
- Corrigidos comportamentos de duplicidade, normalizacao, filtros de categoria e
  ordenacao/paginacao de transacoes.

### Notes

- Esta e a primeira tag historica do projeto.
- Dados financeiros reais nao devem aparecer em logs, fixtures ou release notes.
- Proximas versoes devem usar `git log <tag-anterior>..<nova-tag>` para gerar o
  historico incremental.

## Como ler mudancas

- Mudancas ainda nao tagueadas ficam no intervalo entre `HEAD` e a ultima tag.
- Mudancas publicadas devem estar associadas a uma tag anotada no formato `vX.Y.Z`.
- Release notes devem ser geradas a partir dos commits entre duas tags.

## Convencao de tags

- `v0.1.0`: primeira versao funcional ou marco de MVP.
- `v0.1.1`: correcoes pequenas sem mudanca de contrato.
- `v0.2.0`: nova fatia funcional relevante.
- `v1.0.0`: primeiro release considerado estavel.

Use tags anotadas:

```powershell
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

## Gerar changelog local

Primeira tag:

```powershell
git log --oneline --decorate
```

Entre tags:

```powershell
git log --oneline v0.1.0..v0.2.0
```

Mudancas desde a ultima tag:

```powershell
git describe --tags --abbrev=0
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

## Formato sugerido de release notes

```text
## vX.Y.Z

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Notes
- ...
```
