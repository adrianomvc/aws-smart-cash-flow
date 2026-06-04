# Checklist de Validacao Local: Planejamento e Projecao

## Contexto
- **Fase AI-DLC**: CONSTRUCTION
- **Etapa**: Build and Test / Validacao do Usuario
- **Pacote**: Planejamento e Projecao
- **URL local do frontend**: `http://127.0.0.1:5173`
- **URL local da API**: `http://127.0.0.1:8000`

## Resultado Tecnico Antes da Validacao Manual
- Backend de projecao implementado em `GET /v1/planning/projection`.
- Tela `Planejamento` habilitada no menu lateral.
- Contrato OpenAPI e exemplo JSON atualizados.
- Testes de exemplo e PBT passaram.
- Lint backend, lint frontend e build frontend passaram.
- Smoke test local da API passou.
- Validacao por navegador interno ficou bloqueada por falha do plugin `node_repl`.

## Roteiro de Validacao do Usuario

### 1. Acesso
- Abrir `http://127.0.0.1:5173`.
- Entrar usando `Acessar demonstracao MVP`.
- Confirmar que o menu lateral mostra `Planejamento` sem selo `em breve`.

### 2. Tela Planejamento
- Abrir `Planejamento`.
- Confirmar que a tela carrega sem erro.
- Confirmar que aparecem cards para 30, 60 e 90 dias.
- Confirmar que cada card mostra entradas, saidas, saldo projetado e risco.

### 3. Eventos
- Abrir `Calendario`.
- Criar um evento futuro de despesa ou receita.
- Voltar para `Planejamento`.
- Confirmar que o evento aparece em `Eventos usados na projecao`.
- Confirmar que os valores dos horizontes mudam de forma coerente.

### 4. Metas
- Abrir `Metas`.
- Criar uma meta com prazo dentro dos proximos 90 dias.
- Voltar para `Planejamento`.
- Confirmar que a meta aparece em `Metas no horizonte`.

### 5. Regressao Basica
- Abrir Dashboard, Fluxo de Caixa, Calendario, Orcamentos e Metas.
- Confirmar que nenhuma tela principal ficou em branco ou com erro bloqueante.

## Criterio de Aprovacao
O pacote pode sair de `Validacao usuario` para `Validado usuario` quando:

- Planejamento abre pelo menu lateral.
- Horizontes de 30, 60 e 90 dias aparecem.
- Eventos futuros criados no Calendario afetam a projecao.
- Metas com prazo nos proximos 90 dias aparecem na tela.
- Nenhuma tela principal apresenta regressao bloqueante.

