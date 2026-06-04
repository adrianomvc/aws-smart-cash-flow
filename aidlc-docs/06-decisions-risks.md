# Decisions and Risks

## Decisoes Iniciais

DEC-001: O MVP processa TXT e CSV; PDF fica registrado mas nao extraido.

Motivo:

- Os arquivos TXT/CSV ja possuem estrutura suficiente para entregar valor rapidamente.
- PDF pode exigir bibliotecas, regras por banco/cartao e validacao visual.

DEC-002: O modelo canonico de transacao preserva `raw_description`.

Motivo:

- Permite auditoria e melhoria futura de categorizacao.

DEC-003: O sistema deve priorizar idempotencia desde o inicio.

Motivo:

- Importacoes financeiras frequentemente sao repetidas durante ajustes.

DEC-004: O backend sera desenvolvido em Python.

Motivo:

- Python tem bom suporte para parsing de arquivos, processamento de dados, validacao, APIs e automacao de testes.
- Mantem o caminho aberto para extracao futura de PDFs, categorizacao e rotinas analiticas.

DEC-005: A entrada principal de arquivos sera upload manual pela aplicacao.

Motivo:

- O volume inicial e baixo e o uso sera operado diretamente pelos usuarios.

DEC-006: O produto deve nascer com isolamento multiusuario por workspace.

Motivo:

- Uso inicial sera compartilhado por um casal, mas a ferramenta deve poder atender outras pessoas no futuro sem redesenho do banco.

DEC-007: A restricao de custo operacional e proximo a zero.

Motivo:

- O volume recorrente e baixo, mesmo considerando uma carga historica inicial estimada em 300 arquivos e 10.000 linhas/transacoes.

DEC-008: A autenticacao sera por usuario e senha, com Google como provedor suportado ou planejado.

Motivo:

- O produto precisa permitir uso compartilhado e evoluir para multiusuarios.
- Login com Google reduz friccao para usuarios futuros.

DEC-009: O banco inicial deve priorizar opcao gratuita.

Motivo:

- O volume inicial e pequeno e nao justifica custo fixo de banco gerenciado pago.

DEC-010: Supabase Free sera usado como banco/autenticacao inicial, mantendo portabilidade para outro provedor.

Motivo:

- Supabase entrega PostgreSQL, Auth por usuario/senha e Google com baixo custo inicial.
- PostgreSQL reduz risco de lock-in em comparacao com um banco proprietario.
- O uso de SQLAlchemy/Alembic no backend facilita migracao futura.

DEC-011: O backend deve estar online desde o MVP.

Motivo:

- O produto precisa ser acessivel por mobile e compartilhado entre usuarios.
- Rodar apenas localmente nao atende ao uso desejado.

DEC-012: O deploy inicial sera AWS Amplify Hosting + AWS Lambda Python + Supabase Free.

Motivo:

- Amplify simplifica deploy do frontend responsivo.
- Lambda permite backend online sob demanda com custo baixo.
- Supabase Free cobre banco PostgreSQL, Auth e Storage inicialmente.
- A arquitetura segue portavel para migracao futura.

DEC-013: A API sera exposta por API Gateway HTTP API.

Motivo:

- HTTP API tem custo baixo e e suficiente para o MVP.
- Organiza rotas, CORS, estagios e evolucao da API melhor que Lambda Function URL.
- REST API nao sera usada no MVP por custo e complexidade maiores.

DEC-014: O frontend sera React + TypeScript + Vite.

Motivo:

- Gera aplicacao estatica adequada para AWS Amplify Hosting.
- Suporta bem dashboards autenticados sem necessidade de SSR.
- Mantem baixa complexidade inicial.
- Permite usar Recharts, TanStack Query e UI mobile-first.

DEC-015: A interface usara shadcn/ui com Tailwind CSS.

Motivo:

- Fornece componentes adequados para dashboards, formularios, tabelas e filtros.
- Mantem customizacao alta e baixo acoplamento.
- Evita adotar uma biblioteca visual mais pesada no MVP.

## Riscos

R-001: PDFs podem ter layouts distintos e quebrar extracao automatica.

Mitigacao:

- Tratar PDF como fase separada com spikes tecnicos por emissor.

R-002: Dados financeiros sensiveis podem vazar em logs ou testes.

Mitigacao:

- Mascaramento, fixtures anonimas e revisao de seguranca.

R-003: Layouts de CSV podem variar por conversor ou banco.

Mitigacao:

- Criar `ParserRegistry` e testes por fixture.

R-004: Dedupe pode descartar transacoes legitimamente repetidas.

Mitigacao:

- Incluir `source_file_id` e `source_line` na chave inicial.
- Para arquivos quase iguais, usar assinatura natural como possivel duplicidade,
  com resumo/auditoria, antes de descartar automaticamente transacoes repetidas.
- Teste observado em 2026-05-18: reimportar arquivo identico gera
  `duplicate_file`, mas alterar uma linha faz o arquivo inteiro ser aceito como
  novo. Esse comportamento deve ser tratado para nao inflar indicadores.

R-005: Multiusuario implementado tarde pode exigir refatoracao profunda.

Mitigacao:

- Incluir `workspace_id` desde o schema inicial.

R-006: Categorizacao automatica por IA pode gerar custo e classificacoes erradas.

Mitigacao:

- Usar pipeline Regra -> Embedding -> LLM -> Revisao.
- Chamar LLM apenas quando regra e embedding nao tiverem confianca suficiente.
- Manter revisao manual e override manual.

DEC-016: A estrategia de categorizacao sera Regra -> Embedding -> LLM -> Revisao, implementada em fases.

Motivo:

- Regras reduzem custo e aumentam previsibilidade.
- Embeddings reaproveitam historico classificado.
- LLM melhora casos ambiguos sem precisar rodar para todas as transacoes.
- Revisao manual protege a qualidade dos dados.

DEC-017: Providers iniciais de IA serao sentence-transformers/all-MiniLM-L6-v2 para embeddings e Groq/llama3-8b-8192 para LLM.

Motivo:

- Ja existe experiencia previa em MVP com essa combinacao.
- Embeddings locais reduzem custo recorrente de classificacao por similaridade.
- Groq oferece baixa latencia e custo controlavel para chamadas seletivas ao LLM.
- Adaptadores preservam a possibilidade de troca futura.

DEC-017A: Normalizacao de descricoes deve evoluir para uma estrategia hibrida, mas a base do MVP permanece deterministica e auditavel.

Motivo:

- Regras deterministicas tornam importacao, dedupe, busca e regras de categoria
  previsiveis e testaveis no MVP.
- Embeddings e LLM poderao sugerir aliases, nomes canonicos de estabelecimento,
  categorias provaveis e excecoes de normalizacao em fase posterior.
- Sugestoes por IA nao devem substituir `raw_description` nem alterar dados ja
  persistidos sem revisao, confianca registrada e trilha de auditoria.
- O caminho futuro deve permitir comparar estrategia deterministica, embedding e
  LLM sem expor dados financeiros sensiveis em logs ou prompts desnecessarios.

DEC-017B: Normalizacao deterministica nao deve enriquecer descricoes genericas sem evidencia suficiente.

Motivo:

- Descricoes como `99` sozinhas nao indicam com seguranca se sao transporte,
  delivery, marketplace ou outro canal.
- O MVP pode unir sequencias seguras como `99 FOOD` para `99FOOD` e `99 APP`
  para `99APP`, mas nao deve transformar uma descricao generica por suposicao.
- Abreviacoes tambem devem exigir contexto seguro: `MP*LOJA` pode ser expandido
  para `MERCADO PAGO LOJA`, mas `MP` isolado deve ser preservado.
- Casos genericos devem ser tratados por regra manual, alias aprovado pelo
  usuario, embedding ou LLM em fase futura, preservando `raw_description`.

Impacto:

- Reduz falso agrupamento em deduplicacao e falso positivo de categorizacao.
- Mantem a importacao previsivel e auditavel.

Validacao:

- Testes de parser devem cobrir canais seguros e manter `99` sem enriquecimento.

DEC-018: A infraestrutura AWS sera criada e evoluida com Terraform.

Motivo:

- Mantem Amplify, Lambda, API Gateway, IAM, logs, budgets e permissoes em uma
  fonte de verdade revisavel.
- Permite diferenciar ambientes `develop` e `main` sem configuracao manual
  dispersa.
- Reduz risco operacional ao aplicar guardrails de custo desde o inicio.
- A conexao inicial do Amplify com GitHub pode ser feita fora do Terraform se
  isso evitar armazenar tokens sensiveis no state; os recursos AWS e permissoes
  associados devem permanecer sob controle do Terraform.

DEC-019: O prototipo de telas sera usado como referencia de UX/UI e roadmap, nao como substituto direto do MVP atual.

Motivo:

- O prototipo em `aidlc-docs/prototipo de telas` cobre um produto mais amplo,
  incluindo telas de calendario, orcamentos, metas, planejamento, investimentos,
  patrimonio, relatorios, insights IA, familia, assinaturas e configuracoes.
- O MVP atual ja possui backend real, importacao, normalizacao, deduplicacao,
  categorizacao e dashboard com dados do workspace; recomeçar por mock API
  aumentaria retrabalho e risco.
- A melhor rota e absorver o design system, navegacao e hierarquia visual do
  prototipo em pacotes agrupados de frontend, mantendo a base funcional existente.
- Funcionalidades que dependem de novos dominios, como orcamentos, metas,
  patrimonio, familia e billing, devem permanecer como backlog de evolucao ate
  terem contrato de dados, seguranca e testes.

Impacto:

- Proximas entregas de front devem aproximar a experiencia do prototipo sem
  quebrar os fluxos ja validados de importacao, transacoes e dashboard.
- O backlog passa a diferenciar "alinhamento visual com prototipo" de "novas
  funcionalidades do produto completo".

Atualizacao:

- Em 2026-05-25, `smartcashflow_full_product_spec_v3.md` passou a ser a
  referencia mais recente do prototipo, especialmente para Configuracoes,
  Preferencias Financeiras e subareas de conta/produto.

DEC-019: Recursos AWS gerenciados por Terraform devem usar tags padrao de custo.

Motivo:

- Permite acompanhar custos por projeto, aplicacao, ambiente e centro de custo
  no AWS Cost Explorer.
- Evita misturar custos deste MVP com outros experimentos ou aplicacoes AWS.
- Mantem rastreabilidade operacional sem incluir dados financeiros sensiveis em
  nomes de recursos, logs ou tags.

DEC-020: Mudancas de frontend devem ser agrupadas por fluxo antes da subida.

Motivo:

- Reduz retrabalho de deploy e validacao visual em telas interdependentes.
- Evita publicar experiencia parcial quando upload, importacoes, transacoes,
  categorias e regras dependem umas das outras para fazer sentido ao usuario.
- Mantem uma subida unica e coesa para o pacote operacional do MVP frontend.

DEC-021: Changelogs devem ser baseados em Git tags anotadas.

Motivo:

- Mantem historico de releases alinhado ao estado real do repositorio.
- Permite gerar notas de versao por intervalo entre tags.
- Evita manter changelog manual desconectado de commits e deploys.
- Tags e release notes nao devem conter dados financeiros sensiveis, nomes reais
  de arquivos financeiros ou valores de producao.

DEC-022: A migracao para AWS serverless completa sera avaliada como evolucao faseada, nao como troca imediata do MVP atual.

Motivo:

- Amplify Hosting, Lambda, API Gateway, S3 e Cognito fazem sentido para reduzir
  custo fixo e manter a operacao dentro da AWS.
- Cognito e S3 podem ser migrados em fases com menor impacto no modelo de dados.
- DynamoDB pode reduzir custo operacional, mas exige modelagem por padroes de
  acesso e pode dificultar consultas analiticas financeiras se adotado antes da
  POC.
- O MVP ainda precisa priorizar validacao funcional de importacao, regras,
  transacoes e indicadores antes de uma troca ampla de persistencia.

DEC-023: Ambientes com dados reais devem bloquear auth de demo, CORS aberto e logs com dados financeiros.

Motivo:

- Dados financeiros exigem minimizacao de exposicao e rastreabilidade.
- Demo/local auth e origens locais sao uteis para validacao MVP, mas nao podem
  permanecer ativos em producao real.
- Logs de infraestrutura devem apoiar operacao sem armazenar payload financeiro,
  nomes reais de arquivos, descricoes ou valores.
- Guardrails de conta AWS, IAM, API Gateway, Lambda, CloudWatch e S3 devem ser
  tratados como requisito de prontidao para producao.

DEC-024: A evolucao do dashboard deve ser orientada por saude financeira e narrativa executiva.

Motivo:

- O usuario precisa responder rapidamente se esta saudavel, se pode gastar, se a
  fatura cabe no caixa e quais categorias exigem acao.
- Indicadores como burn rate, runway, saving rate, comprometimento, saldo
  projetado e parcelado futuro entregam mais valor do que apenas listar gastos.
- O dashboard deve contar a historia do periodo antes de abrir detalhes
  operacionais, mantendo drill-down e rastreabilidade para transacoes.
- Referencias visuais fornecidas em 2026-05-23 devem orientar a evolucao de UX,
  mas a implementacao deve preservar simplicidade, responsividade e leitura de
  produto financeiro de uso recorrente.

DEC-025: Projecao de parcelas de cartao deve considerar fechamento da fatura.

Motivo:

- A data da compra nao define sozinha a competencia da parcela no cartao.
- Compras feitas apos o fechamento entram na fatura do mes seguinte.

Decisao:

- O calculo de parcela por mes alvo deve partir da primeira fatura da compra,
  usando `closing_day`.
- Enquanto o cadastro de cartoes nao existir, o MVP usa dia de fechamento
  configuravel por ambiente como fallback.

Risco:

- Cartoes com fechamento diferente do fallback podem apresentar uma parcela
  deslocada ate que exista cadastro de cartoes por usuario.

R-007: Banco gratuito pode impor limites de armazenamento, conexoes ou pausa por inatividade.

Mitigacao:

- Escolher uma opcao com limites compativeis com 300 transacoes/mes e manter plano de migracao para PostgreSQL gerenciado pago quando necessario.

R-008: Uso direto de recursos especificos do Supabase pode dificultar migracao futura.

Mitigacao:

- Encapsular Auth, Storage e acesso a dados no backend.
- Evitar acoplar regras de negocio a features proprietarias.
- Manter migrations Alembic como fonte de verdade do schema.

R-009: Backend online pode introduzir custo fixo ou limites de free tier.

Mitigacao:

- Preferir arquitetura sob demanda/serverless ou free tier sem custo fixo.
- Monitorar limites de requisicoes, storage e logs.
- Manter deploy reproduzivel para migrar de provider.

R-010: Carga historica inicial pode exceder timeout de funcoes gratuitas se processada em uma unica requisicao.

Mitigacao:

- Processar arquivos individualmente ou em pequenos lotes.
- Persistir status por importacao.
- Permitir retomar processamento apos falha.
- Evitar upload/processamento sincronico de muitos arquivos em uma unica chamada.

R-011: Embeddings locais em Lambda podem aumentar tamanho do pacote e cold start.

Mitigacao:

- Medir tamanho e tempo de inicializacao antes de colocar embedding no caminho critico.
- Considerar Lambda Layer, job separado ou provider remoto se o pacote ficar pesado.
- Manter embedding como fase posterior ao MVP de ingestao.
- Nao executar embedding local na Lambda sincrona de upload/importacao.
- Se necessario, usar Lambda separada com container image e processamento em lote.

R-012: Migrar o banco principal para DynamoDB sem POC pode reduzir flexibilidade de dashboards, filtros e auditoria.

Mitigacao:

- Mapear padroes de acesso antes de desenhar tabelas e indices.
- Provar listagem paginada, ordenacao, dashboard mensal, ranking por categoria,
  qualidade de dados, regras e auditoria sem scans como caminho principal.
- Comparar custo e complexidade com PostgreSQL atual e com arquitetura hibrida.
- Manter SQLAlchemy/Alembic e contratos atuais como referencia ate a decisao
  tecnica ser validada.

R-013: Manter demo/local auth, CORS amplo ou logs detalhados em ambiente online pode expor dados financeiros.

Mitigacao:

- Desabilitar `ALLOW_LOCAL_AUTH` antes de usar dados reais.
- Restringir CORS de producao a dominios oficiais.
- Bloquear promocao de producao quando configuracoes inseguras estiverem ativas.
- Registrar somente metadados operacionais nos logs, com retencao curta.

R-014: Configuracao permissiva de IAM, S3 ou API Gateway pode permitir acesso indevido ou abuso de custo.

Mitigacao:

- Usar GitHub OIDC e roles de menor privilegio.
- Manter S3 privado com Block Public Access, criptografia e lifecycle.
- Configurar throttling, budgets, CloudTrail e alertas.
- Avaliar WAF antes de abrir uso para usuarios externos ou dados reais.

## Perguntas Abertas

- Confirmar detalhes da conta/projeto Supabase e estrategia de ambientes.
- Login com Google entra no MVP ou fica preparado para fase seguinte?
- A categorizacao de despesas comeca por regra, IA ou hibrido?
- Os PDFs devem ser processados ja na segunda fase?
- A retencao de erros sera de 30, 90 ou 180 dias?
