# Requirements

## Personas

Operador financeiro:

- Importa arquivos.
- Confere status de processamento.
- Corrige ou reprocessa arquivos com erro.

Analista financeiro:

- Consulta lancamentos normalizados.
- Filtra por periodo, conta, cartao, origem e categoria futura.

Usuario final / casal:

- Usa uma conta compartilhada para acompanhar financas familiares.
- Importa arquivos manualmente.
- Consulta dashboards e categorias.

Administrador tecnico:

- Configura origens, acompanha falhas e monitora integridade da base.

## Requisitos Funcionais

RF-001: O sistema deve aceitar arquivos `.txt` e `.csv` no MVP, deixando `.pdf` para fase posterior.

RF-002: O sistema deve permitir upload manual de arquivos pela aplicacao.

RF-003: O sistema deve identificar o layout do arquivo antes do processamento.

RF-004: O sistema deve converter cada registro valido para o modelo canonico de transacao.

RF-005: O sistema deve persistir arquivo, linhas brutas, importacao, transacoes e erros de parsing.

RF-006: O sistema deve impedir duplicidade ao reprocessar o mesmo arquivo.

RF-007: O sistema deve permitir consultar importacoes por status.

RF-008: O sistema deve permitir consultar transacoes por periodo, origem, categoria e texto de descricao.

RF-009: O sistema deve registrar erros por linha, campo e motivo.

RF-010: O sistema deve permitir reprocessar uma importacao corrigida ou atualizada.

RF-011: O sistema deve manter o valor monetario com precisao decimal, sem float.

RF-012: O sistema deve suportar isolamento de dados por usuario/conta compartilhada.

RF-013: O sistema deve permitir categorizacao manual de transacoes.

RF-014: O sistema deve permitir categorizacao automatica por regras no MVP evolutivo.

RF-015: O sistema deve gerar dashboards por periodo, categoria e origem.

RF-016: O sistema deve apoiar conciliacao entre pagamentos no extrato e faturas de cartao.

RF-017: O sistema deve permitir autenticacao por usuario e senha.

RF-018: O sistema deve suportar login com Google ou manter arquitetura compativel com esse provedor.

## Requisitos Nao Funcionais

RNF-001: Dados financeiros nao devem aparecer em logs de aplicacao, traces ou mensagens de erro externas.

RNF-002: O parsing de TXT/CSV deve processar arquivos pequenos em segundos no ambiente local.

RNF-003: O banco deve garantir unicidade logica para evitar duplicacao de lancamentos.

RNF-004: O sistema deve ter testes automatizados para cada layout suportado.

RNF-005: O design deve permitir adicionar novos layouts sem alterar parsers existentes.

RNF-006: O sistema deve usar migracoes versionadas para schema do banco.

RNF-007: O sistema deve separar dados brutos, dados normalizados e erros.

RNF-008: O custo operacional deve ser proximo a zero no volume inicial esperado.

RNF-009: A arquitetura deve permitir multiusuarios sem vazamento de dados entre contas.

RNF-010: O sistema deve suportar uma carga inicial de aproximadamente 300 arquivos e 10.000 linhas/transacoes com custo proximo a zero.

RNF-011: O sistema deve diferenciar carga historica inicial de importacoes recorrentes, permitindo processamento em lotes pequenos para evitar timeout em ambiente serverless gratuito.

## Criterios de Aceite do MVP

- Um TXT de extrato enviado por upload e convertido para transacoes canonicas.
- Um CSV de fatura enviado por upload e convertido para transacoes canonicas.
- PDF nao faz parte do processamento inicial.
- As transacoes sao gravadas em banco com referencia ao arquivo original.
- As linhas brutas sao preservadas.
- Reprocessar o mesmo arquivo nao duplica dados.
- Registros invalidos aparecem como erros de importacao.
- Ha uma tela ou endpoint para listar importacoes e seus status.
