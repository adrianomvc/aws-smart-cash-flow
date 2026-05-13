# Project Charter: aws-smart-cash-flow

## Objetivo

Construir uma aplicacao para receber arquivos financeiros recorrentes, extrair lancamentos, normalizar os dados e persistir em banco de dados com rastreabilidade do arquivo de origem.

## Problema

Hoje os dados chegam em formatos diferentes de bancos/cartoes:

- Extrato TXT de conta corrente com separador `;`.
- CSVs de faturas com colunas `data`, `lançamento`, `valor`.
- PDFs de faturas que exigem extracao antes da normalizacao.

O projeto precisa transformar esses arquivos em uma base unica, auditavel e pronta para consulta, classificacao e analise financeira.

## Resultado Esperado

- Upload ou leitura de arquivos financeiros.
- Identificacao do tipo de arquivo e instituicao/origem.
- Parsing e validacao dos lancamentos.
- Persistencia em banco de dados.
- Categorizacao automatica e manual.
- Dashboards para tomada de decisao financeira.
- Conciliacao entre cartao de credito e conta corrente.
- Interface para acompanhar importacoes, erros e lancamentos carregados.
- Base preparada para categorizacao, conciliacao e dashboards futuros.

## Escopo Inicial

Incluido no MVP:

- Ingestao de `.txt` e `.csv` existentes na pasta `input`.
- Upload manual pela aplicacao.
- Validacao de schema, datas e valores.
- Normalizacao para um modelo canonico de transacoes.
- Persistencia em banco relacional.
- Base de isolamento por usuario/conta compartilhada para evoluir para multiusuarios.
- Tela operacional para importar arquivos e revisar status.
- Testes automatizados dos parsers e camada de persistencia.

Fora do MVP:

- Upload e extracao de PDF.
- OCR.
- Categorizacao automatica avancada com IA.
- Integracao bancaria via API.
- Aplicativo mobile.

## Principios

- Especificacao antes da implementacao.
- Dados financeiros devem ser tratados como sensiveis.
- Todo lancamento deve manter vinculo com arquivo, linha/pagina e importacao de origem.
- O sistema deve ser idempotente: reprocessar o mesmo arquivo nao deve duplicar transacoes.
- Erros de parsing devem ser visiveis e corrigiveis.
