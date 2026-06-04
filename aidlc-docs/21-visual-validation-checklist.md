# Checklist de Validacao Visual

## Como Usar

Este checklist deve ser usado quando o proximo corte de frontend estiver
implementado. Ele nao substitui testes automatizados; ele complementa lint,
build e testes de backend com uma validacao humana de produto.

## Ambiente

- [ ] Backend local iniciado.
- [ ] Frontend local iniciado.
- [ ] Usuario logado em workspace com dados reais ou massa representativa.
- [ ] Prototipos abertos para comparacao lado a lado.
- [ ] Navegador testado em desktop.
- [ ] Responsividade verificada em largura mobile quando possivel.

## Dashboard

- [ ] A historia superior do dinheiro esta visualmente alinhada aos prototipos
  `1a - Dashboard.png` e `1b - dashboard2.png`.
- [ ] A primeira dobra comunica rapidamente entrada, saida, saldo/resultado e
  saude do periodo.
- [ ] Os indicadores principais batem com a narrativa esperada no prototipo.
- [ ] A hierarquia visual separa leitura executiva, graficos e detalhes.
- [ ] Cards nao parecem soltos ou redundantes.
- [ ] Valores grandes nao quebram layout.
- [ ] Textos estao em portugues do Brasil e orientados a decisao.
- [ ] Estados de carregamento, erro e vazio continuam compreensiveis.
- [ ] A visao `Dia` do grafico mostra entradas como barras positivas verdes,
  saidas como barras negativas, saldo acumulado como linha e saldo projetado como
  linha pontilhada.
- [ ] O grafico usa somente as series `Receita`, `Despesas`,
  `Saldo acumulado` e `Saldo projetado`.
- [ ] As barras de entradas e saidas aparecem empilhadas por dia/mes, e nao como
  colunas separadas competindo pelo mesmo periodo.
- [ ] A visao `Dia` usa o periodo de inicio a fim do filtro.
- [ ] A visao `Mes` usa os 12 meses do ano do filtro e permite comparar a
  tendencia mensal.
- [ ] Top categorias e insights/alertas aparecem perto do grafico principal,
  sem duplicar secoes abaixo.

## Planejamento / Projecao

- [ ] Horizontes de 30, 60 e 90 dias ficam claros.
- [ ] Premissas usadas na projecao aparecem de forma legivel.
- [ ] Riscos futuros sao destacados sem alarmismo excessivo.
- [ ] Indicadores do prototipo foram classificados como existentes, derivados
  ou backlog.
- [ ] A tela nao promete IA ou previsao que ainda nao existe.

## Relatorios

- [ ] Tipos de relatorio sao faceis de alternar.
- [ ] Filtros ficam visiveis sem dominar a tela.
- [ ] Cards executivos explicam o periodo analisado.
- [ ] Secoes de relatorio usam dados reais e mantem rastreabilidade.
- [ ] A tela esta visualmente coerente com Dashboard e Planejamento.

## Navegacao e AppShell

- [ ] Sidebar, header e titulos estao consistentes entre as telas.
- [ ] Nao existe cabecalho duplicado ou descricao repetida.
- [ ] Itens futuros continuam marcados como em breve quando nao implementados.
- [ ] A navegacao para Dashboard, Planejamento e Relatorios funciona.

## Bloqueios

Marque qualquer item abaixo como bloqueio antes de aceitar o pacote:

- [ ] Indicador visual mostra numero diferente do calculado pelo backend.
- [ ] Tela sugere funcionalidade inexistente como se estivesse pronta.
- [ ] Layout quebra em desktop.
- [ ] Layout quebra em mobile de forma que impede uso.
- [ ] Texto financeiro induz interpretacao errada.
- [ ] Build ou lint falha.
