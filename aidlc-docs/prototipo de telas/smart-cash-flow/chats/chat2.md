# Remover "Em Breve"

_Started 2026-06-08 15:27 UTC_

---

## User

quero remover os em breve quero deixar o produto como se ja tivesse tudo.

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: grep]_

_[tool: show_html]_

_[tool: done]_

Removidos os marcadores de "em breve" e "visão futura" do produto:

- Sidebar: tirei o badge **em breve** de Cenários, Investimentos e Patrimônio.
- Conta/Assinatura: removi o badge **Em breve** no plano Patrimônio e o **Disponível em breve** virou botão normal de upgrade; tirei o "em breve" do Push em notificações.
- Transações e Relatórios: o botão Exportar/CSV não tem mais o selo **em breve**.
- Investimentos e Patrimônio: removi os banners "Módulo da visão futura" / "Módulo em evolução" e troquei os indicadores `Visão futura` por `Estimado`/`Real`.
- Relatório de Patrimônio: deixou de ser uma tela com aviso e opacidade — agora aparece como relatório ativo.

_[tool: fork_verifier_agent]_

Pronto.

## User

todos os bignumbers quando passo o mouse no detlhe ele aparece dentro da caixa e nao da para ler

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: grep]_

_[tool: done]_

Corrigido. O `.kpi` tinha `overflow: hidden` (para conter o sparkline), o que recortava o tooltip dentro da caixa. Mudei para `overflow: visible` — agora os detalhes (Real/Estimado/etc.) aparecem por cima da caixa e ficam legíveis.

## User

nao vi nad de subcategoria, tambem sobre a receita de qual categoria ou subcategoria entrou o dinherio

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

## User

continue

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now the Receitas por origem report:

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: str_replace_edit]_

_[tool: done]_

Adicionei a subcategoria em dois lugares:

**Transações** — nova coluna **Subcategoria** com dropdown editável. As opções mudam conforme a categoria escolhida (ex.: Mercado → Hipermercado / Hortifruti / Açougue / Padaria; Renda → Salário / Aluguel recebido / Freelance / Dividendos / Reembolso). Mudar a categoria reseta a subcategoria se ela não pertencer mais.

**Relatórios → Receitas por origem** — agora é um relatório próprio (não cai mais no genérico) com:
- KPIs: total, nº de origens, % recorrente, maior fonte.
- Donut por subcategoria + legenda.
- Tabela detalhando **Categoria · Subcategoria · Origem · Lançamentos · Valor · % · vs. média** — mostrando exatamente onde o dinheiro entrou (Salário, Aluguel recebido, Freelance, Dividendos, Reembolso, Bônus).

_[tool: fork_verifier_agent]_

Pronto.

## User

reltatorios estao iguals:
-Resumo executivo
-Cartoes
-Orçamento
- Metas
-Projecao futura

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

_[tool: run_script]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: grep]_

_[tool: run_script]_

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: str_replace_edit]_

_[tool: run_script]_

_[tool: done]_

Cada relatório agora tem visual e conteúdo próprios:

- **Resumo executivo** — KPIs gerais, tendência de 12 meses, leitura do período e top categorias.
- **Cartões** — limite × utilização por cartão (barras + datas de fechamento/vencimento/parcelado), donut de gastos do cartão por categoria e tabela de lançamentos.
- **Orçamentos** — KPIs (planejado, realizado, sobra, estouradas), barras com status por categoria, resumo em texto e maiores variações.
- **Metas** — KPIs (guardado, alvo, aportes mensais, no prazo) e cada meta com ícone, progresso colorido, aporte/mês, deadline e meses restantes.
- **Projeção futura** — KPIs por horizonte (30/90/365 dias), gráfico com 3 cenários (otimista, provável, pessimista), tabela de horizontes com risco e premissas usadas.

_[tool: fork_verifier_agent]_

Pronto.

