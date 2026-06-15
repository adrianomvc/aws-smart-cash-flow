import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { getCategoryTrends } from "../lib/api";
import type { ApiSession, CategoryRankingItem } from "../lib/api";
import { CATEGORY_GREY, categoryChartColor, compactMoneyAbs, money } from "../lib/utils";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// "2024" → "2024" (yearly); "2024-03" → "mar/24" (monthly)
const bucketLabel = (b: string) => (b.length === 4 ? b : `${MONTHS[Number(b.slice(5, 7)) - 1] ?? b}/${b.slice(2, 4)}`);

// ---------------------------------------------------------------------------
// Donut — distribuição por categoria
// ---------------------------------------------------------------------------
function DistributionDonut({ items }: { items: CategoryRankingItem[] }) {
  const data = useMemo(() => {
    const sorted = [...items]
      .map((i) => ({
        name: i.category_name ?? "Sem categoria",
        value: Math.abs(Number(i.amount ?? 0)),
        fill: categoryChartColor(i.category_name, i.color, i.category_id),
      }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 7);
    const restValue = sorted.slice(7).reduce((s, i) => s + i.value, 0);
    if (restValue > 0) top.push({ name: "Outras", value: restValue, fill: CATEGORY_GREY });
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
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip
              formatter={(v: number) => money(v)}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
              itemStyle={{ color: "var(--ink)" }}
              labelStyle={{ color: "var(--ink)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: d.fill, flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-2)" }}>{d.name}</span>
            <span className="t-sub" style={{ fontSize: 11 }}>{((d.value / total) * 100).toFixed(0)}%</span>
            <span className="mono" style={{ fontWeight: 700, minWidth: 72, textAlign: "right" }}>{compactMoneyAbs(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TooltipEntry = { value: number | string; name: string; color: string };

function LineTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const items = [...payload]
    .filter((p) => Number(p.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));
  if (!items.length) return null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 11px", boxShadow: "var(--sh-pop)", fontSize: 12, maxWidth: 250 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>{label}</div>
      {items.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: p.color, flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
          <span className="mono" style={{ fontWeight: 700, color: "var(--ink)" }}>{money(Number(p.value))}</span>
        </div>
      ))}
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
      const row: Record<string, number | string> = { month: bucketLabel(m) };
      for (const s of d.series) row[s.category_name] = Number(s.points[i] ?? 0);
      return row;
    });
  }, [d]);

  const tickInterval = Math.max(0, Math.ceil(rows.length / 12) - 1);

  if (q.isLoading) return <p className="t-sub" style={{ fontSize: 12, padding: "30px 0", textAlign: "center" }}>Carregando…</p>;
  if (!d || d.series.length === 0) return <p className="t-sub" style={{ fontSize: 12, padding: "30px 0", textAlign: "center" }}>Sem dados de evolução.</p>;

  return (
    <div style={{ height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" interval={tickInterval} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
          <YAxis tickFormatter={(v: number) => compactMoneyAbs(v)} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
          <Tooltip content={<LineTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11.5, color: "var(--ink-2)" }} />
          {d.series.map((s) => (
            <Line key={s.category_name} type="monotone" dataKey={s.category_name} stroke={categoryChartColor(s.category_name, s.color, s.category_id)} strokeWidth={2} dot={false} isAnimationActive={false} />
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
    <div className="grid cat-charts-grid" style={{ gap: 14, marginBottom: 14, alignItems: "stretch", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 7fr)" }}>
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
