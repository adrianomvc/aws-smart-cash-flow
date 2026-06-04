# Phase 1 Execution Plan

## Estado AI-DLC

- Fase: Inception
- Etapa atual: Workflow Planning
- Entrada principal: prototipos em `aidlc-docs/prototipo de telas/`
- Arquitetura alvo: `aidlc-docs/11-target-architecture-multirepo.md`
- Saida esperada: plano aprovado para iniciar Construction

## Objetivo da Fase 1

Evoluir o SmartCashFlow do MVP atual para uma base de produto alinhada ao
prototipo visual, sem quebrar o core existente de importacao, transacoes,
categorias, regras, revisao, dashboard e cartoes.

Esta fase tambem prepara o caminho multirepo, mas nao extrai microservicos ainda.

## Principios de Execucao

- Preservar o MVP funcional.
- Evitar microservicos prematuros.
- Entregar telas reais em fatias pequenas.
- Separar dados reais, dados derivados e dados mockados.
- Criar contratos antes de separar repositorios.
- Manter o frontend proximo do prototipo.
- Manter backend testado antes de mudancas estruturais maiores.

## Escopo

### Incluido

- Consolidar `aidlc-docs/` como fonte ativa de documentacao.
- Manter `aidlc-docs-bkp/` apenas como backup temporario, se o usuario quiser.
- Criar plano para futura divisao multirepo.
- Preparar pasta inicial de contratos.
- Mapear endpoints atuais por dominio.
- Evoluir a navegacao do frontend para telas do prototipo.
- Implementar primeiras telas novas com dados derivados ou mockados controlados.
- Definir criterios para entrar em Construction.

### Fora do Escopo

- Apagar `aidlc-docs-bkp/` automaticamente.
- Separar repositorios nesta fase sem aprovacao explicita.
- Criar microservicos reais.
- Introduzir LLM/Copilot em producao.
- Migrar banco de dados.
- Reescrever o frontend inteiro.
- Trocar Supabase/Auth provider agora.

## Pacotes de Trabalho

### P1. Documentacao Ativa

Objetivo:

- tornar `aidlc-docs/` a pasta oficial de trabalho.

Tarefas:

- confirmar que todos os arquivos de `aidlc-docs-bkp/` foram copiados;
- manter `11-target-architecture-multirepo.md`;
- criar este plano de execucao;
- atualizar backlog com a estrategia multirepo e Fase 1.

Criterios de aceite:

- `aidlc-docs/` contem documentos base, prototipos e plano multirepo;
- `aidlc-docs-bkp/` pode ser apagado manualmente pelo usuario;
- proximos passos estao claros.

### P2. Contratos Iniciais

Objetivo:

- preparar multirepo sem separar servicos ainda.

Estrutura proposta:

```text
contracts/
  openapi/
    public-api.yaml
  events/
    import-events.schema.json
    ledger-events.schema.json
  examples/
    imports/
    transactions/
    dashboard/
```

Tarefas:

- criar estrutura `contracts/`;
- documentar endpoints publicos atuais;
- separar dominios logicos: identity, imports, ledger, dashboard, planning;
- registrar eventos planejados, sem implementar fila ainda.

Criterios de aceite:

- existe contrato inicial versionavel;
- cada endpoint atual tem dominio dono;
- eventos planejados nao sao confundidos com funcionalidade pronta.

### P3. Mapa de Modulos Backend

Objetivo:

- preparar modularizacao interna antes de qualquer extracao.

Tarefas:

- mapear arquivos atuais para dominios;
- identificar dependencias cruzadas;
- propor nova estrutura `backend/app/modules/`;
- definir ordem segura de movimentacao.

Mapa inicial:

```text
identity:
  backend/app/api/routes/auth.py
  backend/app/core/auth.py

workspaces:
  backend/app/api/routes/workspaces.py
  backend/app/services/workspace_service.py

imports:
  backend/app/api/routes/imports.py
  backend/app/services/import_service.py
  backend/app/services/file_classifier.py
  backend/app/services/parsers.py
  backend/app/services/storage_service.py

ledger:
  backend/app/api/routes/transactions.py
  backend/app/api/routes/categories.py
  backend/app/services/categorization_service.py

dashboard:
  backend/app/api/routes/dashboard.py
  backend/app/services/dashboard_service.py

shared:
  backend/app/db/
  backend/app/core/config.py
  backend/app/api/deps.py
```

Criterios de aceite:

- nenhuma movimentacao e feita sem plano;
- testes atuais continuam sendo a rede de seguranca;
- modularizacao nao muda comportamento externo.

### P4. Primeiro Pacote Visual

Objetivo:

- aproximar o produto do prototipo com baixo risco.

Ordem recomendada:

1. Calendario financeiro.
2. Orcamentos.
3. Metas.

Motivo:

- sao telas centrais do produto familiar;
- dependem menos de IA;
- alimentam planejamento e simulador depois;
- podem comecar com dados derivados e mockados marcados como provisiorios.

Tarefas:

- adicionar os tipos de pagina no frontend;
- habilitar os itens de menu que hoje estao como `em breve`;
- criar componentes de tela seguindo os prototipos;
- reaproveitar dados existentes de transacoes, dashboard e categorias;
- usar fixtures locais apenas onde o backend ainda nao existir;
- sinalizar dados estimados/provisorios na UI.

Criterios de aceite:

- telas aparecem na navegacao;
- layout fica coerente com prototipo;
- nao quebra telas existentes;
- build frontend passa;
- dados mockados ficam isolados e faceis de remover.

### P5. Backend Minimo Para Planejamento

Objetivo:

- evitar que Calendario, Orcamentos e Metas fiquem mockados por muito tempo.

Modelos candidatos:

- `financial_calendar_events`;
- `budgets`;
- `goals`.

Endpoints candidatos:

```text
GET /v1/calendar/events
POST /v1/calendar/events
PATCH /v1/calendar/events/{id}
DELETE /v1/calendar/events/{id}

GET /v1/budgets
POST /v1/budgets
PATCH /v1/budgets/{id}
DELETE /v1/budgets/{id}

GET /v1/goals
POST /v1/goals
PATCH /v1/goals/{id}
DELETE /v1/goals/{id}
```

Criterios de aceite:

- dados sempre filtrados por `workspace_id`;
- migracoes Alembic criadas;
- testes de rotas e servicos adicionados;
- frontend consome API quando disponivel.

## Sequencia Recomendada

### Passo 1

Atualizar backlog com a decisao de Fase 1:

- multirepo planejado;
- modular monolith agora;
- contratos antes de microservicos;
- primeiro pacote visual: Calendario, Orcamentos e Metas.

### Passo 2

Criar `contracts/` inicial e mapa de endpoints atuais.

### Passo 3

Implementar telas novas no frontend com dados derivados/mockados isolados.

### Passo 4

Adicionar backend minimo de Planning:

- calendario;
- orcamentos;
- metas.

### Passo 5

Substituir mocks do frontend por API real.

### Passo 6

Reavaliar se vale iniciar modularizacao fisica do backend.

## Riscos

### R1. Criar microservicos cedo demais

Impacto:

- deploy mais complexo;
- contratos instaveis;
- velocidade menor.

Mitigacao:

- manter modular monolith ate contratos e dominios amadurecerem.

### R2. Frontend virar mock permanente

Impacto:

- produto parece pronto, mas nao entrega fluxo real.

Mitigacao:

- todo dado mockado deve ficar isolado;
- cada tela mockada deve ter plano de API correspondente.

### R3. Backend acumular mais acoplamento

Impacto:

- extracao futura fica mais dificil.

Mitigacao:

- mapear dominios antes de novas rotas;
- evitar imports cruzados entre modulos;
- criar contratos cedo.

### R4. IA entrar antes de dados confiaveis

Impacto:

- respostas pouco rastreaveis;
- risco de custo e privacidade.

Mitigacao:

- Insights IA vem depois de planejamento, metas, orcamentos e qualidade dos dados.

## Gate Para Construction

Podemos entrar em Construction quando:

- este plano estiver aceito;
- `aidlc-docs/` for confirmado como fonte ativa;
- primeira fatia de produto estiver escolhida;
- estrategia de nao extrair microservicos agora estiver aceita;
- criterio de dados mockados/derivados estiver aceito.

## Recomendacao

Entrar em Construction com o seguinte primeiro pacote:

```text
Pacote: Produto Base de Planejamento
Telas: Calendario, Orcamentos, Metas
Backend: contratos primeiro, API real em seguida
Arquitetura: modular monolith, sem microservicos ainda
```

## Observacao Sobre aidlc-docs-bkp

O conteudo de `aidlc-docs-bkp/` ja foi copiado para `aidlc-docs/`.

A partir deste ponto, o fluxo AI-DLC deve usar `aidlc-docs/`.

O diretorio `aidlc-docs-bkp/` pode ser removido pelo usuario quando ele quiser
limpar o workspace, desde que nao deseje manter uma copia historica local.
