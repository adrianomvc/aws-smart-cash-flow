# Tela 02 — Fluxo de Caixa

**Arquivo no repo:** `frontend/src/pages/CashflowPage.tsx`  
**Rota:** `cashflow`  
**API endpoints:** `GET /v1/dashboard/summary`, `GET /v1/dashboard/monthly-cashflow`, `GET /v1/dashboard/category-ranking`

---

## Layout

```
┌─────────────────────────────────────────────────┐
│ HEADER: Fluxo de Caixa  [seletor de período]    │
├──────────┬──────────┬──────────┬────────────────┤
│ Receitas │ Despesas │  Saldo   │  Saving rate   │  ← KPIs
├──────────┴──────────┴──────────┴────────────────┤
│  Gráfico área: receitas vs despesas (12 meses)   │
├─────────────────────────┬───────────────────────┤
│  Categorias de maior    │  Sankey (Receitas →   │
│  impacto (expansível)   │  Categorias)          │
└─────────────────────────┴───────────────────────┘
```

---

## Componente: Categorias de Maior Impacto

Igual ao Top Categorias do Dashboard — com expansão de subcategorias.
**Já implementado no CashflowPage.tsx — usar como referência para o Dashboard.**

---

## Seletor de Período

Segmented control: `M0` | `M-1` | `3M` | `1A` | `📅` (custom)

Ao selecionar, refaz todas as queries com `date_from` e `date_to`.

---

## Gráfico de Área

- Eixo X: meses (Jan–Jun)
- Linhas: Receitas (verde) + Despesas (vermelho)
- Área preenchida com gradiente de 30% de opacidade
- Tooltip ao hover mostrando valores
- Biblioteca: **Recharts** (`AreaChart`)

```tsx
<AreaChart data={monthly}>
  <Area type="monotone" dataKey="income"
    stroke="#00b86b" fill="rgba(0,184,107,.15)" />
  <Area type="monotone" dataKey="expenses"
    stroke="#ff4d6d" fill="rgba(255,77,109,.12)" />
</AreaChart>
```

---

## Diagrama Sankey (opcional — fase 2)

Visualiza o fluxo: Receitas → Categorias → Subcategorias.
Usar biblioteca `recharts-sankey` ou implementação customizada.
