# Comparativo Visual com Prototipo

## Referencias Usadas

| Area | Arquivo de referencia |
| --- | --- |
| Dashboard | `aidlc-docs/prototipo de telas/1a - Dashboard.png` |
| Dashboard | `aidlc-docs/prototipo de telas/1b - Dashboard.png` |
| Planejamento | `aidlc-docs/prototipo de telas/7 - Planejamento Projeção.png` |
| Relatorios | `aidlc-docs/prototipo de telas/10 - Relatorios.png` |
| Especificacao | `aidlc-docs/prototipo de telas/smartcashflow_full_product_spec_v3.md` |

## Dashboard

| Prototipo espera | Estado atual conhecido | Acao proposta |
| --- | --- | --- |
| Cockpit financeiro com narrativa executiva do periodo. | Dashboard ja possui indicadores reais, trilha executiva e secoes narrativas iniciadas. | Revisar hierarquia, densidade, titulos, ordem dos cards e comparacao visual com PNGs 1a/1b. |
| Big numbers principais com leitura rapida. | Indicadores existem, mas podem divergir do layout final esperado. | Definir quais indicadores ficam acima da dobra e quais descem para secoes secundarias. |
| Grafico e distribuicao visual alinhados a fluxo de caixa, categorias e insights. | Existem graficos e secoes reais. | Ajustar composicao sem alterar calculos. |
| Visual moderno, consistente e responsivo. | AppShell ja recebeu parte do alinhamento visual historico. | Fazer validacao mobile/desktop quando browser estiver disponivel. |

## Planejamento / Projecao

| Prototipo espera | Estado atual conhecido | Acao proposta |
| --- | --- | --- |
| Tela de planejamento com foco em projecao, premissas e horizontes. | Tela real foi criada com 30, 60 e 90 dias, premissas e alertas deterministas. | Aproximar visualmente cards, hierarquia e leitura de risco ao PNG de Planejamento. |
| Indicadores de cenario futuro e risco. | Backend e frontend ja calculam projecoes basicas. | Confirmar se todos os indicadores do prototipo sao dados existentes, derivados ou backlog. |
| Linguagem clara para planejamento financeiro. | UX writing inicial existe. | Revisar labels, subtitulos e chamadas de acao. |

## Relatorios

| Prototipo espera | Estado atual conhecido | Acao proposta |
| --- | --- | --- |
| Tela de relatorios com visao consolidada e moderna. | Tela real de Relatorios foi criada e esta em validacao funcional. | Separar ajustes visuais da validacao funcional pendente. |
| Filtros e tipos de relatorio com hierarquia clara. | Filtros e tipos existem. | Comparar com PNG 10 e reorganizar visualmente se necessario. |
| Cards de leitura executiva e secoes por tipo. | Cards existem usando agregados reais. | Ajustar densidade, ordenacao e copy sem mudar contrato. |

## Classificacao de Diferencas

Use esta classificacao antes de qualquer ajuste de codigo:

| Tipo | Definicao | Tratamento |
| --- | --- | --- |
| Visual seguro | Layout, espacamento, cores, hierarquia, copy e organizacao sem mudar contrato. | Implementar no pacote atual. |
| Indicador existente | Indicador ja calculado, mas mal posicionado ou mal explicado. | Reposicionar ou renomear com teste visual/build. |
| Indicador derivavel | Indicador pode ser calculado com dados atuais, mas ainda nao existe. | Registrar decisao antes de implementar. |
| Funcionalidade futura | Depende de nova API, IA, integracao, cadastro ou contrato novo. | Mover para backlog de evolucao. |
| Ambiguo | Divergencia entre PNG, spec ou estado atual. | Pedir revisao humana antes de codar. |

## Decisao Inicial

O primeiro corte de implementacao deve ser o Dashboard, porque ele define a
linguagem visual principal do produto e reduz risco de retrabalho nas demais
telas.

## Resultado do Primeiro Corte

Arquivos alterados:

- `frontend/src/App.tsx`
- `frontend/src/styles.css`

Mudancas realizadas:

- A historia superior do Dashboard passou a usar a narrativa `A historia do seu
  dinheiro`, com badge indicando dados reais do workspace.
- A primeira linha de KPIs passou a priorizar receitas, despesas, saldo do
  periodo, burn rate, saving rate e comprometimento.
- O titulo intermediario `Cockpit financeiro` foi removido para evitar duas
  introducoes concorrendo na primeira dobra.
- A duplicidade do card `% comprometimento` foi removida.
- A historia foi realinhada ao prototipo com `Entrou`, `Saiu`, `Saldo do mes`,
  `Compromissos futuros` e `Saldo previsto`.
- A linha de KPIs abaixo passou a seguir o prototipo com `Saldo atual`, `Fluxo
  liquido`, `Burn rate`, `Saving rate`, `% comprometimento` e `Runway
  financeiro`.
- `Saldo atual` e `Runway financeiro` foram exibidos como `A integrar`, porque
  o app ainda nao possui saldo real de contas. Usar saldo do periodo como saldo
  atual poderia induzir leitura incorreta.
- A segunda dobra foi reorganizada para juntar evolucao do fluxo, top categorias
  e insights/alertas no mesmo bloco, aproximando a composicao dos prototipos.
- O grafico principal agora possui alternancia `Dia` / `Mes`: `Dia` calcula uma
  serie diaria a partir das transacoes reais do periodo filtrado, com entradas
  em barras positivas, saidas em barras negativas, saldo acumulado em linha e
  saldo previsto em linha pontilhada; `Mes` usa a serie mensal do ano do filtro.
- O fallback que distribuia agregados igualmente ao longo dos dias foi removido,
  porque criava barras repetidas e linha artificialmente reta. A visao `Dia`
  deve usar lancamentos reais por data; quando nao houver dado diario real, a
  UI deve indicar ausencia de dados em vez de inventar distribuicao.
- As barras de entradas e saidas passaram a usar colunas empilhadas no mesmo
  eixo temporal, mantendo entradas positivas e saidas negativas.
- A regra do grafico foi redefinida para quatro series: `Receita`,
  `Despesas`, `Saldo acumulado` e `Saldo projetado`. Pagamentos de fatura nao
  entram como `Despesas` nesse grafico para evitar dupla contagem e mistura de
  conceitos.
- O estilo da historia e dos KPIs foi aproximado dos prototipos, preservando
  dados e contratos existentes.

Validacoes executadas:

- `npm run lint`
- `npm run build`
- `Invoke-WebRequest -Uri http://127.0.0.1:5178 -UseBasicParsing`

Validacao pendente:

- Comparacao visual humana no localhost, porque a automacao Playwright no
  ambiente atual falhou com erro de sandbox do Windows: `spawn setup refresh`.
