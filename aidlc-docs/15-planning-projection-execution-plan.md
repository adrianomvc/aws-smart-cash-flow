# Plano de Execucao: Planejamento e Projecao

## Estado AI-DLC

- **Fase**: CONSTRUCTION
- **Etapa atual**: Workflow Planning / Functional Design do novo pacote
- **Pacote anterior**: Fase 1 - Planejamento Multirepo e Produto Base
- **Pacote atual**: Planejamento e Projecao
- **Extensoes ativas**: Security Baseline e Property-Based Testing como bloqueantes

## Objetivo

Criar a primeira tela real de Planejamento / Projecao do SmartCashFlow, usando
dados existentes de fluxo de caixa, cartoes, calendario, orcamentos e metas para
mostrar uma leitura simples de risco nos proximos 30, 60 e 90 dias.

Este pacote nao deve introduzir IA, simulador completo ou microservico separado.

## Escopo Incluido

- Habilitar a navegacao para Planejamento / Projecao.
- Criar uma API de leitura para projecao financeira.
- Calcular horizontes de 30, 60 e 90 dias.
- Exibir saldo projetado, burn rate, eventos futuros e riscos principais.
- Mostrar premissas usadas no calculo.
- Criar testes unitarios e PBT para invariantes da projecao.
- Atualizar contratos em `contracts/`.

## Fora do Escopo

- Copilot financeiro conversacional.
- Simulador de compra com LLM.
- Cenarios persistentes completos.
- Extracao de `planning-service` para outro repositorio.
- Integracao bancaria em tempo real.
- Recomendacao financeira profissional.

## Requisitos Funcionais

### RF-001: Projecao por Horizonte

A API deve retornar uma lista de horizontes:

- 30 dias;
- 60 dias;
- 90 dias.

Cada horizonte deve conter:

- data final;
- entradas previstas;
- saidas previstas;
- saldo liquido projetado;
- risco textual;
- quantidade de eventos usados.

### RF-002: Premissas Explicitas

A resposta deve listar as premissas usadas:

- periodo base;
- origem dos eventos;
- uso de burn rate;
- limitacoes por falta de saldo bancario real;
- dados que ainda sao estimados.

### RF-003: Tela de Planejamento / Projecao

A tela deve mostrar:

- resumo executivo da projecao;
- cards para 30, 60 e 90 dias;
- eventos futuros relevantes;
- metas proximas;
- alertas de risco sem IA;
- bloco de premissas.

### RF-004: Navegacao Segura

A tela deve ser acessivel pela navegacao principal, mantendo as telas existentes
sem regressao visual.

## Requisitos Nao Funcionais

### Seguranca

- Todos os endpoints devem exigir autenticacao.
- Todas as leituras devem ser filtradas por `workspace_id`.
- Nenhum log deve conter nomes completos de eventos financeiros, descricoes ou
valores sensiveis em formato detalhado.
- Inputs de consulta devem ter tipo, formato e limites explicitos.

### Testes e PBT

Propriedades testaveis:

- horizonte de 60 dias nunca deve terminar antes do horizonte de 30 dias;
- horizonte de 90 dias nunca deve terminar antes do horizonte de 60 dias;
- saldo liquido projetado deve ser `entradas - saidas`;
- contagem de eventos usados nunca deve ser negativa;
- classificacao de risco deve ser deterministica para os mesmos valores;
- projecao sem eventos deve retornar totais zerados e risco coerente.

## Desenho Tecnico

### Backend

Arquivos candidatos:

- `backend/app/api/routes/planning.py`
- `backend/app/services/projection_service.py`
- `backend/tests/test_projection_service.py`
- `backend/tests/test_projection_properties.py`

Endpoint candidato:

```text
GET /v1/planning/projection?date_from=YYYY-MM-DD&horizons=30,60,90
```

### Frontend

Arquivos candidatos:

- `frontend/src/lib/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/styles.css`

Pagina candidata:

- `planning`

Rotulo de navegacao:

- `Planejamento`

### Contratos

Arquivos candidatos:

- `contracts/openapi/public-api.yaml`
- `contracts/examples/planning/projection.json`

## Gate de Entrada em Code Generation

Pode iniciar implementacao quando:

- este plano estiver criado;
- o pacote anterior estiver marcado como validado;
- nao houver duvida bloqueante de produto;
- Security Baseline e PBT estiverem refletidos no desenho.

## Definition of Done

- Endpoint de projecao implementado e testado.
- Tela de Planejamento / Projecao visivel no frontend.
- Projecao usa dados reais disponiveis ou premissas explicitamente marcadas.
- Testes PBT cobrem invariantes principais.
- Lint e build passam no escopo alterado.
- Checklist local de validacao do pacote criado.

