# Tela 01 — Dashboard (Visão Geral)

**Arquivo no repo:** `frontend/src/pages/DashboardPage.tsx`  
**Rota:** `dashboard`  
**API endpoints:** `GET /v1/dashboard/summary`, `GET /v1/dashboard/monthly-cashflow`, `GET /v1/dashboard/category-ranking`, `GET /v1/dashboard/data-quality`

---

## Layout

Grid de 3 colunas no desktop, 1 coluna no mobile. Padding `26px 32px`.

```
┌─────────────────────────────────────────────────┐
│  HEADER: Cockpit Executivo  [período M0/M-1/3M] │
├──────────────┬──────────────┬───────────────────┤
│  KPI Cards   │  KPI Cards   │   KPI Cards       │  ← 6 cards
├──────────────┴──────────────┴───────────────────┤
│  Resumo executivo (entrou / saiu / sobrou)       │
├─────────────────────────┬───────────────────────┤
│  Fluxo diário (gráfico) │  Top Categorias       │
│                         │  (expansível)         │
├─────────────────────────┴───────────────────────┤
│  Fluxo mensal 12 meses (gráfico barras)         │
├─────────────────────────┬───────────────────────┤
│  Saúde financeira        │  Qualidade dos dados  │
└─────────────────────────┴───────────────────────┘
```

---

## Componente: KPI Cards (6 cartões)

Cada card exibe:
- Label (ex: "Receitas do mês")
- Valor principal em destaque (fonte display, 28px+)
- Badge de proveniência: `real` | `est` | `integ`
- Delta percentual vs mês anterior (verde se positivo para receita/saldo, vermelho se positivo para despesas)
- Hint tooltip (ícone `i`) para valores estimados

KPIs a exibir:
1. Saldo atual (`integ`) — azul
2. Receitas do mês (`real`) — verde
3. Despesas do mês (`real`) — vermelho
4. Fluxo líquido (`real`) — verde/vermelho conforme sinal
5. Saving rate (`real`) — percentual
6. Gasto seguro hoje (`est`) — âmbar

---

## Componente: Top Categorias (EXPANSÍVEL) ⭐

> **Este é o componente principal a implementar/melhorar.**

### Comportamento
- Lista as top 6 categorias de despesa do período
- Cada linha é um botão clicável
- Ao clicar: expande inline mostrando subcategorias
- Ao clicar novamente: colapsa
- Somente uma categoria pode estar expandida por vez (ou múltiplas — decisão do dev)

### Estrutura de cada linha (fechada)
```
[›] [● Moradia]  ............  R$ 3.840  28,4%  [+12%]
[████████████████████░░░░░░░░░░░░░░░░]  ← barra de progresso
```

### Estrutura expandida (subcategorias)
```
[›] [● Moradia]  ............  R$ 3.840  28,4%
[████████████████████░░░░░░░░░░░░░░░░]
  ● Aluguel/Financiamento    12 lanç.  R$ 2.200  57%
  ─────────────────────────────────────────────
  ● Condomínio               4 lanç.   R$   580  15%
  ─────────────────────────────────────────────
  ● Energia                  2 lanç.   R$   340   9%
  ─────────────────────────────────────────────
  [Ver no fluxo de caixa →]
```

### Dados necessários da API
```typescript
// GET /v1/dashboard/category-ranking?date_from=...&date_to=...
// Resposta esperada:
{
  categories: Array<{
    category_id: string
    label: string
    color: string          // hex da categoria
    total: number
    share: number          // % do total de despesas
    delta_pct: number | null  // variação vs período anterior
    subcategories: Array<{
      label: string
      total: number
      share_of_parent: number
      transaction_count: number
    }>
  }>
}
```

Se a API ainda não retorna subcategorias, buscar via:
```
GET /v1/transactions?date_from=...&date_to=...&category_id=...&direction=debit
```
e agrupar no frontend por `subcategory` ou campo equivalente.

### Código de referência (React + TypeScript)
```tsx
function TopCategoriesCard({ categories, onNavigateCashflow }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Top categorias" />
      <div className="flex flex-col gap-2 p-4">
        {categories.map((cat) => {
          const isOpen = openId === cat.category_id;
          return (
            <div key={cat.category_id}
              className="border border-line rounded-md overflow-hidden">
              {/* Linha principal — clicável */}
              <button
                onClick={() => setOpenId(isOpen ? null : cat.category_id)}
                className="w-full text-left p-2.5 hover:bg-card-2 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <ChevronRight size={12}
                    className={`text-ink-faint transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <span className="font-semibold text-sm">{cat.label}</span>
                  <span className="ml-auto font-bold tabular-nums">
                    {formatBRL(cat.total)}
                  </span>
                  <span className="text-ink-faint text-xs w-10 text-right">
                    {cat.share.toFixed(1)}%
                  </span>
                </div>
                {/* Barra de progresso */}
                <div className="h-1 bg-line rounded-full">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(cat.share * 2.4, 100)}%`,
                             background: cat.color }} />
                </div>
              </button>

              {/* Subcategorias — expandidas */}
              {isOpen && (
                <div className="border-t border-line px-4 py-2">
                  {cat.subcategories.map((sub, i) => (
                    <div key={i}
                      className="flex items-center gap-2 py-1.5 border-b border-dashed border-line last:border-0">
                      <span className="w-2 h-2 rounded-full flex-none"
                        style={{ background: cat.color }} />
                      <span className="text-xs font-semibold flex-1 truncate">{sub.label}</span>
                      <span className="text-xs text-ink-faint">{sub.transaction_count} lanç.</span>
                      <span className="text-xs font-bold tabular-nums ml-auto">
                        {formatBRL(sub.total)}
                      </span>
                      <span className="text-xs text-ink-faint w-8 text-right">
                        {sub.share_of_parent.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  <button onClick={onNavigateCashflow}
                    className="mt-2 text-xs text-acc font-semibold flex items-center gap-1">
                    Ver no fluxo de caixa <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

---

## Componente: Resumo Executivo

3 blocos lado a lado:
- **Entrou**: receitas do período (verde)
- **Saiu**: despesas do período (vermelho)  
- **Sobrou**: fluxo líquido (verde/vermelho)

Abaixo: linha com compromissos pendentes + saldo previsto ao fim do mês.

---

## Responsividade
- Mobile (< 768px): grid 1 coluna, KPI cards 2×3
- Tablet (768–1024px): grid 2 colunas
- Desktop (> 1024px): grid 3 colunas
