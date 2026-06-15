import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { getCategoryTrends } from "../lib/api";
import type { ApiSession, CategoryRankingItem } from "../lib/api";
import { compactMoneyAbs, money } from "../lib/utils";

const COLORS = [
  "#6366f1", "#ef4444", "#f59e0b", "#22c55e", "#06b6d4",
  "#a855f7", "#ec4899", "#14b8a6", "#64748b", "#84cc16",
];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym}/${ym.slice(2, 4)}`;

// ---------------------------------------------------------------------------
// Donut — distribuição por categoria
// ---------------------------------------------------------------------------
function DistributionDonut({ items }: { items: CategoryRankingItem[] }) {
  const data = useMemo(() => {
    const sorted = [...items]
      .map((i) => ({ name: i.category_name ?? "Sem categoria", value: Math.abs(Number(i.amount ?? 0)) }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 7);
    const restValue = sorted.slice(7).reduce((s, i) => s + i.value, 0);
    if (restValue > 0) top.push({ name: "Outras", value: restValue });
    return top;
  }, [items]);
  const total = data.reduce((s, i) => s + i.value, 0);

  if (total === 0) {
    return <p className="t-sub" style={{ fontSize: 12, padding: "30px 0", textAlign: "center" }}>Sem despesas para distribuir.</p>;
  }
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 200, height: 200, flex: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => money(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: COLORS[i % COLORS.length], flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-2)" }}>{d.name}</span>
            <span className="t-sub" style={{ fontSize: 11 }}>{((d.value / total) * 100).toFixed(0)}%</span>
            <span className="mono" style={{ fontWeight: 700, minWidth: 72, textAlign: "right" }}>{compactMoneyAbs(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha — evolução das categorias (por categoria, não subcategoria)
// ---------------------------------------------------------------------------
function EvolutionLine({ session, query }: { session: ApiSession; query: string }) {
  const q = useQuery({
    queryKey: ["category-trends", session.token, query],
    queryFn: () => getCategoryTrends(session, query),
    staleTime: 5 * 60 * 1000,
  });
  const d = q.data;
  const rows = useMemo(() => {
    if (!d) return [];
    return d.months.map((m, i) => {
      const row: Record<string, number | string> = { month: monthLabel(m) };
      for (const s of d.series) row[s.category_name] = Number(s.points[i] ?? 0);
      return row;
    });
  }, [d]);

  if (q.isLoading) return <p className="t-sub" style={{ fontSize: 12, padding: "30px 0", textAlign: "center" }}>Carregando…</p>;
  if (!d || d.series.length === 0) return <p className="t-sub" style={{ fontSize: 12, padding: "30px 0", textAlign: "center" }}>Sem dados de evolução.</p>;

  return (
    <div style={{ height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
          <YAxis tickFormatter={(v: number) => compactMoneyAbs(v)} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
          <Tooltip formatter={(v: number) => money(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11.5 }} />
          {d.series.map((s, i) => (
            <Line key={s.category_name} type="monotone" dataKey={s.category_name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function CategoryCharts({ session, trendsQuery, rankingItems }: {
  session: ApiSession;
  trendsQuery: string;
  rankingItems: CategoryRankingItem[];
}) {
  return (
    <div className="grid cols-2" style={{ gap: 14, marginBottom: 14, alignItems: "stretch" }}>
      <div className="card card-pad">
        <h3 style={{ margin: "0 0 12px", fontSize: 14.5, fontWeight: 700 }}>Distribuição por categoria</h3>
        <DistributionDonut items={rankingItems} />
      </div>
      <div className="card card-pad">
        <h3 style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 700 }}>Evolução por categoria</h3>
        <p className="t-sub" style={{ margin: "0 0 10px", fontSize: 12 }}>Gasto mensal das principais categorias (não subcategorias).</p>
        <EvolutionLine session={session} query={trendsQuery} />
      </div>
    </div>
  );
}
