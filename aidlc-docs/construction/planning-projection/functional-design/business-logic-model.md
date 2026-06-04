# Business Logic Model: planning-projection

## Fluxo

1. Receber `date_from` e `horizons`.
2. Normalizar horizontes validos entre 1 e 365 dias.
3. Buscar eventos planejados do workspace.
4. Expandir recorrencias mensais no horizonte.
5. Somar entradas e saidas por horizonte.
6. Calcular saldo projetado.
7. Classificar risco deterministico.
8. Retornar eventos usados, metas no horizonte e premissas.

