# Working Agreement

Este acordo define como conduzimos as evolucoes do SmartCashFlow para manter
velocidade, contexto e seguranca.

## Ritual de Execucao

1. Antes de implementar, consultar o `Controle Operacional de Entrega` em
   `aidlc-docs/05-backlog.md`.
2. Informar qual pacote e qual item serao trabalhados.
3. Para itens maiores, registrar um resumo curto antes da execucao:
   - objetivo;
   - arquivos ou areas provaveis;
   - risco principal;
   - validacao esperada.
4. Ao concluir, informar:
   - o que mudou;
   - o que o usuario deve testar;
   - quais validacoes automatizadas foram executadas;
   - status atualizado do pacote;
   - proximo item recomendado.

## Cabecalho de Item Novo

Ao iniciar um item novo, informar de forma curta:

- `Pacote`: pacote operacional atual.
- `Item`: ajuste ou entrega especifica.
- `Por que agora`: motivo da prioridade.
- `Fora de escopo`: o que nao sera mexido neste item.
- `Validacao`: como o item sera confirmado.

Esse cabecalho deve aparecer antes de alteracoes relevantes, especialmente em
itens de risco medio ou alto.

## Classificacao de Casos Reais

Quando o usuario trouxer um caso real observado em teste, classificar antes de
agir:

- `Bug agora`: bloqueia validacao ou distorce dado/indicador.
- `UX agora`: impede entendimento, acao segura ou validacao do fluxo atual.
- `Backlog evolucao`: melhoria importante, mas fora do pacote atual.
- `Decisao produto`: precisa de escolha explicita de regra, comportamento ou
  criterio.

Essa classificacao deve orientar se o item entra no pacote atual ou se sera
registrado para evolucao.

## Higiene de Contexto

- Para cada item, carregar apenas o contexto necessario para aquele trabalho.
- Preferir buscas pontuais com `rg` em vez de reler arquivos grandes inteiros.
- Ler o backlog completo apenas quando o objetivo for reorganizacao de backlog.
- Para implementacao, consultar somente:
  - o bloco do pacote atual em `aidlc-docs/05-backlog.md`;
  - os trechos relevantes de `aidlc-docs/03-sdd-specification.md`;
  - decisoes relacionadas em `aidlc-docs/06-decisions-risks.md`, quando houver;
  - arquivos e testes diretamente envolvidos.
- Antes de item grande, declarar:
  - objetivo;
  - escopo;
  - arquivos provaveis;
  - o que nao sera mexido;
  - validacao esperada.
- Ao final, registrar no backlog/status o suficiente para retomada futura, sem
  depender da conversa longa.

## Definition of Done por Pacote

Um pacote so deve ser considerado fechado quando:

- comportamento novo ou alterado estiver refletido na especificacao ou backlog;
- testes automatizados aplicaveis tiverem sido executados;
- lint/build aplicaveis tiverem sido executados;
- quando houver frontend, localhost estiver pronto para validacao do usuario;
- status operacional tiver sido atualizado;
- riscos e decisoes relevantes tiverem sido registrados.

## Checklist de Commit e PR

Antes de commit ou abertura de PR, conferir:

- pacote atual e status atualizados em `aidlc-docs/05-backlog.md`;
- especificacao atualizada em `aidlc-docs/03-sdd-specification.md`, quando houver
  mudanca de comportamento;
- decisao registrada em `aidlc-docs/06-decisions-risks.md`, quando houver impacto
  futuro ou trade-off relevante;
- testes automatizados aplicaveis executados;
- lint/build aplicaveis executados;
- se houver frontend, usuario validou localmente ou a pendencia ficou explicita;
- nenhum dado financeiro real foi adicionado a logs, fixtures ou documentacao sem
  anonimizacao;
- changelog/tag avaliados quando a entrega representar release ou marco.

## Status Operacional

Usar os status definidos no backlog:

- `Todo`
- `Em andamento`
- `Feito local`
- `Validacao usuario`
- `Validado usuario`
- `Commitado`
- `Publicado`
- `Backlog evolucao`

Mudancas devem mover itens de status de forma explicita. Se o usuario validar no
localhost, atualizar para `Validado usuario` antes de commit/publicacao.

## Gestao de Escopo

- Correcoes que bloqueiam validacao entram no pacote atual.
- Ideias boas que nao bloqueiam validacao entram como `Backlog evolucao`.
- Proximos pacotes devem ser pequenos o suficiente para validar localmente.
- O backlog completo continua sendo a fonte de escopo; o controle operacional e
  a visao curta de execucao.

## Decisoes e Riscos

- Decisoes que podem afetar comportamento futuro devem ser registradas em
  `aidlc-docs/06-decisions-risks.md`.
- Exemplos de decisoes a registrar:
  - estrategia de duplicidade;
  - regra de normalizacao;
  - criterio de indicadores;
  - escolha de arquitetura;
  - trade-off entre custo, performance e seguranca.
- Riscos devem ficar visiveis antes de mudancas em banco, auth, infra,
  producao, importacao ou calculos financeiros.

Formato recomendado para decisoes:

- `Data`: data da decisao.
- `Decisao`: escolha objetiva.
- `Motivo`: por que essa opcao foi escolhida.
- `Impacto`: quais fluxos, dados ou usuarios sao afetados.
- `Risco`: o que pode dar errado.
- `Validacao`: como saberemos que funcionou.
- `Reversao`: como voltar atras ou evoluir se necessario.

## Fora de Escopo

- Cada pacote deve indicar o que nao sera mexido quando houver risco de expandir
  demais a entrega.
- Ajustes fora do pacote atual devem ir para `Backlog evolucao`, exceto quando
  bloquearem a validacao do MVP.
- Refatoracoes amplas devem ser evitadas dentro de pacotes de validacao de
  produto, salvo quando forem necessarias para corrigir o comportamento.

## Nivel de Risco

Classificar mentalmente cada pacote antes da execucao:

- `Baixo`: texto, UX writing, ajuste visual isolado, documentacao.
- `Medio`: regra de negocio testavel, parser, normalizacao, filtros,
  dashboards, acoes de tela com confirmacao.
- `Alto`: banco, migracao, autenticacao, autorizacao, infraestrutura, deploy,
  producao, dados reais ou alteracoes destrutivas em lote.

Pacotes de risco medio ou alto devem ter testes automatizados ou uma justificativa
clara quando algum teste nao for possivel.

## Frontend

- Mudancas de frontend devem ser agrupadas em pacotes coesos.
- Todo pacote com frontend deve ser testado localmente antes de subida.
- Antes de finalizar pacote com frontend, executar `npm run lint` e
  `npm run build`.
- Aplicar UX Research, Product Design, UX, UI e UX Writing em todos os fluxos,
  priorizando clareza operacional, seguranca de acoes destrutivas e linguagem
  simples para o usuario final.

## Backend e Dados

- Mudancas de comportamento devem atualizar `aidlc-docs/03-sdd-specification.md`
  antes ou junto da implementacao.
- Mudancas em parser, importacao, deduplicacao, categorizacao ou persistencia
  devem incluir testes automatizados focados.
- Nao registrar dados financeiros reais em logs, fixtures ou documentacao sem
  anonimizar.

## Git e Deploy

- Nao fazer commit ou push sem pedido explicito do usuario.
- Antes de commit, confirmar quais arquivos entram no pacote.
- Se houver frontend no pacote, o usuario deve testar localmente antes da subida.
- Depois de commit/deploy, atualizar o status operacional para `Commitado` ou
  `Publicado`.
