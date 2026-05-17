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
- Extratos podem ser baixados com janelas sobrepostas; uma importacao de dois meses pode conter um mes ja processado.

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

- Usar chave transacional por workspace, tipo de origem, data, descricao original, valor e direcao para cobrir arquivos com periodos sobrepostos.
- Manter contagem de linhas duplicadas visivel na resposta de importacao.
- Evoluir para incluir conta/cartao quando a inferencia dessa origem estiver disponivel, reduzindo risco de colisao entre fontes diferentes.

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

DEC-019: Recursos AWS gerenciados por Terraform devem usar tags padrao de custo.

Motivo:

- Permite acompanhar custos por projeto, aplicacao, ambiente e centro de custo
  no AWS Cost Explorer.
- Evita misturar custos deste MVP com outros experimentos ou aplicacoes AWS.
- Mantem rastreabilidade operacional sem incluir dados financeiros sensiveis em
  nomes de recursos, logs ou tags.

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

DEC-020: O backend inicial online usara Lambda sem VPC e API Gateway HTTP API, conectando ao Neon por URL pooled publica com TLS.

Motivo:

- Evita custo fixo de NAT Gateway, RDS ou VPC privada no MVP.
- Mantem o backend serverless e sob demanda.
- Neon pooled reduz risco de excesso de conexoes em ambiente Lambda.

R-012: Lambda pode exceder limites de conexao do Neon em bursts ou cold starts paralelos.

Mitigacao:

- Usar connection string pooled do Neon.
- Configurar pool SQLAlchemy pequeno no backend (`pool_size=1`, `max_overflow=2`, `pool_pre_ping`).
- Manter throttling inicial baixo no API Gateway.
- Reavaliar RDS Proxy, provider pooler ou arquitetura assíncrona se houver aumento de uso.

R-013: Backend publicado antes da validacao Supabase JWT aceita token bearer scaffold.

Mitigacao:

- Tratar o deploy Lambda inicial como ambiente `develop` operacional controlado.
- Implementar validacao real de JWT antes de promover uso de producao ou dados multiusuario.
- Manter CORS restrito ao dominio Amplify esperado.

R-014: Lambda criada pelo pacote inicial do Terraform pode ficar sem dependencias Python ate o primeiro deploy GitHub.

Mitigacao:

- Usar o deploy backend do GitHub Actions para montar o pacote em Linux com dependencias runtime.
- Manter disparo manual do workflow `CI` em `main` para atualizar a Lambda quando variaveis/secrets forem configuradas apos o Terraform apply.

## Perguntas Abertas

- Confirmar detalhes da conta/projeto Supabase e estrategia de ambientes.
- Login com Google entra no MVP ou fica preparado para fase seguinte?
- A categorizacao de despesas comeca por regra, IA ou hibrido?
- Os PDFs devem ser processados ja na segunda fase?
- A retencao de erros sera de 30, 90 ou 180 dias?
