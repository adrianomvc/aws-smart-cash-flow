# Business Rules: planning-projection

- Eventos `income` somam em entradas previstas.
- Eventos diferentes de `income` somam em saidas previstas.
- Saldo projetado e `entradas - saidas`.
- Saldo negativo gera risco `risk`.
- Folga menor ou igual a 10% das saidas gera `attention`.
- Saldo positivo acima da faixa de atencao gera `healthy`.
- Projecao sem eventos deve retornar totais zerados e premissas explicitas.
- O endpoint deve sempre filtrar por `workspace_id`.

