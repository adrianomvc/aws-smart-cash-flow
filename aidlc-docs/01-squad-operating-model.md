# Squad Operating Model

## Composicao Recomendada

PM / Product Manager:

- Define objetivos, prioridades, criterios de aceite e recortes de MVP.
- Mantem backlog e valida fluxos de negocio.

Tech Lead:

- Decide arquitetura, padroes tecnicos, qualidade e divisao de trabalho.
- Garante aderencia ao SDD e revisa decisoes de maior impacto.

Especialista Frontend:

- Implementa experiencia de upload, status de importacao, revisao de lancamentos e telas administrativas.
- Garante usabilidade para operacao recorrente.

Especialista Backend:

- Implementa APIs, regras de ingestao, validacao, idempotencia e persistencia.
- Mantem contratos entre frontend, parsers e banco.

Especialista Dados / DBA:

- Modela banco, indices, constraints, lineage e estrategia de migracoes.
- Apoia performance de consultas e qualidade de dados.

QA / Test Engineer:

- Define estrategia de testes, massa anonima, regressao de parsers e testes de integracao.
- Automatiza validacoes de importacao e cenarios de erro.

DevOps / SRE:

- Define ambiente local, CI/CD, observabilidade, backups e deploy.
- Garante reproducibilidade e seguranca operacional.

Security / Privacy:

- Revisa LGPD, mascaramento, logs, controle de acesso e retencao.
- Define requisitos minimos antes de ambiente produtivo.

UX / Product Designer:

- Desenha fluxos de importacao, tratamento de erro e revisao.
- Garante que a interface reduza retrabalho operacional.

## Ritos

- Planning semanal com PM e Tech Lead.
- Refinamento SDD antes de cada slice.
- Review tecnica por pull request.
- Demo funcional a cada incremento.
- Retrospectiva quinzenal focada em fluxo, qualidade e clareza das specs.

## Definition of Ready

- Historia tem objetivo, entrada, saida e criterio de aceite.
- Contrato de dados afetado esta descrito.
- Riscos de privacidade foram avaliados.
- Massa de teste anonima esta disponivel.

## Definition of Done

- Codigo implementado e revisado.
- Testes unitarios e de integracao relevantes passando.
- Spec atualizada quando comportamento mudou.
- Migracoes versionadas quando houver banco.
- Logs nao expõem dados financeiros sensiveis.
- Importacao e falhas sao rastreaveis.
