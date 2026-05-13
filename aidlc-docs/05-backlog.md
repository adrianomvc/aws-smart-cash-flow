# Backlog

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

## Epic 2: Ingestao TXT

US-003: Como operador, quero importar extrato TXT para carregar lancamentos de conta corrente.

Aceite:

- Parser le formato `dd/MM/yyyy;descricao;valor`.
- Valor brasileiro com virgula e convertido corretamente.
- Linhas invalidas geram `ImportError`.

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
- Importacoes repetidas ficam rastreaveis.

## Epic 5: Interface Operacional

US-006: Como operador, quero ver status de importacao e erros para agir rapidamente.

Aceite:

- Lista importacoes com status e contadores.
- Detalhe mostra erros por linha.
- Tela nao expõe dados desnecessarios.

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
- Alteracoes ficam persistidas.

US-009: Como usuario, quero regras automaticas de categorizacao para reduzir trabalho manual.

Aceite:

- Regras por texto da descricao podem ser cadastradas.
- Regras sao aplicadas apos importacao.
- Categoria manual prevalece sobre regra automatica.
- Regras deterministicas fazem parte do MVP 1.

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

## Epic 7: Dashboards

US-012: Como usuario, quero dashboards financeiros para entender meus gastos e tendencias.

Aceite:

- Dashboard mostra gastos por mes.
- Dashboard mostra gastos por categoria.
- Dashboard permite filtrar periodo.

## Epic 8: Conciliacao

US-013: Como usuario, quero conciliar pagamentos de fatura no extrato com cartoes para entender se as faturas foram pagas corretamente.

Aceite:

- Sistema sugere conciliacoes por valor e periodo.
- Usuario pode aceitar ou rejeitar sugestoes.
- Conciliacao aceita fica registrada.

## Epic 9: PDF

US-014: Como usuario, quero importar PDFs de fatura em uma fase futura para reduzir conversao manual.

Aceite:

- PDF e enviado e armazenado.
- Sistema identifica emissor/layout quando possivel.
- Transacoes sao extraidas com validacao.
- Falhas ficam disponiveis para revisao.
