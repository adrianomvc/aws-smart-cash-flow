# SmartCashFlow Full Product Specification

## 1. Product Overview

SmartCashFlow é uma plataforma de controle financeiro familiar focada em fluxo de caixa, previsibilidade, saúde financeira, orçamento, metas, investimentos, patrimônio e insights com IA.

A proposta central é responder de forma simples:

> Quanto entrou? Quanto saiu? Quanto sobrou? O que vem pela frente? Posso gastar? Minha família está financeiramente saudável?

---

## 2. Core Modules

- Landing Page / Pré-login
- Dashboard Inicial / Cockpit Financeiro
- Fluxo de Caixa Analítico
- Transações
- Calendário Financeiro
- Cartões de Crédito
- Orçamentos
- Metas
- Planejamento / Projeção
- Investimentos
- Patrimônio
- Relatórios
- Insights IA
- Cenários / Simulador
- Família / Membros
- Assinaturas
- Configurações

---

## 3. Navigation

```text
Dashboard
Fluxo de Caixa
Transações
Calendário Financeiro
Cartões de Crédito
Orçamentos
Metas
Planejamento / Projeção
Investimentos
Patrimônio
Relatórios
Insights IA
Cenários / Simulador
Família / Membros
Assinaturas
Configurações
```

---

## 4. Landing Page / Pré-login

### Objetivo
Apresentar o SmartCashFlow antes do login e converter visitantes em usuários.

### Componentes
- Hero com frase forte
- Imagem/mockup do dashboard
- Benefícios principais
- Segurança e LGPD
- Controle familiar
- Insights com IA
- Planos e preços
- FAQ
- CTA: Criar conta / Entrar

### Mensagem principal

```text
Controle o fluxo de caixa da sua família com clareza, previsão e inteligência.
```

---

## 5. Dashboard Inicial / Cockpit Financeiro

### Objetivo
Dar uma visão da saúde financeira em até 15 segundos.

### Storytelling

```text
Entrou → Saiu → Sobrou → Compromissos futuros → Saldo previsto
```

### KPIs principais
- Saldo atual
- Receitas do mês
- Despesas do mês
- Fluxo líquido
- Saving Rate
- Burn Rate Atual — 30 dias
- Burn Rate Tendência — 90 dias
- Burn Rate Estrutural — 12 meses
- Runway
- Safe Spend
- Financial Health Score

### Componentes
- Cards de KPIs
- Gráfico de evolução do saldo
- Top categorias de gastos
- Próximos compromissos
- Alertas inteligentes
- Metas em andamento
- Resumo do cartão
- Sugestão da IA

### APIs
```http
GET /api/dashboard/summary
GET /api/dashboard/alerts
GET /api/dashboard/upcoming-events
```

---

## 6. Fluxo de Caixa Analítico

### Objetivo
Permitir análise detalhada de entradas, saídas e saldo acumulado.

### Componentes
- Entradas vs saídas
- Saldo acumulado
- Comparativo mensal
- Despesas fixas vs variáveis
- Receitas recorrentes
- Categorias de maior impacto
- Tendência do fluxo líquido

### APIs
```http
GET /api/cashflow
GET /api/cashflow/categories
GET /api/cashflow/comparison
```

---

## 7. Transações

### Objetivo
Gerenciar, buscar, editar e categorizar movimentações.

### Funcionalidades
- Busca por descrição
- Filtro por conta
- Filtro por cartão
- Filtro por categoria
- Filtro por período
- Editar categoria
- Dividir transação
- Marcar como recorrente
- Ignorar transação
- Exportar CSV

### APIs
```http
GET /api/transactions
PATCH /api/transactions/{id}
POST /api/transactions/bulk-update
POST /api/transactions/{id}/split
```

---

## 8. Calendário Financeiro

### Objetivo
Visualizar compromissos financeiros por data.

### Eventos
- Salário
- Contas
- Cartão
- Parcelas
- Assinaturas
- Investimentos
- Metas

### APIs
```http
GET /api/calendar/events
POST /api/calendar/events
PATCH /api/calendar/events/{id}
DELETE /api/calendar/events/{id}
```

---

## 9. Cartões de Crédito

### Objetivo
Controlar faturas, limites, vencimentos e parcelados.

### Componentes
- Fatura atual
- Limite total
- Limite usado
- Limite disponível
- Fechamento
- Vencimento
- Melhor dia de compra
- Parcelado futuro
- Gastos por categoria

### APIs
```http
GET /api/credit-cards
GET /api/credit-cards/{id}/invoice
GET /api/credit-cards/installments
```

---

## 10. Orçamentos

### Objetivo
Controlar planejado vs realizado por categoria.

### Status
- Dentro do orçamento: até 85%
- Atenção: 86% a 100%
- Estourado: acima de 100%

### APIs
```http
GET /api/budgets
POST /api/budgets
PATCH /api/budgets/{id}
DELETE /api/budgets/{id}
```

---

## 11. Metas

### Objetivo
Acompanhar objetivos financeiros da família.

### Exemplos
- Reserva de emergência
- Viagem
- Troca de carro
- Educação dos filhos
- Quitar dívida
- Investimentos

### APIs
```http
GET /api/goals
POST /api/goals
PATCH /api/goals/{id}
DELETE /api/goals/{id}
```

---

## 12. Planejamento / Projeção

### Objetivo
Projetar saldo futuro e antecipar riscos.

### Componentes
- Projeção 30 dias
- Projeção 60 dias
- Projeção 90 dias
- Projeção 12 meses
- Menor saldo previsto
- Risco de saldo negativo
- Eventos futuros relevantes

### APIs
```http
GET /api/projection
GET /api/projection/events
```

---

## 13. Investimentos

### Objetivo
Acompanhar carteira, evolução e alocação.

### Componentes
- Patrimônio investido
- Rentabilidade mensal
- Rentabilidade anual
- Alocação por classe
- Lista de ativos
- Evolução patrimonial

### APIs
```http
GET /api/investments
GET /api/investments/performance
GET /api/investments/allocation
```

---

## 14. Patrimônio

### Objetivo
Mostrar ativos, passivos e patrimônio líquido.

### Fórmula
```text
Patrimônio líquido = Ativos - Passivos
```

### APIs
```http
GET /api/net-worth
GET /api/assets
GET /api/liabilities
```

---

## 15. Relatórios

### Objetivo
Gerar relatórios consolidados e exportáveis.

### Tipos
- Fluxo de caixa
- Receitas
- Despesas
- Cartões
- Orçamentos
- Metas
- Investimentos
- Patrimônio

### Exportação
- PDF
- CSV
- XLSX

### APIs
```http
GET /api/reports
POST /api/reports/export
```

---

## 16. Insights IA

### Objetivo
Ser o assistente inteligente do fluxo de caixa familiar.

### Estrutura
```text
Insights IA
├── Overview
├── Saúde Financeira
├── Pergunte à IA
├── Simulações
├── Recomendações
└── Padrões Comportamentais
```

### Perguntas suportadas
- Como está minha saúde financeira?
- Posso gastar R$ 2.500 este mês?
- Quanto tenho livre para gastar?
- Vou ficar negativo?
- O que posso cortar?
- Vale parcelar essa compra?
- Qual impacto de reduzir delivery?

### Capacidades
- Safe Spend
- Health Score
- Simulação de compra
- Recomendação de corte
- Detecção de anomalias
- Otimização de orçamento
- Análise de assinaturas
- Chat contextual

### APIs
```http
POST /api/ai/chat
POST /api/ai/safe-spend
POST /api/ai/financial-health
POST /api/ai/simulate
POST /api/ai/optimize-budget
```

---

## 17. Cenários / Simulador

### Objetivo
Simular decisões financeiras futuras.

### Exemplos
- Comprar carro
- Viagem
- Reduzir gastos
- Aumento de renda
- Quitar dívida
- Emergência médica

### APIs
```http
GET /api/scenarios
POST /api/scenarios
PATCH /api/scenarios/{id}
DELETE /api/scenarios/{id}
POST /api/scenarios/{id}/simulate
```

---

## 18. Família / Membros

### Objetivo
Gerenciar colaboração familiar.

### Roles
- Owner
- Admin
- Member
- Viewer
- Child

### APIs
```http
GET /api/family
POST /api/family/invite
PATCH /api/family/members/{id}
DELETE /api/family/members/{id}
```

---

## 19. Assinaturas

### Objetivo
Gerenciar plano do SmartCashFlow e cobranças.

### Componentes
- Plano atual
- Histórico de faturas
- Método de pagamento
- Upgrade/downgrade
- Cancelamento

### APIs
```http
GET /api/billing/subscription
GET /api/billing/invoices
POST /api/billing/change-plan
POST /api/billing/cancel
```

---

## 20. Configurações

### Submenus
```text
Perfil
Segurança
Preferências
Categorias
Contas e Bancos
Importação de Dados
Notificações
Backup
Assinatura
Sobre o App
```

---

## 21. Preferências Financeiras

### Objetivo
Permitir personalizar regras financeiras.

### Campos
- Janela padrão de burn rate: 30d, 90d, 12m
- Método de cálculo do runway
- Reserva mínima protegida
- Política de safe spend
- Perfil de risco
- Sensibilidade do health score

### APIs
```http
GET /api/settings/financial-preferences
PATCH /api/settings/financial-preferences
```

---

## 22. Categorias, Regras e Normalização

### Estrutura
```text
Categorias
├── Categorias
├── Regras de Classificação
├── Alias / Normalização
└── Aprendizado IA
```

### Regras de Classificação
Campos:
- Nome da regra
- Condição
- Tipo de match: contains, exact, starts_with, regex
- Categoria
- Subcategoria
- Prioridade
- Ativo/inativo

### Exemplos
```text
IFOOD → Alimentação > Delivery
UBER → Transporte > Aplicativo
NETFLIX → Assinaturas > Streaming
MERCADOLIVRE → Compras
```

### Alias / Normalização
Exemplos:
```text
MERCADOLIVRE → MERCADO LIVRE
MERCADOPAG → MERCADO PAGO
99* → 99
IFD → IFOOD
AMAZONMKTPLC → AMAZON
```

### APIs
```http
GET /api/classification-rules
POST /api/classification-rules
PATCH /api/classification-rules/{id}
DELETE /api/classification-rules/{id}

GET /api/normalization-rules
POST /api/normalization-rules
PATCH /api/normalization-rules/{id}
DELETE /api/normalization-rules/{id}
```

---

## 23. Domain Model

### Entidades
- User
- Family
- FamilyMember
- Account
- BankConnection
- CreditCard
- Transaction
- Category
- ClassificationRule
- NormalizationRule
- Budget
- Goal
- Projection
- ProjectionScenario
- Investment
- Asset
- Liability
- Subscription
- Insight
- AIConversation
- AIMessage
- FinancialHealthSnapshot
- FinancialPreference
- Report
- Notification
- ImportJob

---

## 24. Regras de Negócio

### Fluxo líquido
```text
fluxo_liquido = total_entradas - total_saidas
```

### Saving Rate
```text
saving_rate = fluxo_liquido / total_entradas * 100
```

### Burn Rate
```text
burn_rate_30d = despesas_ultimos_30_dias
burn_rate_90d = media_mensal_despesas_ultimos_90_dias
burn_rate_12m = media_mensal_despesas_ultimos_12_meses
```

### Runway
```text
runway = saldo_disponivel / burn_rate_referencia
```

### Safe Spend
```text
safe_spend = saldo_atual - compromissos_futuros - reserva_minima_protegida
```

### Patrimônio líquido
```text
patrimonio_liquido = ativos - passivos
```

---

## 25. Frontend Stack

- Next.js
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- lucide-react
- Recharts
- Zustand
- TanStack Query
- React Hook Form
- Zod

---

## 26. Frontend Architecture

```text
src/
  app/
    dashboard/
    cashflow/
    transactions/
    calendar/
    cards/
    budgets/
    goals/
    planning/
    investments/
    net-worth/
    reports/
    insights/
    scenarios/
    family/
    subscriptions/
    settings/
  components/
    layout/
    cards/
    charts/
    tables/
    forms/
    feedback/
  hooks/
  services/
  stores/
  types/
  utils/
  mocks/
```

---

## 27. Estados de UI

### Loading
- Skeleton cards
- Skeleton tables
- Placeholder charts

### Empty
- Nenhuma transação encontrada
- Nenhum cartão cadastrado
- Nenhuma meta criada
- Nenhum insight disponível

### Error
- Mensagem clara
- Botão tentar novamente
- Log técnico interno

---

## 28. Roadmap

### Fase 1 — MVP
- Landing Page
- Dashboard
- Transações
- Fluxo de Caixa
- Cartões
- Calendário
- Categorias
- Contas e Bancos
- Importação de Dados

### Fase 2
- Orçamentos
- Metas
- Planejamento
- Relatórios
- Configurações avançadas

### Fase 3
- Insights IA
- Pergunte à IA
- Cenários
- Família / Membros
- Investimentos
- Patrimônio

### Fase 4
- Open Finance
- WhatsApp alerts
- Mobile app
- Automação financeira

---

## 29. Codex Build Instructions

### Prioridade
1. Criar AppShell com sidebar e header.
2. Criar design system base.
3. Criar mocks TypeScript.
4. Implementar Dashboard.
5. Implementar Transações.
6. Implementar Fluxo de Caixa.
7. Implementar Calendário.
8. Implementar Cartões.
9. Implementar Configurações.
10. Implementar Insights IA.

### Regras
- Usar TypeScript forte.
- Separar componentes visuais de regras de negócio.
- Criar services para API.
- Começar com mock API.
- Criar componentes reutilizáveis.
- Implementar loading, empty e error states.
- Garantir responsividade.
- Garantir acessibilidade básica.

---

## 30. Definition of Done

Uma tela está pronta quando:

- Layout está fiel ao design.
- Dados mockados funcionando.
- Estados loading/empty/error implementados.
- Responsivo.
- Sem erros TypeScript.
- Componentes reutilizáveis.
- Código organizado.
- Teste básico criado.

