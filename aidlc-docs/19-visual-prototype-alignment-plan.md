# Plano de Execucao: Alinhamento Visual com Prototipo

## Estado AI-DLC

- **Fase**: CONSTRUCTION
- **Etapa atual**: Workflow Planning / Functional Design
- **Pacote anterior**: Relatorios
- **Pacote atual**: Alinhamento Visual com Prototipo
- **Extensoes ativas**: Security Baseline e Property-Based Testing como bloqueantes
- **Tipo de validacao**: visual, UX, narrativa e indicadores

## Objetivo

Alinhar as telas ja funcionais do SmartCashFlow ao prototipo enviado em
`aidlc-docs/prototipo de telas/`, sem trocar dados reais por mock e sem criar
novas funcionalidades fora do escopo visual aprovado.

Este pacote existe porque as validacoes anteriores confirmaram funcionamento
tecnico, navegacao e contratos, mas nao confirmaram fidelidade visual contra o
prototipo.

## Referencias

- `aidlc-docs/prototipo de telas/smartcashflow_full_product_spec_v3.md`
- `aidlc-docs/prototipo de telas/1a - Dashboard.png`
- `aidlc-docs/prototipo de telas/1b - Dashboard.png`
- `aidlc-docs/prototipo de telas/7 - Planejamento Projeção.png`
- `aidlc-docs/prototipo de telas/10 - Relatorios.png`
- `aidlc-docs/18-reports-validation-checklist.md`

## Escopo Inicial

1. Dashboard
2. Planejamento / Projecao
3. Relatorios
4. AppShell, sidebar, header e hierarquia geral quando afetarem as telas acima

## Fora de Escopo Nesta Fatia

- Criar Copilot IA real.
- Criar novas APIs que nao sejam necessarias para visualizacao ja planejada.
- Migrar para microservicos.
- Implementar telas completas ainda marcadas como evolucao futura.
- Refazer autenticacao, billing, assinatura ou deploy.

## Estrategia de Execucao

1. Comparar prototipo e estado atual por tela.
2. Separar diferencas em visual, indicador, informacao ausente e funcionalidade
   futura.
3. Implementar primeiro ajustes visuais seguros usando dados ja existentes.
4. Validar com lint, build e checklist visual local.
5. Somente depois pedir validacao humana no localhost.

## Ordem Recomendada

| Ordem | Fatia | Motivo |
| --- | --- | --- |
| 1 | Dashboard | Tela principal e referencia narrativa do produto. |
| 2 | Planejamento / Projecao | Ja possui dados reais e precisa aproximar a leitura ao prototipo. |
| 3 | Relatorios | Acabou de ser implementada e ainda esta em validacao funcional. |
| 4 | Navegacao transversal | Ajustar apenas quando necessario para consistencia. |

## Decisoes Assumidas

- A validacao funcional de Relatorios nao substitui a validacao visual.
- O pacote visual deve preservar dados reais e contratos existentes.
- O prototipo e referencia de direcao visual e produto, nao uma ordem para
  copiar pixel a pixel sem considerar o MVP atual.
- Indicadores inexistentes devem ser marcados como backlog ou planejados antes
  de implementacao.
- Ajustes de frontend devem ser feitos em fatias pequenas, com build local a
  cada corte relevante.

## Riscos

| Risco | Impacto | Mitigacao |
| --- | --- | --- |
| Copiar o prototipo literalmente e quebrar dados reais | Alto | Manter contratos existentes e revisar cada indicador. |
| Misturar validacao funcional com visual | Medio | Usar checklist visual separado. |
| Criar funcionalidades novas sem contrato | Alto | Registrar como backlog antes de implementar. |
| Aumentar complexidade de frontend sem necessidade | Medio | Preferir componentes existentes e ajustes incrementais. |
| Divergencia entre PNG e spec v3 | Medio | Registrar decisao no comparativo antes de codar. |

## Criterio de Saida do Pacote

- Dashboard, Planejamento e Relatorios comparados contra o prototipo.
- Diferencas classificadas em ajustar agora, backlog ou fora de escopo.
- Ajustes visuais implementados sem regressao de lint/build.
- Checklist visual preenchido.
- Usuario valida localmente que as telas estao coerentes com o desenho enviado.

