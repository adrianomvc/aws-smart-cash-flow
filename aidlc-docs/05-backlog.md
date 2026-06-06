# Backlog

## Nota de Gestao do Backlog

- Ideias, melhorias e observacoes levantadas durante testes que nao forem tratadas
  na fatia atual devem ser registradas como backlog de evolucao.
- Correcoes que bloqueiam a validacao do MVP em teste devem ser tratadas na fatia
  atual antes do commit de aprovacao.

## Controle Operacional de Entrega

Modo de trabalho: seguir `aidlc-docs/10-working-agreement.md` para iniciar,
executar, validar, commitar e publicar pacotes.

Status usados:

- `Todo`: ainda nao iniciado.
- `Em andamento`: em implementacao ou ajuste local.
- `Feito local`: implementado e com validacao automatizada local concluida.
- `Validacao usuario`: aguardando teste/aprovacao no localhost.
- `Validado usuario`: aprovado pelo usuario no fluxo testado.
- `Commitado`: commit criado no repositorio.
- `Publicado`: disponivel no ambiente online.
- `Backlog evolucao`: registrado para fase futura, fora do pacote atual.

### Pacote Atual: Alinhamento Visual com Prototipo

Objetivo: alinhar as telas ja funcionais ao prototipo visual enviado, garantindo
que a validacao passe a cobrir layout, hierarquia, indicadores e narrativa de
produto, nao apenas funcionamento tecnico.

Status: `Em andamento`

Itens do pacote:

- `Feito local` Documentar plano AI-DLC do pacote em
  `aidlc-docs/19-visual-prototype-alignment-plan.md`.
- `Feito local` Criar matriz de comparacao visual contra os PNGs e spec v3.
- `Feito local` Definir criterios de aceite visuais para Dashboard, Planejamento
  e Relatorios.
- `Feito local` Revisar indicadores esperados vs indicadores atuais na primeira
  dobra do Dashboard.
- `Feito local` Implementar primeira fatia visual do Dashboard sem criar novas
  funcionalidades.
- `Feito local` Criar checklist de validacao visual.
- `Validado usuario` Validar localmente a primeira dobra do Dashboard contra
  os prototipos `1a - Dashboard.png` e `1b - dashboard2.png`.

Rastreabilidade do pacote atual:

| Pacote | US relacionada | Status | Observacao |
| --- | --- | --- | --- |
| Alinhamento Visual com Prototipo | US-055 | `Validado usuario` | Primeira dobra do Dashboard ajustada e validada. |
| Alinhamento Visual com Prototipo | US-056 | `Em andamento` | Hierarquia visual consistente. |
| Alinhamento Visual com Prototipo | US-056A | `Em andamento` | Revisao transversal UX/UI/Product/UX Writing. |
| Alinhamento Visual com Prototipo | US-074 | `Validado usuario` | Dashboard narrativo alinhado ao cockpit financeiro. |
| Alinhamento Visual com Prototipo | US-076 | `Todo` | Estrutura moderna e consistente de navegacao. |

### Pacote Anterior: Relatorios

Objetivo: criar a primeira tela real de relatorios consolidados do
SmartCashFlow, agrupando leituras existentes de fluxo de caixa, receitas,
despesas, cartoes, orcamentos, metas e qualidade de dados.

Status: `Validacao usuario`

Itens do pacote:

- `Feito local` Documentar plano AI-DLC do pacote em
  `aidlc-docs/17-reports-execution-plan.md`.
- `Feito local` Criar contrato inicial de leitura para relatorios consolidados.
- `Feito local` Criar backend minimo de relatorios usando agregados ja existentes.
- `Feito local` Habilitar tela real de Relatorios no frontend.
- `Feito local` Exibir relatorios por tipo sem exportacao real neste primeiro recorte.
- `Feito local` Adicionar testes unitarios e PBT quando houver transformacao testavel.
- `Validacao usuario` Validar localmente navegacao, filtros e leitura dos cards.

Rastreabilidade do pacote anterior:

| Pacote | US relacionada | Status | Observacao |
| --- | --- | --- | --- |
| Relatorios | US-076 | `Validacao usuario` | Navegacao para tela real de relatorios. |
| Relatorios | US-037 | `Feito local` | Resumo executivo mensal como relatorio consolidado. |
| Relatorios | US-038 | `Feito local` | Fluxo de caixa mensal como relatorio. |
| Relatorios | US-041 | `Feito local` | Despesas por categoria como relatorio. |
| Relatorios | US-046 | `Feito local` | Qualidade de dados como secao de relatorio. |

### Pacote Anterior: Planejamento e Projecao

Objetivo: transformar calendario, orcamentos, metas, fluxo de caixa e cartoes em
uma primeira visao de planejamento financeiro projetado, com horizontes de 30,
60 e 90 dias e premissas claras para o usuario.

Status: `Validado usuario`

Itens do pacote:

- `Feito local` Documentar plano AI-DLC do pacote em
  `aidlc-docs/15-planning-projection-execution-plan.md`.
- `Feito local` Criar contrato inicial de leitura para projecao financeira.
- `Feito local` Criar backend minimo de projecao usando dados reais ja disponiveis.
- `Feito local` Habilitar tela real de Planejamento / Projecao no frontend.
- `Feito local` Exibir premissas, horizontes e alertas de risco sem usar IA ainda.
- `Feito local` Adicionar testes unitarios e PBT para calculos de projecao.
- `Validado usuario` Validar localmente a navegacao e os cenarios principais.

Rastreabilidade do pacote atual:

| Pacote | US relacionada | Status | Observacao |
| --- | --- | --- | --- |
| Planejamento e Projecao | US-071 | `Validado usuario` | Fluxo de caixa projetado para 30, 60 e 90 dias. |
| Planejamento e Projecao | US-044 | `Feito local` | Orcamento segue como insumo da jornada, sem regra completa de consumo por categoria neste recorte. |
| Planejamento e Projecao | US-045 | `Feito local` | Alertas deterministas de risco por horizonte, sem IA. |
| Planejamento e Projecao | US-068 | `Feito local` | Burn rate segue no contexto do dashboard; projecao explicita premissas sem saldo real integrado. |

### Pacote Anterior: Fase 1 - Planejamento Multirepo e Produto Base

Objetivo: preparar o SmartCashFlow para evoluir ate o prototipo final usando
AI-DLC, com documentacao ativa em `aidlc-docs/`, arquitetura multirepo planejada
e primeira fatia de produto focada em calendario, orcamentos e metas.

Status: `Validado usuario`

Itens do pacote:

- `Feito local` Copiar `aidlc-docs-bkp/` para `aidlc-docs/` e tornar
  `aidlc-docs/` a fonte ativa do fluxo AI-DLC.
- `Feito local` Documentar arquitetura alvo multirepo em
  `aidlc-docs/11-target-architecture-multirepo.md`.
- `Feito local` Documentar plano de execucao da Fase 1 em
  `aidlc-docs/12-phase-1-execution-plan.md`.
- `Feito local` Criar estrutura inicial de contratos em `contracts/`.
- `Feito local` Mapear endpoints atuais por dominio: identity, workspaces, imports,
  ledger, dashboard e planning.
- `Feito local` Habilitar telas reais para calendario, orcamentos e metas no
  frontend, usando dados derivados das APIs atuais e mocks isolados para metas.
- `Feito local` Criar backend minimo de planning para calendario, orcamentos e
  metas persistentes.
- `Feito local` Adicionar formularios simples de criacao nas telas de calendario,
  orcamentos e metas para permitir validacao local do fluxo persistente.
- `Validado usuario` Validacao local aprovada para seguir ao proximo pacote.

Rastreabilidade do pacote atual:

| Pacote | US relacionada | Status | Observacao |
| --- | --- | --- | --- |
| Fase 1 - Planejamento Multirepo e Produto Base | US-057 | `Validado usuario` | Estrategia multirepo documentada sem iniciar microservicos prematuros. |
| Fase 1 - Planejamento Multirepo e Produto Base | US-060 | `Feito local` | Contratos iniciais criados em `contracts/` e endpoints mapeados por dominio. |
| Fase 1 - Planejamento Multirepo e Produto Base | US-061 | `Feito local` | Telas de calendario, orcamentos e metas habilitadas no frontend com leitura da Planning API. |
| Fase 1 - Planejamento Multirepo e Produto Base | US-062 | `Feito local` | Backend Planning minimo criado com eventos de calendario, orcamentos e metas. |
| Fase 1 - Planejamento Multirepo e Produto Base | US-063 | `Validado usuario` | Formularios simples adicionados para validar criacao persistente em localhost. |

Decisao operacional:

- O fluxo ativo deve usar `aidlc-docs/`.
- `aidlc-docs-bkp/` pode ser removido manualmente pelo usuario quando nao quiser
  manter copia historica local.
- A arquitetura recomendada para a proxima etapa e modular monolith preparado
  para multirepo, sem microservicos reais neste momento.

### Pacote Anterior: Qualidade da Base e Duplicidades

Objetivo: permitir que o usuario encontre, entenda e limpe possiveis duplicidades
sem inflar indicadores financeiros e sem excluir dados por acidente.

Status: `Validado usuario`

Itens do pacote:

- `Feito local` Separar normalizacao visual da normalizacao usada para
  duplicidade, preservando parcela atual/total na chave natural.
- `Feito local` Recalcular possiveis duplicados pela regra atual mesmo quando a
  chave gravada no banco for antiga.
- `Feito local` Evitar que parcelas diferentes da mesma compra, como `02/10`,
  `03/10` e `04/10`, aparecam no mesmo grupo de duplicidade.
- `Feito local` Manter mesma parcela repetida, como dois `04/10`, como possivel
  duplicidade real.
- `Feito local` Permitir filtrar um grupo de possiveis duplicados por IDs para
  mostrar tambem registros antigos com chave nula ou divergente.
- `Feito local` Mostrar `Principal`, `Principal sugerido` e `Revisar` na
  interface, evitando termos tecnicos para o usuario final.
- `Feito local` Permitir acao de limpeza do grupo: manter o principal real ou
  sugerido e excluir os demais somente apos confirmacao explicita.
- `Feito local` Exibir parcela na lista e no detalhe da transacao.
- `Feito local` Atualizar especificacao de comportamento e testes automatizados
  para normalizacao, parcelas, reprocessamento e grupos de duplicidade.
- `Validado usuario` Testar no localhost grupos reais como `ANGLO`,
  `BALACOBACO FESTA`, `99`, `99FOOD`, `MERCADOLIVRE` e pagamentos vindos de
  arquivos diferentes.

Rastreabilidade do pacote atual:

| Pacote | US relacionada | Status | Observacao |
| --- | --- | --- | --- |
| Qualidade da Base e Duplicidades | US-005 | `Validado usuario` | Reprocessamento sem recriar duplicidades e chave natural revisada. |
| Qualidade da Base e Duplicidades | US-005A | `Validado usuario` | Possiveis duplicados historicos, grupos por chave atual e revisao manual. |
| Qualidade da Base e Duplicidades | US-007 | `Feito local` | Lista de transacoes filtra grupo por IDs e preserva paginacao/ordenacao. |
| Qualidade da Base e Duplicidades | US-008A | `Validado usuario` | Exclusao individual e limpeza de duplicados com confirmacao explicita. |
| Qualidade da Base e Duplicidades | US-035 | `Feito local` | Parcela de cartao exibida e usada para evitar falso duplicado entre parcelas. |
| Qualidade da Base e Duplicidades | US-056A | `Feito local` | UX writing aplicado ao fluxo para evitar termos tecnicos na revisao. |

Validacoes automatizadas executadas no pacote:

- Backend: `python -m pytest tests/test_parsers.py tests/test_persisted_import_service.py tests/test_transaction_routes.py`
- Backend: `python -m ruff check .`
- Frontend: `npm run lint`
- Frontend: `npm run build`

Pendencias antes de commit/publicacao:

- `Validado usuario` Confirmar no localhost que os grupos de duplicidade estao
  corretos apos recarregar a tela ou clicar em atualizar.
- `Validado usuario` Confirmar que o texto "Principal sugerido" e a acao
  "Excluir duplicados" estao claros.
- `Validado usuario` Confirmar que a exclusao de duplicados atualiza listas e
  indicadores como esperado.

### Mapa de Pacotes

P0, validacao atual:

- `Validado usuario` Qualidade da base e duplicidades: confirmar no localhost
  que os grupos estao corretos, que a linguagem esta clara e que a acao de
  excluir duplicados atualiza listas e indicadores.

P1, validado:

- `Validado usuario` Normalizacao e reprocessamento: validar casos reais de descricoes
  genericas ou truncadas (`99`, `99FOOD`, `MERCADOLIVRE`, `PAYPAL`, `SHELL`,
  `UBER`) e separar regra deterministica atual do uso futuro de IA.
- `Validado usuario` Normalizacao segura para canais `99`: unir `99 FOOD`, `99 APP`
  e `99 TAXI` quando houver complemento claro, mantendo `99` isolado sem
  enriquecimento deterministico.
- `Validado usuario` Normalizacao segura para `MP`, `SHELL BOX` e variantes de
  `UBERBR`, preservando abreviacoes isoladas quando nao houver contexto
  suficiente.
- `Validado usuario` Reprocessamento ajustado para trocar chaves naturais em duas
  fases, evitando erro de unicidade quando descricoes antigas passam a convergir
  para a mesma normalizacao.
- `Validado usuario` Casos reais validados: `99APP` com `99APP *99App` e
  `MERCADO PAGO RONALDODESOUZ` com `MP*RONALDODESOUZ`.
- `Validado usuario` Cobertura consolidada para `MERCADOLIVRE`, `PAYPAL`, `SHELL` e
  `UBER`, preservando complementos uteis e removendo repeticoes/ruidos seguros.

P2, pacotes seguintes:

- `Feito local` Importacao em lote e performance: melhorar feedback de progresso,
  investigar lentidao/timeouts em producao e preparar caminho assincrono futuro.
  MVP agora avisa quando o lote passa de 20 arquivos, recomenda dividir em
  blocos menores e reforca que previa/importacao processam um arquivo por vez.
  Quando a previa nao tem nenhum arquivo importavel, a tela mostra mensagem
  explicita em vez de manter um botao de confirmacao sem efeito.
  A confirmacao da previa fica disponivel no topo do resumo, e a lista de
  arquivos usa rolagem interna para evitar que o usuario precise descer ate o
  fim do lote.
- `Feito local` Transacoes operacionais: revisar filtros, ordenacao, paginacao,
  edicao manual/importada, exclusao individual e estados vazios/erro.
  Ajuste atual: mudancas de categoria agora exibem mensagem clara, incluindo
  remocao para `Sem categoria` e saida da fila de revisao apos classificacao.
- `Feito local` Dashboard e indicadores: continuar indicadores de saude financeira,
  revisar eixos/graficos, narrativa final e drill-down.
  Ajuste atual: resumo do dashboard calcula e exibe comprometimento da receita
  (`despesas / receitas`) com faixas de leitura saudavel, atencao e risco.
  Alertas do dashboard agora tambem destacam recorrencias em alta quando o
  ultimo valor subir pelo menos 30% contra a media detectada e passar de R$ 50,
  permitindo abrir as transacoes da recorrencia.

P3, experiencia e produto:

- `Em andamento` Alinhamento com prototipo de telas: usar
  `aidlc-docs/prototipo de telas/smartcashflow_full_product_spec_v3.md` e os
  PNGs da pasta como referencia visual e de produto, sem trocar o MVP para mock.
  O proximo pacote de front deve adaptar o que ja existe para a linha visual do
  prototipo em fatias agrupadas: AppShell/sidebar/header, Dashboard, Transacoes,
  Fluxo de Caixa, Cartoes, Importacao/Configuracoes. Primeiro recorte aplicado:
  AppShell com sidebar escura, navegacao alinhada ao mapa do prototipo, itens
  futuros marcados como em breve, secoes de menu por jornada e header por
  contexto da tela. Dashboard recebeu trilha executiva no topo para contar
  rapidamente entrada, saida, saldo, pagamento de fatura e burn rate com dados
  reais. Big numbers abaixo da trilha agora focam em indicadores de controle
  complementares: comprometimento, taxa de poupanca, burn rate, pagamento de
  fatura e qualidade dos dados. Valores financeiros grandes nos KPIs usam
  formato compacto (`mil`/`mi`) e mantem valor completo em tooltip para evitar
  quebra de linha em desktop e mobile. O indicador de periodo no topo agora
  reflete o periodo real do dashboard e fica marcado como informativo, em vez de
  parecer uma acao global ainda nao implementada. Notificacoes no topo ficam
  desabilitadas como `em breve` ate existir central/contrato de notificacao.
  Rotulos de mes usam inicial maiuscula em resumo, graficos, tooltips e
  drilldowns (`Mai/26`).
  Marca visual aplicada no frontend com icone na navegacao/favicon e logo na
  tela de login, usando os assets do prototipo. Assets de marca foram
  otimizados para uso no app, reduzindo o logo para cerca de 43 KB e o icone
  para cerca de 9 KB no build. O icone do app usa a versao com borda do
  prototipo para a area logada e favicon, evitando fundo artificial duplicado
  no CSS.
  Tela de transacoes iniciou alinhamento ao prototipo com tabs de tipo
  financeiro, resumo da pagina atual e filtros com hierarquia mais clara antes
  da tabela paginada. Dashboard e Transacoes removeram o segundo cabecalho
  interno para evitar titulo/descricao duplicados com o topo global da aplicacao.
  Importacoes tambem removeu cabecalho interno duplicado e recebeu resumo
  operacional da pagina atual com arquivos, linhas novas, duplicadas, erros e
  falhas antes do upload/historico.
  Categorias, Regras e Configuracoes tambem tiveram cabecalho interno removido;
  a acao principal de Regras ficou como toolbar da tela. Textos do topo global
  foram ajustados para linguagem mais orientada a tarefa.
  Categorias recebeu resumo visual com total, categorias principais,
  subcategorias e modo atual de cadastro/edicao.
  Regras recebeu resumo visual com total de regras, ativas, regras de categoria
  e regras de tipo financeiro antes do formulario/tabela.
  Configuracoes recebeu resumo visual do workspace, modo de sessao, API e estado
  da manutencao antes dos paineis operacionais.
  Configuracoes tambem recebeu hub visual baseado no v3, com atalhos disponiveis
  para Categorias, Regras/Normalizacao e Importacao de Dados, e demais subtelas
  marcadas como `Em breve`.
  Configuracoes passou a mostrar uma previa de Preferencias Financeiras v3 com
  janela de burn rate, metodo de runway, reserva protegida, politica de gasto
  seguro, perfil de risco e sensibilidade do score.
  Configuracoes recebeu painel temporario de Seguranca e Sobre o App com
  privacidade, backup futuro e versao/escopo atual do MVP.
  Revisao recebeu resumo visual da fila com pendencias, despesas, receitas e
  total da pagina, reaproveitando o explorador de transacoes sem duplicar
  cabecalho.
  Fluxo de Caixa saiu de `em breve` e ganhou primeira tela dedicada com filtro
  proprio, historia do periodo, grafico mensal ampliado, resumo operacional,
  ranking de categorias e recorrencias clicaveis para transacoes filtradas.
  Cartoes saiu de `em breve` e ganhou primeira tela dedicada com filtro proprio,
  resumo de compras, creditos, fatura, parcelado futuro estimado, lancamentos,
  parcelas identificadas e conciliacao de pagamento de fatura com drill-down
  para transacoes filtradas por origem. Ajuste atual: parcelas identificadas no
  mes filtrado passam a ser projetadas por mes/ano entre a primeira fatura da
  compra e o mes alvo, considerando `closing_day` do cartao; parcelado futuro
  mostra a parcela prevista para a proxima competencia.
  Build do frontend passou a separar chunks de React, Recharts e TanStack Query
  para reduzir o bundle principal e remover o aviso recorrente de
  chunk grande do Vite.
- `Backlog evolucao` Configuracoes v3: detalhar a tela de Configuracoes como
  hub com subtelas de Perfil, Seguranca, Preferencias, Categorias, Contas e
  Bancos, Importacao de Dados, Notificacoes, Backup e Sincronizacao, Assinatura
  e Plano, e Sobre o App, seguindo
  `aidlc-docs/prototipo de telas/smartcashflow_full_product_spec_v3.md`.
- `Backlog evolucao` Preferencias Financeiras: permitir configurar moeda,
  idioma/regiao, meta de poupanca, limite de comprometimento, perfil de risco,
  categorias prioritarias e canais de alerta, para alimentar indicadores,
  alertas e Copilot.
- `Backlog evolucao` Cartoes e faturas automation-first: o sistema deve
  detectar cartao, competencia, fechamento, vencimento, total e status da fatura
  a partir de CSV/PDF/Excel sempre que o arquivo trouxer essas informacoes.
  Cadastro manual deve ser excecao para correcao, complemento ou casos sem
  arquivo, nao fluxo obrigatorio.
- `Backlog evolucao` AI Copilot / Chat Financeiro: usar a tela
  `aidlc-docs/prototipo de telas/AI COpilot.png` como referencia para uma
  experiencia propria de chat financeiro, com conversas recentes, novo chat,
  perguntas rapidas, resumo financeiro lateral, simulacao de compra e respostas
  rastreaveis por ferramentas internas. A navegacao do produto deve manter a
  area como `Insights IA`, com Copilot como experiencia/subvisao conversacional
  dentro dela. Entra depois do MVP visual/base de dados, pois depende de
  contratos de IA, seguranca, custo, auditoria e tool calling.
- `Backlog evolucao` Tela publica / logout: usar
  `aidlc-docs/prototipo de telas/tela logout.png` como referencia para a
  experiencia fora da sessao, com proposta de valor, CTAs de entrar/criar conta,
  sinais de seguranca/LGPD, preview do produto e foco em familias. Deve ficar
  separada do app autenticado do MVP e entrar junto do pacote de login,
  onboarding e cadastro.
- `Feito local` Revisao transversal UX/UI/Product Design/UX Research/UX Writing:
  aplicar em todos os fluxos ja implementados, em pacotes agrupados de front.
  Primeiro recorte: dashboard reorganizado em secoes de saude imediata,
  tendencia, controle, padroes, operacao e fechamento narrativo para reduzir
  sensacao de paineis soltos. Big numbers principais reduzidos para uma linha
  com menos indicadores; qualidade e pagamento de fatura ficam na area
  operacional. Resumo narrativo passa a fechar com resultado, saude, maior
  pressao de gasto, confianca dos dados e proxima acao sugerida.
- `Feito local` Burn rate do MVP: calcular gasto medio mensal estimado dos
  ultimos 12 meses ate a data final do filtro, usando os meses disponiveis
  quando ainda nao houver 12 meses de historico, e exibir no resumo narrativo
  com origem do calculo.
- `Feito local` Formatacao numerica de percentuais: quando percentuais
  passarem de 1.000%, usar separador de milhar no padrao pt-BR, por exemplo
  `1.250%`, para melhorar leitura em alertas, comparacoes e narrativas.
- `Todo` Login/autenticacao: entregar tela real de login/cadastro e fluxo de
  sessao para producao.

Backlog evolucao:

- `Backlog evolucao` Infra/arquitetura: avaliar S3 + CloudFront, hardening AWS,
  lifecycle S3 e migracao serverless completa.

## Epic 1: Fundacao do Projeto

US-001: Como Tech Lead, quero uma estrutura de projeto com backend, frontend, testes e migracoes para permitir evolucao segura.

Aceite:

- Estrutura criada.
- Comando de teste documentado.
- Ambiente local documentado.

US-002: Como DBA, quero o schema inicial versionado para armazenar arquivos, importacoes, transacoes e erros.

Aceite:

- Migracao inicial criada.
- Constraints de unicidade definidas.
- Tipos monetarios usam decimal.
- Todas as tabelas financeiras possuem isolamento por workspace.

## Epic 1.5: Autenticacao e Workspace

US-015: Como usuario, quero fazer login por email e senha para acessar meus dados financeiros com seguranca.

Aceite:

- Login usa Supabase Auth.
- Frontend envia `Authorization: Bearer <access_token>` para a API.
- Backend valida token antes de rotas protegidas.
- Rotas protegidas resolvem `user_id` e `workspace_id`.
- Dados financeiros nunca sao retornados sem filtro por `workspace_id`.

US-016: Como usuario, quero ter um workspace inicial criado automaticamente no primeiro acesso para começar a usar sem configuracao manual.

Aceite:

- Primeiro acesso cria usuario espelhado no banco da aplicacao.
- Primeiro acesso cria workspace inicial se o usuario ainda nao tiver workspace.
- Usuario inicial recebe role `owner`.
- Fluxo permite adicionar outro usuario ao mesmo workspace em etapa posterior.

## Epic 2: Ingestao TXT

US-003: Como operador, quero importar extrato TXT para carregar lancamentos de conta corrente.

Aceite:

- Parser le formato `dd/MM/yyyy;descricao;valor`.
- Valor brasileiro com virgula e convertido corretamente.
- Linhas invalidas geram `ImportError`.

US-003A: Como usuario, quero importar extratos de conta corrente em Excel para carregar lancamentos e saldos diarios.

Aceite:

- Importacao aceita arquivos `.xlsx` e `.xls` de extrato de conta corrente quando o layout for suportado.
- Parser identifica data, descricao, valor e tipo de movimento quando disponiveis.
- Quando o arquivo trouxer saldo do dia, o sistema deve armazenar ou derivar o saldo diario para uso em graficos e indicadores.
- Saldo diario deve ficar separado de transacoes para evitar criar lancamentos artificiais.
- Preview da importacao deve mostrar lancamentos extraidos e saldos diarios detectados antes de gravar.
- Falhas de layout, colunas ausentes e linhas ambiguas devem ficar disponiveis para revisao.
- Evolucao deve considerar fixtures reais anonimizadas antes de liberar o parser em producao.

## Epic 3: Ingestao CSV

US-004: Como operador, quero importar CSVs de fatura para carregar lancamentos de cartao.

Aceite:

- Parser exige header `data,lançamento,valor`.
- Data ISO e valor decimal sao validados.
- Pagamentos sao identificados por descricao e valor negativo.

## Epic 4: Idempotencia e Auditoria

US-005: Como administrador, quero reprocessar arquivos sem duplicar transacoes.

Aceite:

- Hash do arquivo evita reimportacao identica.
- Chave de dedupe evita duplicidade por linha.
- Arquivo com conteudo quase igual ao ja importado nao deve recriar todas as
  transacoes antigas; transacoes ja existentes devem ser ignoradas ou marcadas
  como possiveis duplicadas.
- Quando somente uma linha muda em um arquivo ja importado, a importacao deve
  evidenciar quantas linhas eram novas, quantas ja existiam e quantas tiveram
  erro.
- Importacoes repetidas ficam rastreaveis.

US-005A: Como usuario, quero detectar possiveis transacoes duplicadas entre arquivos diferentes para evitar inflar meus indicadores financeiros.

Aceite:

- Sistema calcula uma assinatura natural por workspace, origem, data, descricao
  normalizada, valor e direcao.
- Transacoes com mesma assinatura natural em arquivos diferentes nao devem inflar
  dashboard sem revisao explicita.
- Interface deve mostrar resumo de linhas novas, linhas duplicadas/possiveis
  duplicadas e erros da importacao.
- Regra deve evitar descartar automaticamente casos legitimamente repetidos sem
  rastro de auditoria.

## Epic 5: Interface Operacional

Nota de entrega frontend:

- Mudancas de frontend devem ser agrupadas em uma fatia unica de subida sempre que
  fizerem parte do mesmo fluxo operacional.
- Para o MVP operacional, juntar upload, lista de importacoes, detalhe de erros,
  lista de transacoes, categorias manuais e regras deterministicas em uma entrega
  coesa de frontend, evitando subidas pequenas e fragmentadas.

US-006: Como operador, quero ver status de importacao e erros para agir rapidamente.

Aceite:

- Lista importacoes com status e contadores.
- Detalhe mostra erros por linha.
- Tela nao expõe dados desnecessarios.

US-017: Como operador, quero importar multiplos arquivos em lote pequeno para carregar historico sem repetir a operacao arquivo por arquivo.

Aceite:

- Frontend permite selecionar multiplos arquivos TXT/CSV.
- Cada arquivo gera uma importacao independente.
- Falha em um arquivo nao bloqueia os demais.
- Tela mostra resumo por arquivo com status, linhas validas e erros.

US-018: Como operador, quero visualizar um preview antes de confirmar a importacao para evitar salvar dados incorretos.

Aceite:

- Preview mostra linhas parseadas, erros e duplicidades detectadas.
- Usuario pode cancelar antes de persistir transacoes.
- Usuario pode confirmar a importacao apos revisar o resumo.
- Dados sensiveis do preview nao devem ir para logs.

US-019: Como operador, quero escolher manualmente o parser quando a deteccao automatica for ambigua.

Aceite:

- Sistema informa quando a confianca de deteccao for baixa ou ambigua.
- Tela permite selecionar parser/layout suportado.
- Escolha manual fica registrada nos metadados da importacao.

US-020: Como operador, quero consultar metadados do lote de importacao para auditar origem, parser e linhas ignoradas.

Aceite:

- Importacao registra parser/layout usado, origem inferida, total de linhas e linhas ignoradas.
- Linhas ignoradas possuem motivo quando identificavel.
- Detalhe da importacao exibe metadados sem expor dados financeiros desnecessarios.

US-055: Como usuario, quero uma revisao visual e de UX da interface para tornar o produto mais moderno, claro e agradavel de usar.

Aceite:

- Revisao cobre dashboard, importacao, transacoes, categorias, regras, revisao e configuracoes.
- Mudancas de frontend devem ser agrupadas em uma entrega unica ou em fatias coesas por fluxo.
- Design deve priorizar clareza operacional, leitura rapida de indicadores e reducao de ruido visual.
- Dashboard deve manter os paineis operacionais primeiro e fechar a tela com uma
  sintese em formato de storytelling financeiro.
- Componentes devem manter responsividade em desktop e mobile.
- Antes da subida, a interface deve ser testada localmente pelo usuario.

US-056: Como usuario, quero que as telas financeiras tenham hierarquia visual consistente para entender rapidamente o que exige acao.

Aceite:

- Cards, tabelas, badges, filtros, estados vazios, loading e erros seguem um padrao visual unico.
- Indicadores importantes usam destaque proporcional ao impacto financeiro.
- Acoes primarias, secundarias e destrutivas sao visualmente diferenciadas.
- Textos e controles nao estouram em resolucoes comuns.
- A experiencia evita visual de landing page e prioriza uso recorrente.

US-056A: Como usuario, quero uma revisao transversal de UX, UI, Product Design, UX Research e UX Writing em tudo que ja foi feito para deixar o produto coerente, claro e seguro.

Aceite:

- Revisao cobre fluxos ja implementados: login/autenticacao, workspace, dashboard,
  importacao, preview, importacoes, transacoes, duplicidades, categorias, regras,
  configuracoes, indicadores e estados de erro/loading/vazio.
- UX Research identifica em cada fluxo qual decisao ou tarefa o usuario precisa
  concluir e quais duvidas aparecem durante o uso.
- Product Design organiza cada tela dentro da jornada financeira: carregar dados,
  limpar base, classificar, analisar saude financeira e agir.
- UX revisa a ergonomia de filtros, ordenacao, drill-down, confirmacoes,
  paginacao, acoes destrutivas, revisao em lote e recuperacao de erro.
- UI revisa hierarquia visual, densidade, responsividade, tabelas, cards,
  badges, graficos, espacamentos, contraste e consistencia entre telas.
- UX Writing substitui termos tecnicos por linguagem clara, explica impacto das
  acoes e melhora mensagens de erro, sucesso, vazio, carregamento e confirmacao.
- Itens encontrados devem virar ajustes pequenos agrupados por pacote de front,
  respeitando a regra de testar localmente antes da subida.
- A revisao deve preservar a confianca operacional: nenhuma acao destrutiva pode
  acontecer sem confirmacao explicita e contexto suficiente.

US-076: Como usuario, quero uma estrutura de telas moderna e consistente para navegar por toda a minha vida financeira.

Aceite:

- A interface deve seguir uma navegacao lateral clara com as areas principais:
  visao geral, fluxo de caixa, transacoes, cartoes, orcamentos, investimentos,
  metas, relatorios, insights e configuracoes.
- A tela de visao geral deve funcionar como resumo executivo e historia do
  dinheiro no periodo.
- A tela de fluxo de caixa deve focar em evolucao, resumo do periodo,
  distribuicao de despesas e fluxo projetado.
- A tela de transacoes deve priorizar busca, filtros, tabs de tipo financeiro,
  tabela paginada, ordenacao e drill-down recebido de graficos.
- A tela de cartoes deve consolidar fatura atual, limite, fechamento,
  vencimento, parcelado futuro, recorrencias e distribuicao por categoria.
- `Feito local parcial` Primeira tela de Cartoes usa os dados ja disponiveis de
  fatura importada para exibir compras, creditos/devolucoes, pagamentos de
  fatura, parcelado futuro estimado, parcelas identificadas e conciliacao com
  extrato. Parcelas identificadas do mes filtrado calculam a parcela atual a
  partir da primeira fatura da compra, considerando fechamento do cartao
  configuravel, e escondem parcelamentos vencidos. Parcelado futuro estima a
  parcela da proxima competencia. Limite, vencimento e cadastro de cartoes
  continuam para evolucao futura.
- A tela de orcamentos deve comparar realizado, orcado, restante e percentual
  consumido por categoria.
- A tela de investimentos deve mostrar patrimonio total, rentabilidade,
  distribuicao da carteira e evolucao mensal quando esses dados existirem.
- A tela de metas deve acompanhar objetivo, progresso, prazo e valor faltante.
- A tela de relatorios deve organizar analises como fluxo de caixa, despesas por
  categoria, evolucao patrimonial, imposto de renda, comparacao mensal e
  relatorio personalizado.
- A tela de insights deve centralizar alertas, oportunidades, historico e
  recomendacoes acionaveis.
- A tela de configuracoes deve agrupar dados pessoais, notificacoes, seguranca,
  categorias, formas de pagamento, moedas, conexoes bancarias, canais de contato
  e importacao de dados.
- Referencias visuais fornecidas em 2026-05-23 devem ser tratadas como direcao
  de UX e nao como obrigacao de copiar layout pixel a pixel.
- Mudancas de front relacionadas a essas telas devem ser agrupadas por pacote de
  experiencia e testadas localmente antes da subida.

## Epic 6: Consulta e Categorizacao de Transacoes

US-007: Como analista, quero consultar transacoes importadas por periodo, origem e descricao.

Aceite:

- Filtros basicos disponiveis.
- Resultado paginado.
- Valores formatados em BRL na interface.

US-008: Como usuario, quero categorizar transacoes manualmente para organizar meus gastos.

Aceite:

- Categorias podem ser criadas por workspace.
- Uma transacao pode receber categoria manual.
- Uma transacao classificada pode voltar para `Sem categoria`.
- Alteracoes ficam persistidas.

US-008A: Como usuario, quero excluir uma transacao importada incorreta para corrigir minha base financeira.

Aceite:

- Tela de transacoes permite excluir uma transacao individual com confirmacao.
- Exclusao remove classificacao vinculada e atualiza lista, dashboard e qualidade
  dos dados.
- API valida `workspace_id` e nao permite excluir transacao de outro workspace.
- Evolucao futura deve substituir exclusao fisica por exclusao logica auditavel e
  reversivel.

US-008B: Como usuario, quero corrigir manualmente o tipo financeiro de uma transacao para separar despesa, receita e pagamento de fatura.

Aceite:

- Tela de transacoes permite alterar o tipo financeiro individual para despesa,
  receita/credito ou pagamento de fatura.
- API valida valores aceitos e respeita `workspace_id`.
- Ajuste atualiza dashboard, fluxo mensal, rankings e conciliacao de fatura.
- Evolucao futura deve auditar usuario, data e valor anterior da alteracao.

US-008C: Como usuario, quero cadastrar uma transacao manual para registrar lancamentos que nao vieram nos arquivos importados.

Aceite:

- Usuario informa data, descricao, valor, tipo financeiro e categoria opcional.
- Transacao manual fica vinculada ao workspace e marcada com origem `manual`.
- Transacao manual entra nos dashboards, filtros e revisao como qualquer outra
  transacao.
- Sistema deve reduzir risco de duplicidade acidental com lancamentos importados
  por data, descricao normalizada, valor e tipo financeiro.
- Edicao, exclusao e auditoria de transacoes manuais devem seguir as mesmas
  regras de controle das demais correcoes manuais.

US-009: Como usuario, quero regras automaticas de categorizacao para reduzir trabalho manual.

Aceite:

- Regras por texto da descricao podem ser cadastradas.
- Regras sao aplicadas apos importacao.
- Categoria manual prevalece sobre regra automatica.
- Regras deterministicas fazem parte do MVP 1.

US-021: Como usuario, quero subcategorias para organizar despesas com maior granularidade.

Aceite:

- Categoria pode ter subcategorias.
- Transacao pode ser classificada em categoria e subcategoria.
- Filtros e dashboards consideram categoria e subcategoria.
- Migracao preserva categorias existentes.

US-022: Como usuario, quero configurar cor, ordem e tipo da categoria para melhorar leitura dos dashboards.

Aceite:

- Categoria possui cor de exibicao.
- Categoria possui ordem de exibicao.
- Categoria indica se representa despesa, receita ou tipo neutro.
- Interface usa essas configuracoes em listas e dashboards.

US-023: Como usuario, quero corrigir categorias manualmente e ensinar o sistema para futuras transacoes parecidas.

Aceite:

- Correcao manual marca a classificacao como `manual` com confianca `1.0`.
- Sistema pode criar ou atualizar regra deterministica de alta prioridade a partir da correcao.
- Regras aprendidas manualmente ficam visiveis e editaveis.
- Regra aprendida nao deve vazar dados sensiveis em logs.

US-024: Como usuario, quero revisar transacoes pendentes ou incertas para melhorar a qualidade da base.

Aceite:

- Filtro `revisao recomendada` inclui pendentes, baixa confianca, erro de IA e categoria generica.
- Usuario pode editar categoria/subcategoria individualmente.
- Usuario pode salvar alteracoes pendentes.
- Predicado de revisao recomendada existe fora da UI e possui teste automatizado.

US-025: Como usuario, quero aplicar categoria em lote sobre transacoes filtradas ou selecionadas para acelerar revisoes.

Aceite:

- Usuario escolhe entre aplicar no filtro atual ou nas linhas selecionadas.
- Tela mostra previa do total afetado antes de aplicar.
- Alteracao em lote nao sobrescreve categorias manuais sem confirmacao explicita.
- Resultado informa quantas transacoes foram alteradas.

US-026: Como usuario, quero ver quais transacoes casam com uma regra antes de alterar sua prioridade ou padrao.

Aceite:

- Tela de regras permite previsualizar transacoes afetadas.
- Preview respeita filtros de workspace.
- Alteracoes relevantes em regras exigem confirmacao quando afetarem muitas transacoes.

US-026A: Como usuario, quero editar regras de categorizacao existentes para corrigir criterios sem precisar excluir e recriar.

Aceite:

- Tela de regras permite alterar nome, campo, tipo de comparacao, padrao, categoria, prioridade e status ativo/inativo.
- Edicao valida campos obrigatorios e mostra mensagem clara quando houver erro.
- Ao salvar uma regra alterada, a lista reflete a nova configuracao sem recarregar a pagina.
- Usuario consegue aplicar regras apos editar e ver estado de aplicacao em andamento.
- Alteracoes relevantes devem preservar auditoria quando o historico de regras estiver disponivel.

US-027: Como administrador, quero historico de categorizacao para auditar mudancas importantes.

Aceite:

- Alteracoes de categoria registram origem anterior e nova origem.
- Historico registra usuario, data e fonte da mudanca quando disponivel.
- Historico pode ser consultado por transacao.

US-010: Como usuario, quero categorizacao por similaridade para reaproveitar classificacoes anteriores.

Aceite:

- Sistema compara novas transacoes com exemplos ja classificados.
- Sugestoes por similaridade registram fonte `embedding`.
- Sugestoes com baixa confianca ficam pendentes de revisao.

US-011: Como usuario, quero sugestoes por LLM apenas para casos ambiguos para melhorar classificacao sem aumentar custo desnecessariamente.

Aceite:

- LLM so e chamado quando regra e embedding nao resolvem com confianca suficiente.
- Resultado registra fonte `llm`, confianca e justificativa.
- Usuario pode aceitar ou corrigir a sugestao.

US-011A: Como usuario, quero que IA ajude a evoluir a normalizacao de descricoes para melhorar busca, deduplicacao e classificacao sem perder auditoria.

Aceite:

- Sistema sugere aliases ou nomes canonicos de estabelecimentos a partir do
  historico, sem alterar `raw_description`.
- Sugestoes por IA registram fonte, confianca, versao da estrategia e motivo
  resumido.
- Usuario pode aceitar, rejeitar ou ajustar sugestoes antes de aplicar em lote.
- Prompts e logs devem minimizar dados financeiros sensiveis e evitar valores,
  nomes reais de arquivos ou payload bruto.
- Estrategia deterministica continua sendo o fallback testavel e auditavel.

US-028: Como administrador, quero que categorizacao e recategorizacao em lote processem transacoes em pequenos lotes para evitar timeouts.

Aceite:

- Processamento usa lotes configuraveis.
- Resultado registra processadas, alteradas, ignoradas e erros.
- Importacao TXT/CSV nao depende de embedding/LLM para concluir.
- Processo pode ser retomado ou reexecutado sem duplicar classificacoes manuais.

US-029: Como usuario, quero regras por regex em fase futura para classificar descricoes mais complexas.

Aceite:

- Regex invalidas sao rejeitadas com mensagem clara.
- Regras regex possuem prioridade e podem ser ativadas/desativadas.
- Motor de regras continua avaliando regras simples antes de regex quando configurado.

US-029A: Como usuario, quero configurar regras financeiras para identificar pagamento de fatura, transferencia, estorno, receita e despesa.

Aceite:

- Tela de regras permite criar e editar regras de tipo financeiro alem de regras de categoria.
- Usuario pode classificar transacoes como `despesa`, `receita`, `pagamento_fatura`, `transferencia`, `estorno` ou `ignorar`.
- Pagamento de fatura deve ficar separado das despesas do cartao para evitar dupla contagem nos indicadores.
- Regra permite testar uma previa das transacoes afetadas antes de salvar ou aplicar.
- Alteracoes preservam auditoria de quem alterou, quando alterou, criterio anterior e novo criterio quando o historico estiver disponivel.
- Sistema deve manter regras deterministicas padrao para pagamentos comuns de fatura, mas permitir ajuste pelo usuario.

## Epic 7: Dashboards

US-012: Como usuario, quero dashboards financeiros para entender meus gastos e tendencias.

Aceite:

- Dashboard mostra gastos por mes.
- Dashboard mostra gastos por categoria.
- Dashboard permite filtrar periodo.

US-030: Como usuario, quero ver qualidade da categorizacao no dashboard para saber se os indicadores sao confiaveis.

Aceite:

- Dashboard mostra percentual categorizado manualmente, por regra, por IA e pendente.
- Dashboard destaca meses com muitas transacoes pendentes.
- Indicadores deixam claro quando ha baixa qualidade de classificacao.

US-031: Como usuario, quero drill-down dos graficos para chegar nas transacoes que explicam um valor.

Aceite:

- Clique em categoria, mes ou indicador abre lista filtrada de transacoes.
- Filtros aplicados ficam visiveis.
- Usuario pode voltar ao dashboard mantendo contexto.

US-032: Como usuario, quero alertas de aumento relevante por categoria para identificar mudancas de gasto.

Aceite:

- Sistema compara gasto da categoria com mes anterior.
- Alerta mostra categoria, variacao absoluta e percentual.
- Alerta ignora categorias com volume insuficiente conforme regra definida.
- Comparacao deve permitir abrir as transacoes da categoria no mes atual e no mes anterior.
- Interface deve destacar categorias com queda relevante, estabilidade e aumento relevante.

US-033: Como usuario, quero orcamento por categoria para acompanhar limites de gasto.

Aceite:

- Usuario define limite mensal por categoria.
- Dashboard mostra realizado versus orcado.
- Alertas indicam categorias proximas ou acima do limite.

US-034: Como usuario, quero identificar custos recorrentes para entender comprometimento mensal.

Aceite:

- Sistema sugere recorrencias por descricao, valor e periodicidade.
- Usuario pode recalcular recorrencias sob demanda.
- Dashboard mostra comprometimento recorrente estimado.
- Dashboard alerta quando uma recorrencia identificada tiver aumento percentual
  expressivo contra a media historica ou contra a ocorrencia anterior.
- Marcacao de recorrencia deve ser reversivel.
- Relatorio de custos fixos mensais recorrentes mostra descricao normalizada,
  categoria, valor medio, ultimo valor, quantidade de meses encontrados e
  variacao contra a media.
- Relatorio separa recorrencias provaveis de recorrencias confirmadas pelo
  usuario.
- Usuario consegue abrir as transacoes que sustentam cada recorrencia.

## Epic 7.1: Indicadores de Controle Financeiro

Mapa de indicadores para evolucao do dashboard:

- Camada 1, saude imediata: saldo de caixa atual, fluxo de caixa liquido, burn
  rate e runway.
- Camada 2, controle operacional: receita total por fonte, despesa total por
  tipo, percentual de comprometimento da receita e saving rate.
- Camada 3, cartao de credito: gasto no cartao do mes, comprometimento futuro do
  cartao e percentual da receita comprometida com cartao.
- Camada 4, inteligencia de produto: desvio contra media historica, top
  categorias consumidoras, gastos recorrentes e gasto por dia.
- Camada 5, previsibilidade: fluxo projetado 30/60/90 dias, saldo previsto no
  vencimento e alerta de deficit futuro.
- Camada 6, patrimonio: evolucao patrimonial e net worth.
- KPIs obrigatorios de produto SaaS: fluxo liquido, saldo projetado, parcelado
  futuro, burn rate e saving rate.
- Organizacao visual desejada do dashboard: linha 1 com saldo atual, fluxo
  liquido, burn rate e runway; linha 2 com receita, despesas, saving rate e
  comprometimento; linha 3 com fatura atual, parcelado futuro, gastos recorrentes
  e saldo projetado; linha 4 com top categorias, tendencia mensal, anomalias e
  evolucao patrimonial.

US-037: Como usuario, quero ver um resumo executivo mensal para entender rapidamente minha situacao financeira.

Aceite:

- Dashboard exibe receitas, despesas, saldo do periodo e taxa de poupanca.
- Indicadores mostram comparacao com mes anterior.
- Valores usam formato BRL e deixam claro o periodo analisado.
- Indicadores ignoram transacoes duplicadas e respeitam filtros ativos.

US-038: Como usuario, quero acompanhar fluxo de caixa por mes para identificar tendencia de sobra ou deficit.

Aceite:

- Grafico mensal mostra receitas, despesas e saldo.
- `Feito local parcial` Primeira tela dedicada de Fluxo de Caixa mostra grafico
  mensal ampliado, fatura separada, resumo do periodo e drill-down para
  transacoes por mes, tipo financeiro, categoria e recorrencia.
- Usuario consegue alternar entre visao de competencia e caixa quando os dados permitirem.
- Mes atual mostra projecao de fechamento apenas quando houver base suficiente.
- Drill-down leva para as transacoes que compoem cada valor.

US-039: Como usuario, quero separar gastos fixos, variaveis e eventuais para controlar o que posso ajustar.

Aceite:

- Categorias ou regras podem marcar gasto como fixo, variavel ou eventual.
- Dashboard mostra participacao percentual de cada tipo no total de despesas.
- Indicador destaca aumento de gastos variaveis frente ao mes anterior.

US-040: Como usuario, quero acompanhar comprometimento de renda com gastos recorrentes para saber quanto ja esta comprometido no mes.

Aceite:

- Dashboard calcula total recorrente estimado.
- Indicador compara recorrencias com receitas do periodo.
- Sistema mostra lista das principais recorrencias e ultima ocorrencia detectada.
- Usuario pode revisar ou desfazer marcacao de recorrencia.

US-041: Como usuario, quero acompanhar gastos por categoria e subcategoria para descobrir onde o dinheiro esta indo.

Aceite:

- Dashboard mostra ranking de categorias por valor.
- Categoria pode expandir para subcategorias quando existirem.
- Indicador mostra variacao absoluta e percentual contra mes anterior.
- Usuario consegue abrir transacoes daquela categoria/subcategoria.
- Resumo da categoria deve mostrar valor total, quantidade de transacoes,
  participacao percentual no total de despesas do periodo, ticket medio e
  variacao contra o mes anterior.
- Resumo deve diferenciar categoria pai e subcategorias quando aplicavel.
- Resumo deve permitir abrir transacoes filtradas pela categoria e periodo.

US-041A: Como usuario, quero analisar gastos por dia da semana para entender padroes de consumo.

Aceite:

- Relatorio mostra despesas agregadas por dia da semana no periodo filtrado.
- Indicador mostra valor total, quantidade de transacoes e ticket medio por dia.
- Visual deve permitir comparar dias uteis e fim de semana.
- Usuario consegue abrir transacoes de um dia da semana dentro do periodo.
- Pagamentos de fatura devem ficar fora da analise de gastos.

US-042: Como usuario, quero identificar estabelecimentos ou descricoes que mais impactam meus gastos.

Aceite:

- Dashboard mostra top descricoes/estabelecimentos por valor e quantidade.
- Nomes devem ser normalizados para reduzir duplicidade visual.
- Usuario consegue filtrar por categoria, periodo e origem.

US-043: Como usuario, quero acompanhar cartao de credito para prever fatura e evitar surpresa no fechamento.

Aceite:

- Dashboard mostra despesas de cartao por periodo.
- Quando houver data de fatura/vencimento, indicador mostra previsao por fatura.
- Pagamentos de fatura aparecem separados de despesas do cartao.
- Indicador sinaliza possiveis faturas sem pagamento conciliado quando a conciliacao existir.
- `Backlog evolucao` Usuario pode cadastrar fechamento e vencimento por cartao
  para que parcelas identificadas, parcelado futuro e previsao de fatura usem a
  competencia correta. Enquanto nao houver cadastro, o sistema usa fallback
  configuravel e deve indicar essa premissa quando relevante.

US-043A: Como usuario, quero que o sistema detecte dados basicos do meu cartao e faturas para melhorar a previsao com minimo input manual.

Aceite:

- Importacoes de fatura devem tentar identificar cartao, emissor/bandeira,
  competencia, fechamento, vencimento, total e status quando esses dados
  existirem no arquivo.
- Quando uma fatura for identificada com confianca suficiente, o sistema deve
  criar ou atualizar a fatura automaticamente para o workspace.
- Quando o cartao ainda nao existir, o sistema deve sugerir/criar um cartao
  derivado da fatura, pedindo confirmacao apenas quando houver ambiguidade.
- Cadastro manual de cartao/fatura fica disponivel como correcao ou fallback,
  mas nao deve ser caminho obrigatorio para importacoes normais.
- Fechamento e vencimento sao validados como dias/datas validas antes de afetar
  parcelas e previsoes.
- Usuario pode editar dados detectados sem reimportar arquivos.
- Projecao de parcelas e parcelado futuro passam a usar `closing_day` do cartao
  quando o cartao da transacao for conhecido.
- Quando nao houver cartao identificado, o sistema usa configuracao padrao do
  workspace e mostra a premissa.
- Status da fatura (`aberta`, `fechada`, `paga`, `parcial`) deve ser inferido
  quando possivel e permanecer editavel pelo usuario.

US-044: Como usuario, quero comparar gasto real contra orcamento para agir antes de estourar limites.

Aceite:

- Usuario define orcamento mensal por categoria.
- Dashboard mostra realizado, orcado, saldo e percentual consumido.
- Categorias proximas do limite e acima do limite ficam destacadas.
- Drill-down mostra transacoes responsaveis pelo consumo do orcamento.

US-045: Como usuario, quero alertas financeiros acionaveis para focar no que precisa de atencao.

Aceite:

- Alertas cobrem aumento relevante por categoria, aumento expressivo em gastos
  recorrentes, gasto acima do orcamento, queda de receita e excesso de pendencias
  de categorizacao.
- Cada alerta mostra motivo, valor envolvido e atalho para revisar transacoes.
- Alertas devem evitar ruído quando o volume de dados for insuficiente.

US-046: Como usuario, quero medir qualidade dos dados para confiar nos indicadores.

Aceite:

- Dashboard mostra percentual de transacoes categorizadas, pendentes, com baixa confianca e com erro de importacao.
- Dashboard mostra importacoes recentes com erro ou duplicidade.
- Indicadores financeiros sinalizam quando a qualidade dos dados pode distorcer a leitura.

US-047: Como usuario, quero uma visao de evolucao patrimonial simples para acompanhar saldo acumulado ao longo do tempo.

Aceite:

- Dashboard calcula saldo acumulado a partir de receitas e despesas importadas.
- Indicador deixa claro que nao substitui saldo bancario real enquanto nao houver integracao bancaria.
- Usuario pode filtrar por conta/origem quando essa informacao estiver disponivel.

US-068: Como usuario, quero acompanhar saldo atual, burn rate e runway para entender minha saude financeira imediata.

Aceite:

- Dashboard exibe saldo atual informado ou calculado a partir das contas disponiveis.
- Fluxo de caixa liquido continua sendo o KPI principal e deve indicar alerta
  quando o periodo ficar negativo.
- Burn rate calcula gasto medio mensal com base em despesas recorrentes e/ou media dos ultimos meses.
- Runway calcula autonomia financeira como `saldo disponivel / burn rate`.
- Indicadores deixam claro a origem dos dados e quando o calculo for estimado.
- Quando nao houver saldo real integrado, a interface deve sinalizar que o saldo e uma estimativa operacional.

US-069: Como usuario, quero ver comprometimento da receita para saber se meus gastos estao saudaveis.

Aceite:

- Dashboard calcula `% comprometimento` como `despesas totais / receita total`.
- Dashboard calcula `saving rate` como `fluxo liquido / receita total`.
- Receita total deve permitir separacao por fonte, como salario, freelance,
  dividendos, cashback e outros.
- Despesa total deve permitir separacao por tipo, como fixas, variaveis e
  extraordinarias.
- Indicadores usam faixas de leitura: excelente, saudavel, atencao e risco.
- Valores devem respeitar o periodo filtrado e ignorar pagamentos de fatura para evitar dupla contagem.
- Drill-down permite abrir receitas, despesas e pagamentos considerados no calculo.

US-070: Como usuario, quero acompanhar comprometimento futuro do cartao para enxergar dividas invisiveis.

Aceite:

- Dashboard mostra fatura atual, gasto no cartao no periodo, parcelado futuro e recorrentes do cartao.
- Parcelado futuro soma parcelas ainda nao vencidas quando houver informacao suficiente.
- `% receita comprometida com cartao` compara fatura/compromisso do cartao com receita do periodo.
- Indicador alerta quando o cartao ultrapassar limite configurado, inicialmente meta de referencia menor que 30% da receita.
- A tela deve separar compra, fatura e pagamento para evitar dupla contagem.
- Comprometimento futuro do cartao deve evidenciar divida invisivel gerada por
  parcelas futuras e recorrencias do cartao.

US-071: Como usuario, quero fluxo de caixa projetado para prever saldo nos proximos 30, 60 e 90 dias.

Aceite:

- Projecao considera receitas recorrentes, despesas recorrentes, parcelas futuras, assinaturas e faturas conhecidas.
- Dashboard mostra saldo previsto em datas criticas, incluindo vencimento da fatura quando disponivel.
- Sistema alerta quando houver risco de saldo negativo futuro.
- Alerta de deficit futuro deve responder claramente quando o saldo pode ficar
  negativo, em quantos dias e qual valor estimado.
- Projecao deve indicar melhor cenario, pior cenario e premissas usadas quando houver dados suficientes.
- Usuario consegue abrir os lancamentos ou recorrencias que sustentam a projecao.

US-072: Como usuario, quero um score de saude financeira para resumir minha situacao sem esconder os detalhes.

Aceite:

- Score considera fluxo liquido, saving rate, comprometimento da receita, recorrencias, risco de deficit futuro, pendencias de categorizacao e qualidade dos dados.
- Score deve ser explicavel, com os fatores positivos e negativos mais relevantes.
- Score nao deve substituir os indicadores detalhados nem prometer resultado financeiro.
- Interface deve permitir abrir os indicadores que explicam a nota.
- Quando a qualidade dos dados for baixa, score deve aparecer como preliminar.

US-073: Como usuario, quero uma visao de patrimonio e net worth para acompanhar ativos e passivos.

Aceite:

- Tela permite registrar ou importar saldos de contas, investimentos, previdencia, cripto, emprestimos, parcelas e outras dividas.
- Net worth calcula `ativos - passivos`.
- Evolucao patrimonial mostra tendencia mensal.
- Dashboard diferencia fluxo de caixa operacional de patrimonio acumulado.
- Dados patrimoniais devem ter auditoria de origem, data de referencia e ultima atualizacao.

US-074: Como usuario, quero uma tela executiva de dashboard em formato de narrativa financeira para entender o mes rapidamente.

Aceite:

- Primeira visao conta a historia do periodo: recebeu, gastou, economizou, fatura atual e saldo projetado.
- Linha principal prioriza saldo atual, fluxo liquido, burn rate, runway, saving rate e comprometimento.
- Paineis abaixo mostram entradas x saidas, top categorias, cartoes, fluxo projetado e insights.
- Layout deve seguir visual moderno, responsivo e focado em leitura rapida, inspirado nas referencias de tela fornecidas em 2026-05-23.
- O dashboard deve permitir navegacao natural para telas dedicadas, como fluxo de
  caixa, transacoes, cartoes, orcamentos, investimentos, metas, relatorios e
  insights.
- Mudancas visuais desse dashboard devem ser agrupadas em pacote unico de frontend e testadas localmente antes da subida.

US-075: Como usuario, quero alertas premium com IA para receber recomendacoes acionaveis sobre minha saude financeira.

Aceite:

- Alertas detectam gasto acima da media historica, assinatura esquecida, queda de receita, risco de deficit futuro e recorrencia com aumento expressivo.
- Alertas premium devem apoiar previsao de gasto do mes, risco de ficar negativo,
  recomendacao automatica de corte e classificacao de saude financeira.
- Cada alerta informa impacto financeiro, motivo e acao sugerida.
- IA pode gerar recomendacao em linguagem natural, mas deve se apoiar em indicadores calculados e rastreaveis.
- Usuario pode abrir as transacoes, categorias ou recorrencias que explicam o alerta.
- Alertas devem respeitar minimizacao de dados sensiveis em prompts e logs.

## Epic 7.2: Copilot Financeiro Conversacional

US-048: Como usuario, quero conversar com um copilot financeiro sobre a saude da minha carteira para entender minha situacao sem precisar interpretar todos os graficos.

Aceite:

- Chat responde usando apenas dados do workspace ativo.
- Resposta informa periodo analisado, filtros usados e principais numeros considerados.
- Copilot destaca saldo, despesas, receitas, taxa de poupanca, pendencias de categorizacao e qualidade dos dados.
- Quando a qualidade dos dados for baixa, resposta deve avisar que a analise pode estar incompleta.
- Interface segue a referencia `AI COpilot.png`, com lista de conversas,
  mensagens, perguntas rapidas, campo de pergunta e painel lateral de resumo
  financeiro.
- Conversas e mensagens devem ser persistidas por workspace/familia quando o
  backend de IA estiver ativo.

US-049: Como usuario, quero perguntar se posso fazer um gasto especifico para decidir com mais seguranca.

Aceite:

- Usuario informa valor, categoria e horizonte desejado.
- Copilot compara o gasto com saldo do periodo, ritmo de despesas, recorrencias conhecidas e orcamentos quando existirem.
- Resposta classifica a recomendacao como `seguro`, `atenção` ou `nao recomendado`.
- Resposta explica os motivos e mostra quais dados sustentam a recomendacao.
- Copilot deve deixar claro que e apoio de planejamento, nao consultoria financeira profissional.
- Fluxo deve suportar `simular compra`, mostrando impacto no saldo projetado,
  risco de saldo negativo, atraso em metas e recomendacao acionavel.

US-050: Como usuario, quero receber sugestoes de como gastar melhor para melhorar minha saude financeira.

Aceite:

- Copilot identifica categorias com aumento relevante, gastos variaveis altos e recorrencias que merecem revisao.
- Sugestoes devem ser acionaveis, como revisar categoria, reduzir frequencia, definir limite ou categorizar pendencias.
- Cada sugestao deve ter impacto estimado quando houver dados suficientes.
- Usuario consegue abrir as transacoes relacionadas a uma sugestao.

US-051: Como usuario, quero perguntar "o que fazer agora" e receber um plano de acao financeiro simples.

Aceite:

- Copilot gera ate 3 proximas acoes priorizadas.
- Acoes podem incluir revisar pendencias, categorizar transacoes, reduzir uma categoria, conferir importacao com erro ou definir orcamento.
- Cada acao informa motivo, impacto esperado e link/atalho para a tela correspondente.
- Plano deve evitar recomendacoes genericas quando os dados forem insuficientes.

US-052: Como usuario, quero que o copilot explique qualquer resposta com rastreabilidade para confiar nas recomendacoes.

Aceite:

- Toda resposta relevante inclui fontes de dados: periodo, quantidade de transacoes e indicadores usados.
- Quando citar uma categoria ou gasto, deve permitir navegar para as transacoes relacionadas.
- Copilot nao deve expor dados financeiros em logs.
- Prompt, resposta, modelo e versao de estrategia podem ser auditados sem armazenar dados sensiveis desnecessarios.
- Respostas devem registrar quais ferramentas internas foram usadas, como
  `get_cashflow_summary`, `get_projection`, `get_credit_cards`,
  `get_budgets`, `get_goals`, `get_investments`, `get_subscriptions`,
  `simulate_purchase`, `simulate_scenario` e `calculate_safe_spend`.

US-053: Como administrador, quero limites de seguranca para o copilot financeiro para evitar respostas perigosas ou caras.

Aceite:

- Copilot deve recusar pedidos fora do escopo financeiro do workspace.
- Copilot nao deve prometer retorno, investimento garantido ou aconselhamento profissional.
- Chamadas ao LLM devem ter limite de custo, timeout e fallback.
- Respostas devem preferir dados agregados e minimizacao de dados sensiveis.
- Chat completo fica fora do caminho critico de importacao e categorizacao.
- APIs planejadas incluem `POST /api/ai/chat`, `POST /api/ai/simulate-purchase`,
  `POST /api/ai/safe-spend`, `POST /api/ai/financial-health`,
  `POST /api/ai/optimize-budget` e `GET /api/ai/conversations`.

## Epic 8: Conciliacao

US-013: Como usuario, quero conciliar pagamentos de fatura no extrato com cartoes para entender se as faturas foram pagas corretamente.

Aceite:

- Sistema sugere conciliacoes por valor e periodo.
- Usuario pode aceitar ou rejeitar sugestoes.
- Conciliacao aceita fica registrada.

US-035: Como usuario, quero separar data da compra e data de vencimento/pagamento quando aplicavel para analisar competencia e caixa.

Aceite:

- Transacoes de cartao podem guardar data de compra e data de fatura/vencimento.
- Consultas deixam claro qual data esta sendo filtrada.
- Dashboards podem usar competencia ou caixa conforme decisao de produto.

## Epic 9: PDF

US-014: Como usuario, quero importar PDFs de fatura em uma fase futura para reduzir conversao manual.

Aceite:

- PDF e enviado e armazenado.
- Sistema identifica emissor/layout quando possivel.
- Transacoes sao extraidas com validacao.
- Falhas ficam disponiveis para revisao.

US-036: Como usuario, quero importar PDF de fatura Itau em uma fase futura com extracao validada.

Aceite:

- Parser identifica fatura Itau quando layout for suportado.
- Transacoes extraidas preservam linha/texto de origem quando possivel.
- Parser diferencia data da compra e data da fatura quando disponivel.
- Fixtures usadas em testes devem ser anonimizadas.

## Epic 10: Internacionalizacao

US-054: Como usuario, quero alternar o idioma do site entre portugues e ingles para usar a aplicacao no idioma preferido.

Aceite:

- Idioma padrao deve ser portugues do Brasil.
- Usuario consegue alternar para ingles pela interface.
- Preferencia de idioma deve ser persistida por usuario ou, no minimo, no navegador
  enquanto nao houver configuracao de perfil.
- Textos de navegacao, formularios, tabelas, estados vazios, erros e indicadores
  principais devem usar o idioma selecionado.
- Valores monetarios e datas devem respeitar locale compativel com o idioma
  selecionado, mantendo moeda BRL por padrao no MVP.

## Epic 11: Evolucao Arquitetural AWS Serverless

US-057: Como Tech Lead, quero avaliar a migracao para uma arquitetura AWS serverless completa para reduzir custo operacional e acelerar deploys futuros.

Aceite:

- Avaliacao compara o estado atual com Amplify Hosting, Lambda, API Gateway,
  S3, DynamoDB e Cognito.
- Resultado separa ganhos esperados, riscos, custo estimado, impacto no roadmap
  e esforco de migracao.
- Decisao deve indicar se a migracao sera feita em uma etapa unica, por fases ou
  como arquitetura hibrida.
- Avaliacao deve considerar LGPD, isolamento por workspace, auditoria financeira
  e minimizacao de dados sensiveis em logs.

US-058: Como usuario, quero que a autenticacao seja migrada para Amazon Cognito para manter login seguro dentro da stack AWS.

Aceite:

- Cognito deve suportar email e senha.
- Login com Google deve permanecer suportado ou planejado sem redesenho.
- Backend deve validar JWT do Cognito em rotas protegidas.
- Primeiro acesso deve continuar criando usuario, workspace e papel `owner`.
- Migracao deve prever convivencia ou corte seguro com usuarios existentes.

US-059: Como operador, quero armazenar arquivos financeiros brutos no Amazon S3 para ter storage duravel e barato.

Aceite:

- Uploads TXT/CSV/PDF devem ser gravados em bucket S3 por workspace.
- Objetos devem usar criptografia em repouso.
- Chaves de objeto nao devem expor nomes ou dados financeiros sensiveis.
- Backend deve usar URL assinada ou fluxo equivalente quando isso reduzir carga
  da API.
- Metadados de importacao devem continuar rastreando arquivo, hash e origem.

US-060: Como Tech Lead, quero processar importacoes em Lambda de forma assincrona para evitar timeout e melhorar resiliencia.

Aceite:

- Upload e processamento pesado nao devem depender de uma unica requisicao HTTP
  longa.
- Cada arquivo deve gerar job rastreavel com status, contadores, erros e
  reprocessamento idempotente.
- Falha em uma importacao nao deve bloquear outras importacoes do mesmo lote.
- Lotes grandes, como dezenas de arquivos historicos, devem ser enfileirados e
  processados com progresso consultavel, sem estourar timeout do API Gateway ou
  da Lambda sincrona.
- Logs nao devem conter descricoes completas, valores financeiros reais ou
  conteudo bruto de arquivos.

US-061: Como Tech Lead, quero fazer uma POC de DynamoDB antes de migrar o banco principal para garantir que dashboards e auditoria continuem eficientes.

Aceite:

- POC deve modelar os principais padroes de acesso: workspace, periodo,
  transacoes paginadas, ordenacao por data, categoria, dashboard mensal,
  qualidade de dados, regras, auditoria e conciliacao.
- POC deve evitar scans como caminho principal de dashboard ou listagem.
- POC deve estimar custo para carga inicial historica e uso mensal recorrente.
- POC deve comparar DynamoDB puro, PostgreSQL atual e alternativa hibrida
  DynamoDB + S3/arquivos + jobs analiticos.
- Migracao para DynamoDB so pode seguir se os padroes de consulta ficarem
  claros, testados e documentados.

## Epic 12: Seguranca AWS e Prontidao para Dados Reais

US-062: Como administrador, quero remover acessos de demo/local auth do ambiente online antes de usar dados reais para evitar acesso indevido.

Aceite:

- `ALLOW_LOCAL_AUTH` deve ficar desabilitado em qualquer ambiente com dados reais.
- Backend deve rejeitar token local/demo fora de ambiente explicitamente local.
- Rotas protegidas devem exigir JWT valido do provedor de autenticacao aprovado.
- CI/deploy deve impedir promocao para producao quando auth de demo estiver
  habilitada.

US-063: Como Tech Lead, quero fechar CORS e exposicao publica da API para permitir apenas origens oficiais.

Aceite:

- CORS de producao deve aceitar somente o dominio oficial do Amplify e dominios
  customizados aprovados.
- `localhost`, `127.0.0.1` e curingas devem ficar restritos a ambiente local ou
  desenvolvimento.
- API Gateway deve manter throttling/rate limit configurado.
- Endpoints administrativos, internos ou de diagnostico nao devem ficar expostos
  sem autenticacao.

US-064: Como administrador, quero proteger segredos e configuracoes sensiveis para evitar vazamento de credenciais.

Aceite:

- Secrets devem ficar em GitHub Secrets, AWS Secrets Manager ou mecanismo
  equivalente aprovado.
- Terraform state nao deve armazenar secrets de banco, Supabase, Cognito ou
  provedores de IA.
- Nenhum secret pode ser commitado no repositorio.
- Pipeline deve documentar quais variaveis sao secrets e quais sao variables.

US-065: Como administrador, quero configurar guardrails de conta AWS para reduzir risco operacional e financeiro.

Aceite:

- Conta root deve ter MFA e nao deve possuir access keys ativas.
- GitHub Actions deve usar OIDC e IAM role com menor privilegio possivel.
- IAM roles devem ser revisadas para evitar permissoes amplas desnecessarias.
- AWS Budgets deve alertar quando custo mensal passar de limites definidos.
- CloudTrail deve estar ativo para auditoria de acoes na conta.

US-066: Como Tech Lead, quero hardening de API Gateway e Lambda para reduzir abuso e vazamento de dados sensiveis.

Aceite:

- API Gateway deve ter access logs com retencao curta e sem payload financeiro,
  headers de autorizacao, nomes reais de arquivos ou valores.
- Lambda deve evitar persistir dados sensiveis em `/tmp`, variaveis globais ou
  logs entre invocacoes.
- Timeout, memoria e concorrencia devem ser revisados para controlar custo e
  superficie de abuso.
- WAF deve ser avaliado antes de abrir uso para dados reais ou usuarios externos.
- Alertas devem cobrir erros 5xx, aumento de latencia e aumento anormal de
  invocacoes.

US-067: Como operador, quero que buckets S3 usados por arquivos financeiros sejam privados e tenham ciclo de vida definido.

Aceite:

- S3 Block Public Access deve estar habilitado.
- Objetos devem ser criptografados em repouso.
- Bucket policy deve negar acesso publico.
- Chaves de objetos nao devem conter nomes reais de arquivos, descricoes ou
  dados financeiros.
- Arquivos temporarios, previews e artefatos intermediarios devem ter lifecycle
  de expiracao.
- Retencao de arquivos originais deve ser definida antes de producao conforme
  necessidade do produto e LGPD.
