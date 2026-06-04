# Checklist de Validacao Local

## Contexto
- **Fase AI-DLC**: CONSTRUCTION
- **Etapa**: Build and Test / Validacao do Usuario
- **Pacote**: Fase 1 - Planejamento Multirepo e Produto Base
- **Escopo validado automaticamente**: Planning API para Calendario, Orcamentos e Metas
- **URL local do frontend**: `http://127.0.0.1:5173`
- **URL local da API**: `http://127.0.0.1:8000`

## Resultado Tecnico Antes da Validacao Manual
- API `/health` respondeu `ok`.
- Endpoints protegidos de calendario, orcamentos e metas responderam com o token local correto.
- Testes focados de Planning passaram.
- Lint focado de Planning passou.
- Security Baseline e Property-Based Testing estao ativos como regras bloqueantes.

## Roteiro de Validacao do Usuario

### 1. Acesso Local
- Abrir `http://127.0.0.1:5173`.
- Entrar usando o modo local/demo disponivel na tela.
- Confirmar que a aplicacao carrega sem erro visual ou tela em branco.

### 2. Calendario Financeiro
- Abrir a tela de Calendario.
- Criar um evento financeiro com titulo, tipo, valor e data.
- Confirmar que o evento aparece na lista/calendario apos salvar.
- Recarregar a pagina e confirmar que o evento continua aparecendo.

### 3. Orcamentos
- Abrir a tela de Orcamentos.
- Criar um orcamento mensal com nome, periodo, limite e percentual de alerta.
- Confirmar que o orcamento aparece na tela apos salvar.
- Recarregar a pagina e confirmar persistencia.

### 4. Metas
- Abrir a tela de Metas.
- Criar uma meta com nome, valor alvo, valor atual e data alvo.
- Confirmar que a meta aparece com progresso coerente.
- Recarregar a pagina e confirmar persistencia.

### 5. Regressao Visual Basica
- Abrir Dashboard, Transacoes, Fluxo de Caixa e Cartoes.
- Confirmar que nenhuma tela principal quebrou depois das novas paginas.
- Confirmar que a navegacao lateral continua coerente com o prototipo.

## Criterio de Aprovacao
O pacote pode sair de `Validacao usuario` para `Validado usuario` quando:

- Calendario cria e recarrega evento persistido.
- Orcamentos cria e recarrega orcamento persistido.
- Metas cria e recarrega meta persistida.
- Nenhuma tela principal apresenta erro bloqueante.

## Observacoes
- O token local correto usado pela aplicacao e `local-dev`.
- `local-dev-token` nao e valido.
- O modo local/demo deve permanecer restrito a ambiente local.
- Antes de dados reais ou producao, `ALLOW_LOCAL_AUTH` precisa ficar desabilitado.

