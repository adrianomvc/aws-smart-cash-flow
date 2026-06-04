# SmartCashFlow — Full Product Specification

## 1. Visão do Produto

O SmartCashFlow é uma plataforma de controle financeiro familiar criada para consolidar contas, cartões, transações, orçamentos, metas, patrimônio, investimentos e projeções em uma experiência única.

A proposta principal é transformar dados financeiros em uma narrativa clara:

> Quanto entrou? Quanto saiu? Quanto sobrou? O que vem pela frente? Vamos ficar bem?

O produto deve ir além de um extrato bonito. Ele precisa ajudar a família a tomar decisões melhores, prever riscos e entender a saúde financeira com clareza.

---

## 2. Princípios do Produto

- Storytelling financeiro acima de tabelas frias.
- Previsão antes de reação.
- Controle familiar, não apenas individual.
- IA explicável, com recomendações claras.
- Redução de ansiedade financeira.
- Visão executiva em poucos segundos.
- Drill-down para análise detalhada.
- UX moderna, limpa, premium e responsiva.
- Segurança e privacidade por padrão.
- Suporte ao comportamento financeiro brasileiro: PIX, cartão, parcelamento, vencimentos, faturas e múltiplas contas.

---

## 3. Stack Recomendada

### Frontend

- Next.js 15
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- lucide-react
- Recharts
- React Hook Form
- Zod
- TanStack Query
- Zustand

### Backend

- FastAPI ou AWS Lambda
- API Gateway
- Supabase/Postgres ou DynamoDB
- S3 para armazenamento de arquivos
- Jobs assíncronos para processamento de extratos

### IA

- Camada abstrata para OpenAI, Bedrock ou outro provedor
- Embeddings para similaridade de descrições
- Motor de insights financeiros
- Detecção de anomalias
- Classificação de transações
- Simulação de cenários

---

## 4. Arquitetura de Informação

Menu principal:

1. Dashboard
2. Fluxo de Caixa
3. Transações
4. Calendário Financeiro
5. Cartões de Crédito
6. Orçamentos
7. Metas
8. Planejamento / Projeção
9. Investimentos
10. Patrimônio
11. Relatórios
12. Insights IA
13. Cenários / Simulador
14. Família / Membros
15. Assinaturas
16. Configurações

Subitens de Configurações:

1. Perfil
2. Segurança
3. Preferências
4. Categorias
5. Contas e Bancos
6. Importação de Dados
7. Notificações
8. Backup e Sincronização
9. Assinatura e Plano
10. Sobre o App

---

## 5. Design System

### Estilo Visual

- Sidebar escura em roxo/azul profundo
- Área principal clara
- Cards brancos com borda suave
- Cantos arredondados
- Ícones coloridos
- Tipografia limpa
- Espaçamento generoso
- Gráficos leves e modernos

### Cores

- Primary: roxo
- Success: verde
- Danger: vermelho
- Warning: laranja/amarelo
- Info: azul
- Neutral: cinza claro

### Componentes reutilizáveis

- AppShell
- Sidebar
- HeaderBar
- KPI Card
- Insight Card
- Chart Card
- Data Table
- Empty State
- Loading Skeleton
- Error State
- Filter Bar
- Donut Chart
- Line Chart
- Bar Chart
- Progress Bar
- Timeline
- Modal
- Drawer
- Form Card

---

## 6. Modelo de Domínio

### Entidades principais

- User
- Family
- FamilyMember
- Account
- BankConnection
- CreditCard
- Transaction
- Category
- Budget
- Goal
- Projection
- ProjectionScenario
- Investment
- Asset
- Liability
- Subscription
- Insight
- Notification
- Report
- ImportJob

### Relacionamentos

- Uma família possui vários membros.
- Um membro pode ter diferentes permissões.
- Uma família possui várias contas e cartões.
- Transações pertencem a contas ou cartões.
- Categorias classificam receitas e despesas.
- Orçamentos são definidos por categoria.
- Metas possuem valor alvo, valor acumulado e previsão.
- Cenários simulam mudanças futuras no fluxo.
- Insights são gerados a partir de transações, orçamentos, metas e projeções.

---

# 7. Especificação das Telas

## 7.1 Dashboard Inicial / Cockpit Financeiro

### Objetivo

Dar uma visão geral da saúde financeira da família em menos de 15 segundos.

### Storytelling principal

Fluxo narrativo:

```text
Entrou → Saiu → Sobrou → Compromissos futuros → Saldo previsto
```

### Componentes

- Header com saudação e período.
- Cards de KPIs:
  - Saldo atual
  - Fluxo líquido do mês
  - Receitas
  - Despesas
  - Saving rate
  - Percentual de comprometimento
  - Runway financeiro
- Gráfico de evolução do saldo.
- Próximos compromissos.
- Top categorias de gastos.
- Orçamentos do mês.
- Metas em andamento.
- Insights e alertas.
- Banner de dica personalizada.

### APIs

```http
GET /api/dashboard/summary
GET /api/dashboard/story
GET /api/dashboard/alerts
GET /api/dashboard/upcoming-events
```

---

## 7.2 Fluxo de Caixa — Visão Analítica

### Objetivo

Permitir análise detalhada das entradas, saídas e saldo acumulado.

### Componentes

- Cards:
  - Entradas
  - Saídas
  - Fluxo líquido
  - Saldo inicial
  - Saldo final
- Gráfico principal:
  - Barras de entrada
  - Barras de saída
  - Linha de saldo acumulado
  - Linha projetada
- Resumo do período.
- Entradas vs saídas.
- Entradas por categoria.
- Saídas por categoria.
- Análise comparativa.
- Sazonalidade.

### APIs

```http
GET /api/cashflow
GET /api/cashflow/categories
GET /api/cashflow/comparison
GET /api/cashflow/seasonality
```

---

## 7.3 Transações

### Objetivo

Permitir consulta, busca, edição e categorização de todas as movimentações.

### Componentes

- KPIs:
  - Total de entradas
  - Total de saídas
  - Fluxo líquido
  - Ticket médio
  - Maior despesa
- Barra de busca.
- Filtros:
  - Conta
  - Categoria
  - Tipo
  - Status
  - Período
- Sidebar interna com categorias.
- Tabela de transações:
  - Data
  - Descrição
  - Categoria
  - Conta/cartão
  - Tipo
  - Valor
  - Status
  - Ações
- Paginação.
- Banner de insight.

### Funcionalidades

- Editar categoria.
- Dividir transação.
- Marcar como recorrente.
- Ignorar transação.
- Exportar CSV.
- Corrigir descrição normalizada.

### APIs

```http
GET /api/transactions
PATCH /api/transactions/{id}
POST /api/transactions/bulk-update
POST /api/transactions/{id}/split
```

---

## 7.4 Calendário Financeiro

### Objetivo

Visualizar compromissos financeiros por data.

### Componentes

- Cards:
  - Entradas previstas
  - Saídas previstas
  - Cartão de crédito
  - Saldo previsto
  - Compromissos futuros
- Filtros:
  - Todos
  - Entradas
  - Contas
  - Cartão
  - Parcelas
  - Assinaturas
  - Investimentos
- Calendário mensal.
- Painel lateral:
  - Próximos compromissos
  - Resumo do mês
  - Dica da IA

### APIs

```http
GET /api/calendar/events
POST /api/calendar/events
PATCH /api/calendar/events/{id}
DELETE /api/calendar/events/{id}
```

---

## 7.5 Cartões de Crédito

### Objetivo

Controlar faturas, limites, vencimentos e parcelados.

### Componentes

- Cards:
  - Fatura atual
  - Limite total
  - Limite utilizado
  - Parcelado futuro
  - Gastos no mês
  - Melhor dia de compra
- Lista de cartões:
  - Banco
  - Final
  - Fatura atual
  - Limite utilizado
  - Vencimento
  - Próxima fatura
- Gráfico de gastos por categoria.
- Lista de parcelas futuras.
- Gráfico de utilização do limite.
- Insights do mês.

### APIs

```http
GET /api/credit-cards
GET /api/credit-cards/{id}/invoice
GET /api/credit-cards/installments
```

---

## 7.6 Orçamentos

### Objetivo

Acompanhar planejado vs realizado por categoria.

### Componentes

- Cards:
  - Orçamento total
  - Gasto até agora
  - Restante
  - Previsto até o fim do mês
  - Estouro de orçamento
- Tabela:
  - Categoria
  - Orçamento
  - Gasto atual
  - Percentual utilizado
  - Restante
  - Status
- Distribuição do orçamento.
- Alertas e recomendações.

### Regras

- Status "Dentro": até 85%.
- Status "Atenção": 86% a 100%.
- Status "Estourado": acima de 100%.

### APIs

```http
GET /api/budgets
POST /api/budgets
PATCH /api/budgets/{id}
DELETE /api/budgets/{id}
```

---

## 7.7 Metas

### Objetivo

Acompanhar objetivos financeiros da família.

### Componentes

- Cards:
  - Total de metas
  - Valor total das metas
  - Total acumulado
  - Aporte mensal necessário
  - Projeção de conclusão
- Lista de metas:
  - Nome
  - Categoria
  - Progresso
  - Valor acumulado
  - Previsão
- Resumo das metas.
- Metas por status.
- Próximas metas para concluir.
- Insight inteligente.

### APIs

```http
GET /api/goals
POST /api/goals
PATCH /api/goals/{id}
DELETE /api/goals/{id}
```

---

## 7.8 Planejamento / Projeção

### Objetivo

Projetar o saldo futuro e antecipar riscos.

### Componentes

- Cards:
  - Saldo atual
  - Saldo projetado em 30 dias
  - Menor saldo previsto
  - Saldo projetado em 90 dias
  - Entradas previstas
  - Saídas previstas
- Gráfico de saldo projetado.
- Resumo da projeção.
- Índice de saúde financeira.
- Principais eventos futuros.
- Cenários rápidos:
  - Otimista
  - Realista
  - Pessimista

### APIs

```http
GET /api/projection
GET /api/projection/events
```

---

## 7.9 Investimentos

### Objetivo

Acompanhar patrimônio investido e performance.

### Componentes

- Cards:
  - Patrimônio investido
  - Rentabilidade no mês
  - Rentabilidade no ano
  - Rentabilidade total
  - Meta de investimentos
- Gráfico de evolução do patrimônio.
- Distribuição da carteira.
- Tabela de investimentos.
- Comparativo com benchmark.
- Objetivos financeiros.
- Insights.

### APIs

```http
GET /api/investments
GET /api/investments/performance
GET /api/investments/allocation
```

---

## 7.10 Patrimônio

### Objetivo

Mostrar visão completa de ativos, passivos e patrimônio líquido.

### Componentes

- Cards:
  - Patrimônio líquido
  - Total de ativos
  - Total de passivos
  - Ativos/passivos
  - Meta de patrimônio
- Evolução do patrimônio líquido.
- Composição dos ativos.
- Composição dos passivos.
- Lista de ativos.
- Lista de passivos.
- Resumo financeiro.
- Insights do mês.

### APIs

```http
GET /api/net-worth
GET /api/assets
GET /api/liabilities
```

---

## 7.11 Relatórios

### Objetivo

Gerar análises consolidadas e exportáveis.

### Componentes

- Tabs:
  - Visão geral
  - Receitas
  - Despesas
  - Fluxo de caixa
  - Investimentos
  - Patrimônio
  - Orçamentos
  - Metas
  - Cartões
- KPIs:
  - Receitas totais
  - Despesas totais
  - Resultado do período
  - Taxa de poupança
- Gráficos:
  - Resumo financeiro
  - Despesas por categoria
  - Fluxo de caixa waterfall
  - Receitas vs despesas
- Relatórios salvos.
- Exportação PDF, CSV e Excel.

### APIs

```http
GET /api/reports
POST /api/reports
POST /api/reports/export
```

---

## 7.12 Insights IA

### Objetivo

Ser o copiloto financeiro da família.

### Componentes

- Score financeiro.
- Tendência geral.
- Maior oportunidade.
- Risco de saldo negativo.
- Previsão de sobra.
- Lista de insights priorizados.
- Análise inteligente de gastos.
- Padrões identificados.
- Campo "Pergunte para a IA".

### Tipos de insight

- Gasto acima da média.
- Assinatura não utilizada.
- Risco de saldo negativo.
- Categoria fora do orçamento.
- Oportunidade de economia.
- Padrão de comportamento.
- Melhor dia de compra.
- Comparação com meses anteriores.

### APIs

```http
GET /api/insights
POST /api/insights/refresh
POST /api/ai/ask
```

---

## 7.13 Cenários / Simulador

### Objetivo

Simular decisões financeiras futuras.

### Componentes

- Lista de cenários:
  - Base
  - Redução de gastos
  - Aumento de renda
  - Viagem
  - Compra de carro
- Cards:
  - Saldo projetado
  - Total de entradas
  - Total de saídas
  - Saldo médio mensal
- Gráfico de evolução projetada.
- Comparação entre cenários.
- Premissas:
  - Receitas
  - Despesas
  - Investimentos
  - Eventos programados
- Insights do cenário.

### APIs

```http
GET /api/scenarios
POST /api/scenarios
PATCH /api/scenarios/{id}
DELETE /api/scenarios/{id}
POST /api/scenarios/{id}/simulate
```

---

## 7.14 Família / Membros

### Objetivo

Gerenciar membros, permissões e participação familiar.

### Componentes

- Cards:
  - Membros ativos
  - Permissões de administrador
  - Participação média
  - Decisões em conjunto
  - Plano familiar
- Tabela de membros:
  - Nome
  - Função
  - Acesso
  - Participação
  - Desde
  - Ações
- Participação nas finanças.
- Resumo de acessos.
- Atividades recentes.
- Dicas para gestão em família.

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

## 7.15 Assinaturas

### Objetivo

Controlar plano do SmartCashFlow e também pode servir como base para recorrências no produto.

### Componentes

- Plano atual.
- Cards de planos:
  - Básico
  - Premium
  - Family
- Comparativo de recursos.
- Histórico de faturamento.
- Método de pagamento.
- Outras ações:
  - Aplicar cupom
  - Cancelar assinatura
  - Baixar nota fiscal
  - Central de ajuda

### APIs

```http
GET /api/billing/subscription
GET /api/billing/invoices
PATCH /api/billing/payment-method
POST /api/billing/cancel
```

---

# 8. Configurações — Subtelas

## 8.1 Perfil

### Objetivo

Editar dados pessoais do usuário.

### Campos

- Nome completo
- E-mail
- Telefone
- Data de nascimento
- CPF
- Endereço
- Foto de perfil

### APIs

```http
GET /api/settings/profile
PATCH /api/settings/profile
```

---

## 8.2 Segurança

### Objetivo

Controlar acesso e proteção da conta.

### Componentes

- Alterar senha.
- Autenticação de dois fatores.
- Dispositivos conectados.
- Histórico de acesso.
- Encerrar sessões.

### APIs

```http
PATCH /api/settings/password
GET /api/settings/devices
DELETE /api/settings/devices/{id}
POST /api/settings/2fa
```

---

## 8.3 Preferências

### Objetivo

Personalizar experiência do app.

### Configurações

- Idioma
- Moeda
- Fuso horário
- Tema
- Cor principal
- Primeiro dia da semana
- Exibição de valores
- Casas decimais
- Confirmações antes de excluir
- Agrupar transações semelhantes

### APIs

```http
GET /api/settings/preferences
PATCH /api/settings/preferences
```

---

## 8.4 Categorias

### Objetivo

Gerenciar categorias de receitas e despesas.

### Componentes

- Tabs:
  - Despesas
  - Receitas
- Tabela:
  - Categoria
  - Tipo
  - Cor
  - Ações
- Nova categoria.
- Editar categoria.
- Excluir categoria.
- Reordenar categorias.

### APIs

```http
GET /api/categories
POST /api/categories
PATCH /api/categories/{id}
DELETE /api/categories/{id}
```

---

## 8.5 Contas e Bancos

### Objetivo

Gerenciar contas, bancos e carteiras.

### Componentes

- Tabs:
  - Contas
  - Carteiras
- Lista de contas:
  - Banco
  - Tipo
  - Saldo
  - Principal
  - Ações
- Adicionar conta.
- Editar conta.
- Remover conta.
- Sincronizar conta.

### APIs

```http
GET /api/accounts
POST /api/accounts
PATCH /api/accounts/{id}
DELETE /api/accounts/{id}
POST /api/accounts/{id}/sync
```

---

## 8.6 Importação de Dados

### Objetivo

Importar extratos, faturas e planilhas.

### Componentes

- Upload drag and drop.
- Selecionar arquivo.
- Histórico de importações.
- Status:
  - Sucesso
  - Processando
  - Erro
- Suporte:
  - OFX
  - CSV
  - XLSX
  - PDF
  - CNAB futuro

### APIs

```http
POST /api/imports
GET /api/imports
GET /api/imports/{id}
```

---

## 8.7 Notificações

### Objetivo

Configurar alertas e lembretes.

### Canais

- App
- E-mail
- WhatsApp
- SMS

### Alertas

- Vencimento de contas
- Gasto acima do orçamento
- Saldo baixo
- Novos insights IA
- Relatório semanal
- Falha de importação
- Assinatura detectada

### APIs

```http
GET /api/settings/notifications
PATCH /api/settings/notifications
```

---

## 8.8 Backup e Sincronização

### Objetivo

Manter dados seguros e sincronizados.

### Componentes

- Backup automático.
- Último backup.
- Sincronização de dispositivos.
- Exportar dados.
- Restaurar backup.

### APIs

```http
GET /api/settings/backup
POST /api/settings/backup/run
POST /api/settings/export
```

---

## 8.9 Assinatura e Plano

### Objetivo

Gerenciar plano, cobrança e pagamentos.

### Componentes

- Plano atual.
- Upgrade/downgrade.
- Método de pagamento.
- Histórico de faturas.
- Cancelamento.
- Cupom.

### APIs

```http
GET /api/billing/subscription
GET /api/billing/invoices
POST /api/billing/change-plan
POST /api/billing/coupon
POST /api/billing/cancel
```

---

## 8.10 Sobre o App

### Objetivo

Exibir informações institucionais e suporte.

### Componentes

- Nome do app.
- Versão.
- Termos de uso.
- Política de privacidade.
- Central de ajuda.
- Fale conosco.
- Avaliar app.
- Licenças.

### APIs

```http
GET /api/app/info
```

---

# 9. Estados de UI

## Loading

- Usar skeleton cards.
- Tabelas com skeleton rows.
- Gráficos com placeholder.

## Empty State

Exemplos:

- Nenhuma transação encontrada.
- Nenhum cartão cadastrado.
- Nenhuma meta criada.
- Nenhum insight disponível ainda.

## Error State

- Mensagem clara.
- Botão tentar novamente.
- Log técnico interno.

---

# 10. Regras de Negócio

## Fluxo líquido

```text
fluxo_liquido = total_entradas - total_saidas
```

## Saving rate

```text
saving_rate = fluxo_liquido / total_entradas * 100
```

## Comprometimento

```text
comprometimento = despesas_totais / receitas_totais * 100
```

## Runway

```text
runway = saldo_disponivel / gasto_medio_mensal
```

## Patrimônio líquido

```text
patrimonio_liquido = total_ativos - total_passivos
```

---

# 11. API Contracts — Exemplos

## Dashboard Summary

```json
{
  "period": "2024-05",
  "income": 15000,
  "expenses": 10200,
  "netCashflow": 4800,
  "currentBalance": 6000,
  "projectedBalance": 1700,
  "savingRate": 32,
  "commitmentRate": 68,
  "runwayMonths": 2.1
}
```

## Transaction

```json
{
  "id": "txn_001",
  "date": "2024-05-31",
  "description": "Supermercado Pao de Acucar",
  "normalizedDescription": "SUPERMERCADO PAO DE ACUCAR",
  "category": "Alimentação",
  "account": "Cartão Nubank",
  "type": "expense",
  "amount": -487.32,
  "status": "confirmed"
}
```

## Insight

```json
{
  "id": "insight_001",
  "type": "overspending",
  "severity": "high",
  "title": "Seus gastos com delivery aumentaram 42%",
  "description": "Você gastou R$ 680 com delivery em maio, acima da média dos últimos 3 meses.",
  "potentialSaving": 200,
  "confidence": 0.91,
  "recommendedAction": "Criar orçamento específico para delivery"
}
```

---

# 12. Permissões

| Permissão | Owner | Admin | Member | Viewer | Child |
|---|---|---|---|---|---|
| Ver dashboard | Sim | Sim | Sim | Sim | Parcial |
| Editar transações | Sim | Sim | Parcial | Não | Não |
| Gerenciar membros | Sim | Sim | Não | Não | Não |
| Ver patrimônio | Sim | Sim | Opcional | Opcional | Não |
| Criar metas | Sim | Sim | Sim | Não | Não |
| Alterar assinatura | Sim | Não | Não | Não | Não |

---

# 13. Requisitos Não Funcionais

## Performance

- Dashboard deve carregar em até 2 segundos.
- Gráficos devem renderizar em até 1 segundo após dados disponíveis.
- Tabelas devem usar paginação ou virtualização.

## Segurança

- LGPD compliance.
- Criptografia em trânsito.
- Criptografia em repouso.
- Controle de acesso por família.
- Logs de auditoria.
- Sessões revogáveis.

## Observabilidade

- Logs estruturados.
- Métricas de API.
- Tracing distribuído.
- Erros monitorados.
- Alertas para falha de importação.

---

# 14. Estrutura de Pastas Frontend

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

# 15. Roadmap

## Fase 1 — MVP

- Dashboard
- Transações
- Fluxo de Caixa
- Cartões
- Calendário
- Importação de Dados
- Categorias
- Contas e Bancos

## Fase 2

- Orçamentos
- Metas
- Planejamento / Projeção
- Relatórios
- Assinaturas recorrentes

## Fase 3

- Insights IA
- Cenários / Simulador
- Família / Membros
- Investimentos
- Patrimônio

## Fase 4

- Integrações bancárias avançadas
- WhatsApp alerts
- Exportação avançada
- Mobile app
- Open Finance

---

# 16. Instruções para Codex

## Objetivo inicial

Implementar primeiro a base visual e funcional do SmartCashFlow com dados mockados.

## Prioridade

1. Criar AppShell com sidebar e header.
2. Criar design system base.
3. Criar mocks TypeScript.
4. Implementar Dashboard.
5. Implementar Transações.
6. Implementar Fluxo de Caixa.
7. Implementar Calendário.
8. Implementar Cartões.
9. Implementar Configurações.
10. Evoluir para demais telas.

## Regras

- Usar TypeScript forte.
- Separar componentes por domínio.
- Não misturar regra de negócio dentro de componentes visuais.
- Criar hooks por tela.
- Criar services para APIs.
- Começar com mock API.
- Preparar troca futura para backend real.
- Usar componentes reutilizáveis.
- Usar loading, empty e error states.
- Garantir responsividade desktop/tablet/mobile.
- Garantir acessibilidade básica.

---

# 17. Definition of Done

Uma tela está pronta quando:

- Layout fiel ao design.
- Dados mockados funcionando.
- Estados loading/empty/error implementados.
- Responsivo.
- Componentes reutilizáveis.
- Sem erros TypeScript.
- Sem warnings relevantes.
- Teste básico criado.
- Código limpo e organizado.
