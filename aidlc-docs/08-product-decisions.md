# Product Decisions

## Contexto Confirmado

Usuarios:

- Uso inicial por um casal na mesma conta.
- O produto deve nascer preparado para multiusuarios, para que outras pessoas usem a ferramenta no futuro sem enxergar dados de outros usuarios.

Entrada de arquivos:

- Upload manual pela aplicacao.

Volume esperado inicial:

- 3 faturas PDF por mes.
- 1 extrato TXT por semana.
- 1 CSV de fatura de cartao por semana.
- Carga inicial aproximada de 300 arquivos.
- Carga inicial aproximada de 10.000 linhas/transacoes.
- Apos a carga inicial, volume recorrente esperado baixo.

Objetivos apos importacao:

- Gravar dados no banco.
- Categorizar transacoes automaticamente e manualmente.
- Criar dashboards para tomada de decisao.
- Entender a situacao financeira.
- Conciliar cartao de credito e conta corrente.

Dados a preservar:

- Arquivo original.
- Dados originais linha a linha.
- Erros de importacao por um periodo definido.
- Historico de importacao e reprocessamento.

Restricao principal:

- Custo proximo a zero.
- Backend deve iniciar online para permitir uso compartilhado via mobile.

Autenticacao:

- Usuario e senha.
- Login com Google deve ser suportado ou planejado desde o inicio.

## Implicacoes de Produto

- A arquitetura deve ter isolamento por usuario/conta desde o inicio.
- Mesmo que o MVP use uma conta compartilhada pelo casal, o banco deve ter `workspace`, `household` ou `tenant`.
- Upload manual e status de importacao fazem parte do MVP.
- Dashboards e categorizacao sao parte do produto, mas podem ser entregues em fatias apos a ingestao confiavel.
- PDF e importante para o produto real, mas deve ser tratado com uma fase tecnica propria por causa de custo, variacao de layout e complexidade de extracao.

## MVP Recomendado

MVP 1: Ingestao confiavel e base multiusuario

- Login simples ou identificacao de usuario.
- Workspace/conta compartilhada.
- Upload manual de TXT e CSV.
- Registro do arquivo original.
- Persistencia de linhas brutas, transacoes normalizadas e erros.
- Dedupe e reprocessamento.
- Lista de importacoes.
- Lista de transacoes.
- Categorias manuais.
- Regras deterministicas simples de categorizacao.

MVP 2: Categorizacao

- Cadastro de categorias.
- Regras manuais por palavra-chave, descricao, origem e valor.
- Categorizacao automatica deterministica baseada em regras.
- Correcao manual de categoria.
- Aprendizado simples a partir das correcoes.
- Estrategia evolutiva: Regra -> Embedding -> LLM -> Revisao.
- LLM deve ser usado apenas para casos ambiguos para controlar custo.
- Embeddings iniciais: `sentence-transformers/all-MiniLM-L6-v2` local.
- LLM inicial: Groq API com `llama3-8b-8192`.

MVP 3: Dashboards

- Gastos por mes.
- Gastos por categoria.
- Evolucao de saldo.
- Maiores despesas.
- Comparativo conta corrente x cartao.

MVP 4: Conciliacao

- Relacionar pagamentos de fatura no extrato com faturas de cartao.
- Detectar divergencias entre valor pago e total da fatura.
- Marcar transacoes conciliadas.

Fase posterior: PDF

- Extracao de PDFs por emissor/layout.
- Validacao contra CSV/fatura quando existir.
- Tratamento de falhas e revisao manual.

## Decisoes Ainda Abertas

- Modelo de autenticacao: login por email/senha, magic link ou provedor externo.
- Nome do conceito de isolamento: `workspace`, `household`, `tenant` ou `account`.
- Banco/Auth inicial: Supabase Free.
- Portabilidade: arquitetura deve permitir migracao futura para outro PostgreSQL/Auth provider com baixa friccao.
- Deploy inicial: AWS Amplify Hosting para frontend, AWS Lambda Python para backend, Supabase Free para banco/auth/storage.
- API: API Gateway HTTP API.
- Frontend: React + TypeScript + Vite, mobile-first, com shadcn/ui, Tailwind CSS e Recharts para dashboards.
- Custo: evitar RDS, NAT Gateway, WAF e logs excessivos no MVP.
- Retencao de erros: 30, 90 ou 180 dias.
- Estrategia inicial de categorizacao automatica: regras deterministicas, IA ou hibrido.
