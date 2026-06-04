# Checklist de Validacao Local: Relatorios

## Contexto

- **Fase AI-DLC**: CONSTRUCTION
- **Etapa**: Build and Test / Validacao do Usuario
- **Pacote**: Relatorios
- **URL local do frontend**: `http://127.0.0.1:5173`
- **URL local da API**: `http://127.0.0.1:8000`

## Resultado Tecnico Antes da Validacao Manual

- Endpoint `GET /v1/reports` implementado.
- Tela `Relatorios` habilitada no menu lateral.
- Contrato OpenAPI e exemplo JSON atualizados.
- Testes unitarios e PBT do pacote passaram.
- Lint backend, JSON de contratos, lint frontend e build frontend passaram.
- Exportacao PDF, CSV e XLSX ficou marcada como `Em breve`.

## Roteiro de Validacao do Usuario

### 1. Acesso

- Abrir `http://127.0.0.1:5173`.
- Entrar usando `Acessar demonstracao MVP`.
- Confirmar que o menu lateral mostra `Relatorios` sem selo `em breve`.

### 2. Tela Relatorios

- Abrir `Relatorios`.
- Confirmar que a tela carrega sem erro.
- Confirmar que os cards de relatorios aparecem.
- Confirmar que cada card mostra titulo, descricao, status, metrica principal e
  metrica auxiliar.

### 3. Filtro de Periodo

- Alterar o periodo no filtro.
- Confirmar que a tela recarrega os relatorios do novo periodo.
- Confirmar que o card de periodo no topo reflete o filtro.

### 4. Atalhos

- Clicar em cards de relatorio.
- Confirmar que o app navega para a tela relacionada, como Dashboard, Fluxo de
  Caixa, Transacoes, Cartoes, Orcamentos, Metas, Revisao ou Planejamento.

### 5. Exportacao

- Confirmar que PDF, CSV e XLSX aparecem como `Em breve`.
- Confirmar que a interface nao promete arquivo exportado neste recorte.

## Criterio de Aprovacao

O pacote pode sair de `Validacao usuario` para `Validado usuario` quando:

- Relatorios abre pelo menu lateral.
- Cards de relatorios aparecem com dados ou estados vazios claros.
- Filtro de periodo funciona sem erro.
- Atalhos navegam para telas existentes.
- Exportacao fica claramente marcada como futura.

