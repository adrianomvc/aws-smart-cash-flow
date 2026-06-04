# Plano de Execucao: Relatorios

## Estado AI-DLC

- **Fase**: CONSTRUCTION
- **Etapa atual**: Workflow Planning / Functional Design do novo pacote
- **Pacote anterior**: Planejamento e Projecao
- **Pacote atual**: Relatorios
- **Extensoes ativas**: Security Baseline e Property-Based Testing como bloqueantes

## Objetivo

Criar a primeira tela real de Relatorios do SmartCashFlow, usando leituras e
agregados ja existentes para consolidar uma visao exportavel no futuro.

Este pacote nao deve implementar exportacao PDF, CSV ou XLSX ainda.

## Escopo Incluido

- Habilitar a navegacao para Relatorios.
- Criar uma API de leitura para relatorios consolidados.
- Consolidar secoes de fluxo de caixa, receitas, despesas, cartoes, orcamentos,
  metas e qualidade de dados.
- Exibir periodo, status dos dados e origem dos calculos.
- Atualizar contratos em `contracts/`.
- Criar testes automatizados focados.

## Fora do Escopo

- Exportacao PDF.
- Exportacao CSV.
- Exportacao XLSX.
- Agendamento de relatorios.
- Relatorios compartilhados por email.
- Relatorios de investimentos e patrimonio com dados reais.

## Requisitos Funcionais

### RF-001: Lista de Relatorios

A API deve retornar os relatorios disponiveis no MVP:

- resumo executivo;
- fluxo de caixa;
- receitas;
- despesas;
- cartoes;
- orcamentos;
- metas;
- qualidade dos dados.

### RF-002: Secoes Consolidadas

Cada relatorio deve informar:

- identificador;
- titulo;
- descricao;
- status;
- metrica principal;
- metrica auxiliar;
- rota ou tela relacionada.

### RF-003: Tela de Relatorios

A tela deve mostrar:

- cards de relatorios disponiveis;
- resumo do periodo;
- qualidade dos dados;
- estado de exportacao como `em breve`;
- atalhos para telas relacionadas quando aplicavel.

## Requisitos Nao Funcionais

### Seguranca

- Todos os endpoints devem exigir autenticacao.
- Todas as leituras devem ser filtradas por `workspace_id`.
- Nenhum payload financeiro sensivel deve ser registrado em logs.
- Query params devem ter tipo, formato e limites explicitos.

### Testes e PBT

Propriedades candidatas:

- relatorio gerado deve ter ids unicos;
- contadores de relatorios nunca devem ser negativos;
- status deve pertencer a uma lista controlada;
- ordenacao de relatorios deve ser deterministica.

## Desenho Tecnico

### Backend

Arquivos candidatos:

- `backend/app/api/routes/reports.py`
- `backend/app/services/report_service.py`
- `backend/tests/test_report_service.py`
- `backend/tests/test_report_properties.py`

Endpoint candidato:

```text
GET /v1/reports?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

### Frontend

Arquivos candidatos:

- `frontend/src/lib/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/styles.css`

Pagina candidata:

- `reports`

Rotulo de navegacao:

- `Relatorios`

### Contratos

Arquivos candidatos:

- `contracts/openapi/public-api.yaml`
- `contracts/examples/reports/list.json`

## Gate de Entrada em Code Generation

Pode iniciar implementacao quando:

- este plano estiver criado;
- o pacote anterior estiver marcado como validado;
- a exportacao real estiver confirmada como fora do escopo;
- Security Baseline e PBT estiverem refletidos no desenho.

## Definition of Done

- Endpoint de relatorios implementado e testado.
- Tela de Relatorios visivel no frontend.
- Relatorios usam dados reais ja disponiveis ou indicam claramente limitacoes.
- Exportacao aparece como futura, sem prometer arquivo pronto.
- Lint e build passam no escopo alterado.
- Checklist local de validacao do pacote criado.

