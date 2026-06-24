import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownUp,
  BarChart3,
  ChevronRight,
  Loader2,
} from "lucide-react";

import {
  getDashboardSummary,
  getMonthlyCashflow,
  getDailyCashflow,
  getCategoryRanking,
  getSubcategoryRanking,
  getRecurringExpenses,
  getSpendingBreakdown,
} from "../lib/api";
import {
  categoryChartColor,
  compactMoneyAxis,
  dateLabel,
  money,
  moneyAbs,
  moneyAxisDomain,
  monthTickLabel,
  dayTickLabel,
  monthRange,
  withQueryParams,
  trailingMonthsQuery,
} from "../lib/utils";
import { buildDailyCashflow, buildMonthlyCashflow } from "../lib/cashflow";
import { useHasTransactions, usePeriod } from "../hooks";
import { SpendingProfileDetailed } from "../components/SpendingBreakdown";
import { EmptyInline, EmptyState, PageState } from "../components/ui";
import type {
  ApiSession,
  CategoryRankingItem,
  RecurringExpenseItem,
  SubcategoryRankingItem,
} from "../lib/api";
import type { PeriodState, TransactionDrilldown } from "../types";
import type { Page } from "../types";

// ---------------------------------------------------------------------------
// Helpers / exports (legacy — kept for external consumers)
// ---------------------------------------------------------------------------

export function compactCategoryDistribution(items: CategoryRankingItem[]) {
  const sorted = [...items]
    .map((item) => ({ ...item, amountValue: Math.abs(Number(item.amount ?? 0)) }))
    .sort((a, b) => b.amountValue - a.amountValue);
  const total = sorted.reduce((sum, item) => sum + item.amountValue, 0);
  const visible = sorted.filter(
    (item, index) => index < 5 && item.amountValue / Math.max(total, 1) >= 0.04,
  );
  const otherAmount = sorted.slice(visible.length).reduce((sum, item) => sum + item.amountValue, 0);
  if (otherAmount > 0) {
    visible.push({
      amount: String(otherAmount),
      amountValue: otherAmount,
      average_amount: String(otherAmount),
      category_id: null,
      category_name: "Outros",
      color: null,
      icon: null,
      count: sorted.slice(visible.length).reduce((sum, item) => sum + item.count, 0),
      share_ratio: String(otherAmount / Math.max(total, 1)),
      last_transaction_date: null,
    });
  }
  return visible;
}

export function CategoryBarList({
  items,
  limit = 7,
  loading,
  onOpenCategory,
}: {
  items: CategoryRankingItem[];
  limit?: number;
  loading: boolean;
  onOpenCategory: (item: CategoryRankingItem) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const sorted = [...items].sort(
    (a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)),
  );
  const maxAmount = Math.max(...sorted.map((item) => Math.abs(Number(item.amount ?? 0))), 1);
  const totalAmount = sorted.reduce((total, item) => total + Math.abs(Number(item.amount ?? 0)), 0);
  const visible = sorted.slice(0, limit);
  const hiddenCount = Math.max(sorted.length - limit, 0);
  const palette = ["#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#64748b", "#2563eb"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {visible.map((item, index) => {
        const amount = Math.abs(Number(item.amount ?? 0));
        const share = totalAmount > 0 ? amount / totalAmount : 0;
        return (
          <button
            className="row-item"
            key={item.category_id ?? item.category_name}
            onClick={() => onOpenCategory(item)}
            style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", width: "100%", textAlign: "left" }}
            type="button"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 130px" }}>
              <span className="catdot" style={{ background: palette[index % palette.length] }} />
              <span className="t-desc" style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.category_name}</span>
            </div>
            <div className="track thin" style={{ flex: 1 }}>
              <div className="fill" style={{ width: `${Math.max((amount / maxAmount) * 100, 4)}%`, background: palette[index % palette.length] }} />
            </div>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 90, textAlign: "right", fontSize: 13 }}>{moneyAbs(amount)}</span>
            <span className="mono faint" style={{ fontSize: 11, width: 38, textAlign: "right" }}>{(share * 100).toFixed(0)}%</span>
          </button>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-3)" }}>
        <span>Total{hiddenCount > 0 ? <em style={{ marginLeft: 4 }}>+{hiddenCount} mais</em> : null}</span>
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{moneyAbs(totalAmount)}</strong>
      </div>
    </div>
  );
}

export function PersonalizedTip({
  balance,
  onNavigateReports,
  recurring,
}: {
  balance: number;
  onNavigateReports: () => void;
  recurring: RecurringExpenseItem[];
}) {
  const top = recurring[0];
  const text = top
    ? `Revise ${top.description}: último valor ${moneyAbs(top.last_amount)} · média ${moneyAbs(top.average_amount)}.`
    : balance < 0
    ? "Seu saldo está negativo. Priorize revisar as categorias com maior crescimento."
    : "Continue categorizando as transações para melhorar as análises automáticas.";
  return (
    <div
      className="card card-pad"
      style={{ background: "linear-gradient(135deg,var(--acc-soft),var(--card) 55%)", display: "flex", alignItems: "flex-start", gap: 12 }}
    >
      <div className="goal-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)", border: "1px solid var(--acc-soft-2)", flexShrink: 0, marginTop: 2 }}>
        <BarChart3 size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow" style={{ color: "var(--acc-ink)", marginBottom: 4 }}>Dica personalizada</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink)", margin: 0 }}>{text}</p>
      </div>
      <button
        className="badge b-pos"
        onClick={onNavigateReports}
        style={{ marginLeft: "auto", cursor: "pointer", flexShrink: 0 }}
        type="button"
      >
        Ver análises
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function brl(val: number | string | null | undefined, opts: { sign?: boolean; dec?: number } = {}): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "R$ 0";
  const { sign = false, dec = 0 } = opts;
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const s = n < 0 ? "−" : sign ? "+" : "";
  return `${s}R$ ${abs}`;
}

function num(val: number | string | null | undefined, dec = 0): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "0";
  return Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}


// ---------------------------------------------------------------------------
// CIcon — prototype icon set (mirrors DIcon in DashboardPage)
// ---------------------------------------------------------------------------

const C_ICONS: Record<string, string> = {
  arrowDR: "M7 7l10 10 M17 8v9H8",
  arrowUR: "M7 17L17 7 M8 7h9v9",
  flow:    "M4 6h10 M4 6l3-3 M4 6l3 3 M20 18H10 M20 18l-3-3 M20 18l-3 3 M4 12h16",
  wallet:  "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  info:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  pie:     "M12 3v9h9 M21 12a9 9 0 1 1-9-9 M21 12a9 9 0 0 0-9-9",
  bars:    "M5 20V10 M12 20V4 M19 20v-7 M3 20h18",
  repeat:  "M4 9l3-3 3 3 M7 6v9a2 2 0 0 0 2 2h11 M20 15l-3 3-3-3 M17 18V9a2 2 0 0 0-2-2H4",
  gauge:   "M12 14l4-4 M3.5 12a8.5 8.5 0 0 1 17 0 M12 14a2 2 0 1 0 0-4",
};

function CIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = C_ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }}>
      {segs.map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sankey types + layout
// ---------------------------------------------------------------------------

type SankeyNodeDef = { id: string; label: string; value: number; color: string; kind?: string };
type SankeyColDef  = { id: string; nodes: SankeyNodeDef[] };
type SankeyLinkDef = { from: string; to: string; value: number; color: string };
interface LayoutNode extends SankeyNodeDef {
  _key: string; _col: number;
  x: number; y0: number; y1: number; flow: number;
  used_out: number; used_in: number;
  in_links: SankeyLinkDef[]; out_links: SankeyLinkDef[];
}
type LayoutFlow = {
  id: string; from: LayoutNode; to: LayoutNode;
  ay0: number; ay1: number; by0: number; by1: number;
  value: number; color: string;
};

function layoutSankey(
  columns: SankeyColDef[], links: SankeyLinkDef[],
  { width, height, nodeW, gap, padX, padTopBot }:
  { width: number; height: number; nodeW: number; gap: number; padX: number; padTopBot: number },
): { nodes: Record<string, LayoutNode>; flows: LayoutFlow[] } {
  const nodes: Record<string, LayoutNode> = {};
  columns.forEach((col, ci) =>
    col.nodes.forEach(n => {
      const key = col.id + "/" + n.id;
      nodes[key] = { ...n, _key: key, _col: ci, in_links: [], out_links: [],
        x: 0, y0: 0, y1: 0, flow: 0, used_out: 0, used_in: 0 };
    })
  );
  links.forEach(l => {
    const fr = nodes[l.from], to = nodes[l.to];
    if (fr) fr.out_links.push(l);
    if (to) to.in_links.push(l);
  });
  Object.values(nodes).forEach(n => {
    const out = n.out_links.reduce((s, l) => s + l.value, 0);
    const inc = n.in_links.reduce((s, l) => s + l.value, 0);
    n.flow = Math.max(out, inc, n.value ?? 0);
  });
  const colTotals = columns.map(c => c.nodes.reduce((s, n) => s + nodes[c.id + "/" + n.id].flow, 0));
  const maxTotal  = Math.max(...colTotals) || 1;
  const maxNodes  = Math.max(...columns.map(c => c.nodes.length));
  const availH    = height - padTopBot * 2 - (maxNodes - 1) * gap;
  const scale     = availH / maxTotal;
  const cols      = columns.length;
  const colX      = (i: number) => padX + (width - padX * 2 - nodeW) * (i / (cols - 1));
  columns.forEach((col, ci) => {
    const total = colTotals[ci];
    const colH  = total * scale + (col.nodes.length - 1) * gap;
    let cursor  = padTopBot + (availH + (maxNodes - 1) * gap - colH) / 2;
    col.nodes.forEach(n => {
      const node = nodes[col.id + "/" + n.id];
      node.x  = colX(ci);
      node.y0 = cursor;
      node.y1 = cursor + node.flow * scale;
      cursor  = node.y1 + gap;
    });
  });
  Object.values(nodes).forEach(n => { n.used_out = n.y0; n.used_in = n.y0; });
  columns.forEach(col => col.nodes.forEach(n => {
    const node = nodes[col.id + "/" + n.id];
    node.out_links.sort((a, b) => (nodes[a.to]?.y0 ?? 0) - (nodes[b.to]?.y0 ?? 0));
    node.in_links.sort((a, b)  => (nodes[a.from]?.y0 ?? 0) - (nodes[b.from]?.y0 ?? 0));
  }));
  const flows: LayoutFlow[] = [];
  const MIN = 1.4;
  columns.forEach((col, ci) => {
    if (ci === cols - 1) return;
    col.nodes.forEach(n => {
      const a = nodes[col.id + "/" + n.id];
      a.out_links.forEach(l => {
        const b = nodes[l.to];
        if (!b) return;
        const h = l.value * scale;
        const ay0 = a.used_out, ay1 = Math.max(ay0 + h, ay0 + MIN);
        const by0 = b.used_in,  by1 = Math.max(by0 + h, by0 + MIN);
        a.used_out = ay1;
        b.used_in  = by1;
        flows.push({ id: l.from + "→" + l.to, from: a, to: b,
          ay0, ay1, by0, by1, value: l.value, color: l.color || a.color });
      });
    });
  });
  return { nodes, flows };
}

// ---------------------------------------------------------------------------
// SankeyChart — pure SVG renderer
// ---------------------------------------------------------------------------

function SankeyChart({
  columns, links, height = 440, width = 1200, nodeW = 14,
  gap = 5, padX = 14, padTopBot = 18,
}: {
  columns: SankeyColDef[]; links: SankeyLinkDef[];
  height?: number; width?: number; nodeW?: number;
  gap?: number; padX?: number; padTopBot?: number;
}) {
  const [hoverFlow, setHoverFlow] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const { nodes, flows } = useMemo(
    () => layoutSankey(columns, links, { width, height, nodeW, gap, padX, padTopBot }),
    [JSON.stringify(columns), JSON.stringify(links), height, width, nodeW, gap, padX, padTopBot],
  );
  function flowPath(f: LayoutFlow) {
    const x0 = f.from.x + nodeW, x1 = f.to.x, mx = (x0 + x1) / 2;
    return `M ${x0} ${f.ay0} C ${mx} ${f.ay0} ${mx} ${f.by0} ${x1} ${f.by0} L ${x1} ${f.by1} C ${mx} ${f.by1} ${mx} ${f.ay1} ${x0} ${f.ay1} Z`;
  }
  const nodeList = Object.values(nodes);
  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", display: "block", overflow: "visible" }}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => { setHoverFlow(null); setHoverNode(null); }}
      >
        {flows.map(f => {
          const dim = (hoverFlow && hoverFlow !== f.id) ||
            (hoverNode && f.from._key !== hoverNode && f.to._key !== hoverNode);
          return (
            <path
              key={f.id} d={flowPath(f)} fill={f.color}
              opacity={dim ? 0.08 : hoverFlow === f.id ? 0.7 : 0.42}
              onMouseEnter={() => setHoverFlow(f.id)}
              onMouseLeave={() => setHoverFlow(null)}
              style={{ transition: "opacity .12s", cursor: "pointer" }}
            />
          );
        })}
        {nodeList.map(n => (
          <rect
            key={n._key} x={n.x} y={n.y0} width={nodeW}
            height={Math.max(2, n.y1 - n.y0)} rx={2} fill={n.color}
            opacity={hoverNode && hoverNode !== n._key ? 0.45 : 1}
            onMouseEnter={() => setHoverNode(n._key)}
            onMouseLeave={() => setHoverNode(null)}
            style={{ transition: "opacity .12s" }}
          />
        ))}
        {nodeList.map(n => {
          const h = n.y1 - n.y0;
          if (h < 10) return null;
          const isLeft = n._col === 0;
          const x = isLeft ? n.x - 8 : n.x + nodeW + 8;
          const anchor = isLeft ? "end" : "start";
          const yMid = (n.y0 + n.y1) / 2;
          const vTxt = n.value >= 1000
            ? "R$ " + (n.value / 1000).toFixed(1) + "k"
            : "R$ " + n.value.toFixed(0);
          return (
            <g key={"lbl-" + n._key} style={{ pointerEvents: "none" }}>
              <text x={x} y={yMid - 2} textAnchor={anchor} fontSize={11}
                fill="var(--ink)" fontWeight={600} fontFamily="var(--font-display)">{n.label}</text>
              <text x={x} y={yMid + 12} textAnchor={anchor} fontSize={10}
                fill="var(--ink-3)" fontFamily="var(--font-mono)">{vTxt}</text>
            </g>
          );
        })}
      </svg>
      {hoverFlow && (() => {
        const f = flows.find(x => x.id === hoverFlow);
        if (!f) return null;
        const cx = (f.from.x + nodeW + f.to.x) / 2;
        const cy = ((f.ay0 + f.ay1) / 2 + (f.by0 + f.by1) / 2) / 2;
        return (
          <div style={{ position: "absolute", left: (cx / width * 100) + "%",
            top: (cy / height * 100) + "%", transform: "translate(-50%,-110%)", pointerEvents: "none" }}>
            <div className="card card-pad" style={{ fontSize: 12, minWidth: 140, boxShadow: "var(--sh-lg)" }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>{f.from.label} → {f.to.label}</div>
              <div style={{ color: "var(--ink-2)" }}>{brl(f.value)}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnswerCard — why did the period close positive / negative?
// ---------------------------------------------------------------------------

function AnswerCard({ income, expenses, netFlow }: { income: number; expenses: number; netFlow: number }) {
  const isPositive = netFlow >= 0;
  return (
    <div
      className="card card-pad"
      style={{ marginBottom: 16, background: "linear-gradient(135deg,var(--acc-soft),var(--card) 55%)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          className="goal-ic"
          style={{ background: "var(--acc-soft)", color: "var(--acc)", border: "1px solid var(--acc-soft-2)" }}
        >
          <CIcon name="info" size={15} />
        </span>
        <span className="eyebrow" style={{ color: "var(--acc-ink)" }}>
          {isPositive ? "Por que você fechou no positivo" : "Por que você fechou no negativo"}
        </span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)" }}>
        Suas receitas (<b>{brl(income)}</b>) {isPositive ? "superaram as despesas" : "ficaram abaixo das despesas"} (<b>{brl(expenses)}</b>) em{" "}
        <b style={{ color: isPositive ? "var(--acc-ink)" : "var(--neg)" }}>{brl(Math.abs(netFlow))}</b>.{" "}
        {isPositive
          ? "Continue monitorando as categorias de despesa para manter o resultado positivo."
          : "Revise as categorias de maior impacto para melhorar o resultado no próximo período."}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SankeyPanel — jornada do dinheiro com toggle categorias/subcategorias
// ---------------------------------------------------------------------------

const INCOME_PALETTE = ["#1f8a5b", "#2a9d8f", "#3d7d63", "#5a9d63", "#6cb286"];

function SankeyPanel({
  categories,
  subcategories,
  incomeSubcategories,
  totalIncome,
  onNav,
}: {
  categories: CategoryRankingItem[];
  subcategories: SubcategoryRankingItem[];
  incomeSubcategories: SubcategoryRankingItem[];
  totalIncome: number;
  onNav: (p: Page) => void;
}) {
  const [withSubs, setWithSubs] = useState(false);

  // Income broken down by its real (credit) subcategories, scaled so the sources
  // sum to the income total. "Sem categoria" income shows grey.
  const incomeSrc = incomeSubcategories.filter(s => parseFloat(s.amount ?? "0") > 0);
  let sources: SankeyNodeDef[];
  if (incomeSrc.length > 0 && totalIncome > 0) {
    const top = incomeSrc.slice(0, 5);
    const rawTotal = top.reduce((sum, s) => sum + parseFloat(s.amount ?? "0"), 0);
    sources = top.map((s, i) => {
      const isNone = s.category_id == null || s.subcategory_name.toLowerCase().startsWith("sem categoria");
      const value = parseFloat(s.amount ?? "0");
      return {
        id: "src_" + i,
        label: isNone ? "Sem categoria" : s.subcategory_name,
        value: rawTotal > 0 ? (value / rawTotal) * totalIncome : value,
        color: isNone ? "#94a3b8" : INCOME_PALETTE[i % INCOME_PALETTE.length],
      };
    });
  } else {
    sources = [{ id: "src_0", label: "Total de receitas", value: totalIncome, color: "#1f8a5b" }];
  }

  const expenseCats: SankeyNodeDef[] = categories
    .filter(c =>
      !["renda", "receita"].some(t => c.category_name?.toLowerCase().includes(t)) &&
      parseFloat(c.amount ?? "0") > 0,
    )
    .slice(0, 8)
    .map(c => ({
      id: c.category_id ?? c.category_name,
      label: c.category_name,
      value: parseFloat(c.amount ?? "0"),
      // Consistent with the rest of the app: "Sem categoria" (null id) → grey.
      color: categoryChartColor(c.category_name, c.color, c.category_id),
      kind: "expense" as const,
    }));

  const totalOut = expenseCats.reduce((s, c) => s + c.value, 0);
  const sobra    = Math.max(0, totalIncome - totalOut);

  // Build columns and links depending on withSubs toggle
  let columns: SankeyColDef[];
  let links: SankeyLinkDef[];
  let subCount = 0;

  if (!withSubs) {
    const rightNodes: SankeyNodeDef[] = [...expenseCats];
    if (sobra > 0) rightNodes.push({ id: "sobra", label: "Sobrou", value: sobra, color: "#1f8a5b", kind: "save" });
    columns = [
      { id: "sources", nodes: sources },
      { id: "income",  nodes: [{ id: "total", label: "Saldo", value: totalIncome, color: "#3d7d63" }] },
      { id: "right",   nodes: rightNodes },
    ];
    links = [
      ...sources.map(src => ({ from: "sources/" + src.id, to: "income/total", value: src.value, color: src.color })),
      ...rightNodes.map(n  => ({ from: "income/total", to: "right/" + n.id,  value: n.value,  color: n.color })),
    ];
  } else {
    // With subcategories: add a 4th column
    const subNodes: SankeyNodeDef[] = [];
    const subLinks: SankeyLinkDef[] = [];
    expenseCats.forEach(cat => {
      const subs = subcategories
        .filter(s => s.category_id === cat.id || s.category_id === categories.find(c => (c.category_id ?? c.category_name) === cat.id)?.category_id)
        .sort((a, b) => parseFloat(b.amount ?? "0") - parseFloat(a.amount ?? "0"))
        .slice(0, 4);
      if (subs.length > 0) {
        subs.forEach((s, j) => {
          const sid = `sub_${cat.id}_${j}`;
          const v = parseFloat(s.amount ?? "0");
          subNodes.push({ id: sid, label: s.subcategory_name, value: v, color: cat.color });
          subLinks.push({ from: "cats/" + cat.id, to: "subs/" + sid, value: v, color: cat.color });
          subCount++;
        });
      } else {
        const sid = `sub_${cat.id}_0`;
        subNodes.push({ id: sid, label: cat.label, value: cat.value, color: cat.color });
        subLinks.push({ from: "cats/" + cat.id, to: "subs/" + sid, value: cat.value, color: cat.color });
      }
    });
    if (sobra > 0) {
      subNodes.push({ id: "sobra_s", label: "Sobrou", value: sobra, color: "#1f8a5b" });
      subLinks.push({ from: "income/total", to: "subs/sobra_s", value: sobra, color: "#1f8a5b" });
    }
    columns = [
      { id: "sources", nodes: sources },
      { id: "income",  nodes: [{ id: "total", label: "Saldo", value: totalIncome, color: "#3d7d63" }] },
      { id: "cats",    nodes: expenseCats },
      { id: "subs",    nodes: subNodes },
    ];
    links = [
      ...sources.map(src => ({ from: "sources/" + src.id, to: "income/total",     value: src.value, color: src.color })),
      ...expenseCats.map(n  => ({ from: "income/total",  to: "cats/" + n.id,      value: n.value,   color: n.color })),
      ...subLinks,
    ];
  }

  const height = withSubs ? 560 : 440;
  const numSubs = withSubs ? subCount : expenseCats.length;

  if (totalIncome === 0 || !categories.length) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="kpi-ic"><CIcon name="flow" size={15} /></div>
          <div><div className="ttl">A jornada do seu dinheiro</div></div>
        </div>
        <div className="state" style={{ padding: "32px 20px" }}>
          <div className="state-ic"><CIcon name="flow" size={20} /></div>
          <h4>Sem dados de fluxo</h4>
          <p>Importe extratos e categorize para ver a visualização.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div className="kpi-ic"><CIcon name="flow" size={15} /></div>
        <div>
          <div className="ttl">A jornada do seu dinheiro</div>
          <div className="sub">
            {"Fontes de receita → categorias" + (withSubs ? " → subcategorias" : " e sobra") + " · todas as transações"}
          </div>
        </div>
        <div className="spacer" />
        <div className="seg">
          <button className={!withSubs ? "on" : ""} onClick={() => setWithSubs(false)} type="button">Categorias</button>
          <button className={withSubs ? "on" : ""} onClick={() => setWithSubs(true)} type="button">Subcategorias</button>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={() => onNav("reports")} type="button">
          Exportar
        </button>
      </div>
      <div className="card-body" style={{ padding: "14px 16px 18px" }}>
        <SankeyChart columns={columns} links={links} height={height} gap={5} padTopBot={18} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <SankeyStat label="Entradas" value={totalIncome} sub={`${sources.length} fonte${sources.length !== 1 ? "s" : ""}`} tone="pos" />
          <SankeyStat label="Saídas"   value={totalOut}    sub={`${expenseCats.length} categorias`}                            tone="neg" />
          <SankeyStat label="Sobrou"   value={sobra}       sub={`${totalIncome > 0 ? ((sobra / totalIncome) * 100).toFixed(1) : "0"}% da renda`} tone="acc" />
          <SankeyStat label="Detalhe"  value={numSubs}     sub="subcategorias usadas"                                          tone="neutral" numeric />
        </div>
      </div>
    </div>
  );
}

function SankeyStat({ label, value, sub, tone, numeric }: {
  label: string; value: number; sub: string; tone: "pos" | "neg" | "acc" | "neutral"; numeric?: boolean;
}) {
  const color = tone === "pos" ? "var(--acc-ink)" : tone === "neg" ? "var(--neg)" : tone === "acc" ? "var(--pos)" : "var(--ink)";
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
        {numeric ? value : brl(value)}
      </div>
      <div className="t-sub" style={{ marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composição das despesas — SplitBar
// ---------------------------------------------------------------------------

function SplitBar({ fixed, variable }: { fixed: number; variable: number }) {
  const total = fixed + variable || 1;
  return (
    <div style={{ display: "flex", height: 14, borderRadius: 20, overflow: "hidden", gap: 2 }}>
      <div style={{ width: (fixed / total * 100) + "%", background: "var(--info)" }} />
      <div style={{ width: (variable / total * 100) + "%", background: "var(--warn)" }} />
    </div>
  );
}

function MiniStat({ dot, label, value, pct }: { dot: string; label: string; value: number; pct: number }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ background: dot, width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-faint)" }}>{pct}%</span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{brl(value)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatImpactAccordion
// ---------------------------------------------------------------------------

const CAT_PALETTE = ["#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#64748b", "#2563eb", "#14b8a6"];

function CatImpactAccordion({
  items,
  subcategoryItems,
  loading,
  onOpenCategory,
  onOpenTransactions,
  onManageCategories,
}: {
  items: CategoryRankingItem[];
  subcategoryItems: SubcategoryRankingItem[];
  loading: boolean;
  onOpenCategory: (item: CategoryRankingItem) => void;
  onOpenTransactions: () => void;
  onManageCategories: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const ranked = [...items]
    .filter((c) => c.category_id !== null)
    .sort((a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)));
  const sorted = ranked.slice(0, 5);
  const hiddenCount = ranked.length - sorted.length;
  const hiddenAmount = ranked.slice(5).reduce((sum, item) => sum + Math.abs(Number(item.amount ?? 0)), 0);
  const totalAmount = sorted.reduce((sum, item) => sum + Math.abs(Number(item.amount ?? 0)), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map((cat, index) => {
        const amount = Math.abs(Number(cat.amount ?? 0));
        const pct = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
        const color = CAT_PALETTE[index % CAT_PALETTE.length];
        const isOpen = open === cat.category_id;
        const subs = subcategoryItems
          .filter((s) => s.category_id === cat.category_id)
          .sort((a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)));

        return (
          <div
            key={cat.category_id ?? cat.category_name}
            style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : (cat.category_id ?? null))}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "11px 12px",
                background: isOpen ? "var(--card-2)" : "transparent", transition: "background .12s", cursor: "pointer",
              }}
              type="button"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", display: "grid" }}>
                  <ChevronRight size={13} />
                </span>
                <span className="catdot" style={{ background: color }} />
                <span className="t-desc" style={{ fontSize: 13 }}>{cat.category_name}</span>
                <span className="mono faint" style={{ fontSize: 11 }}>{subs.length} sub. · {subs.reduce((a, s) => a + s.count, 0)} lanç.</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moneyAbs(amount)}</span>
                <span className="mono faint" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct.toFixed(1)}%</span>
              </div>
              <div className="track thin">
                <div className="fill" style={{ width: `${Math.min(pct * 2.4, 100)}%`, background: color }} />
              </div>
            </button>
            {isOpen && (
              <div style={{ borderTop: "1px solid var(--line)", padding: "4px 12px 10px 30px" }}>
                {subs.length === 0 ? (
                  <p style={{ padding: "10px 0", fontSize: 12, color: "var(--ink-3)" }}>
                    Sem subcategorias nesta categoria no período.
                  </p>
                ) : (
                  subs.map((s, j) => {
                    const sAmount = Math.abs(Number(s.amount ?? 0));
                    const sPct = amount > 0 ? (sAmount / amount) * 100 : 0;
                    return (
                      <div
                        key={`${s.subcategory_name}-${j}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
                          borderBottom: j < subs.length - 1 ? "1px dashed var(--line)" : "none",
                        }}
                      >
                        <span className="catdot" style={{ background: color, width: 7, height: 7 }} />
                        <span style={{ fontWeight: 600, fontSize: 12.5, flex: "0 0 150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.subcategory_name}
                        </span>
                        <div className="track thin" style={{ flex: 1 }}>
                          <div className="fill" style={{ width: `${Math.min(sPct, 100)}%`, background: color }} />
                        </div>
                        <span className="mono faint" style={{ fontSize: 11, width: 56, textAlign: "right" }}>{s.count} lanç.</span>
                        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 86, textAlign: "right", fontSize: 12.5 }}>
                          {moneyAbs(sAmount)}
                        </span>
                        <span className="mono faint" style={{ fontSize: 10.5, width: 38, textAlign: "right" }}>{sPct.toFixed(0)}%</span>
                      </div>
                    );
                  })
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={() => onOpenCategory(cat)}
                    type="button"
                  >
                    Ver lançamentos
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={onManageCategories}
                    type="button"
                  >
                    Editar subcategorias
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <button
          className="btn btn-quiet btn-sm"
          onClick={onOpenTransactions}
          type="button"
          style={{ alignSelf: "flex-start", marginTop: 2 }}
        >
          +{hiddenCount} {hiddenCount === 1 ? "outra categoria" : "outras categorias"} · {moneyAbs(hiddenAmount)} · ver todas
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recorrências relevantes — bottom-right card
// ---------------------------------------------------------------------------

function RecorrenciasCard({
  items,
  loading,
  onOpen,
}: {
  items: RecurringExpenseItem[];
  loading: boolean;
  onOpen: (item: RecurringExpenseItem) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando" description="Aguarde." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhuma recorrência identificada." />;

  return (
    <div style={{ padding: "2px 0" }}>
      {items.slice(0, 6).map((item) => (
        <button
          className="row-item"
          key={item.description}
          onClick={() => onOpen(item)}
          style={{ display: "flex", alignItems: "center", width: "100%", textAlign: "left", gap: 8 }}
          type="button"
        >
          <span
            className="goal-ic"
            style={{ background: "var(--neg-soft)", color: "var(--neg)", flexShrink: 0 }}
          >
            <CIcon name="repeat" size={12} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-desc" style={{ fontSize: 13 }}>{item.description}</div>
            <div className="t-sub">{item.category_name ?? "Sem cat."} · Mensal · {item.month_count} meses</div>
          </div>
          <span style={{ fontWeight: 700, color: "var(--neg)", fontVariantNumeric: "tabular-nums", fontSize: 12.5, flexShrink: 0 }}>
            {moneyAbs(item.average_amount)}
          </span>
        </button>
      ))}
      <div style={{ fontSize: 12, color: "var(--ink-3)", paddingTop: 8, borderTop: "1px solid var(--line)", marginTop: 4 }}>
        Total recorrente:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {moneyAbs(items.reduce((sum, i) => sum + Math.abs(Number(i.average_amount ?? 0)), 0))}/mês
        </strong>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CashflowTooltip
// ---------------------------------------------------------------------------

function CashflowTooltip({
  active,
  payload,
  view,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { balance?: number | null; date?: string; expenses?: number; income?: number; month?: string; pay?: number; projectedBalance?: number | null }; value?: number }>;
  view: "day" | "month";
}) {
  const pt = payload?.[0]?.payload;
  if (!active || !pt) return null;
  const label = view === "month" ? monthTickLabel(pt.month ?? "") : dateLabel(pt.date ?? "");
  return (
    <div className="card card-pad" style={{ padding: "10px 14px", fontSize: 12.5, minWidth: 160 }}>
      <strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>{label}</strong>
      <div style={{ color: "var(--acc-ink)" }}>Receitas: {moneyAbs(pt.income ?? 0)}</div>
      <div style={{ color: "var(--neg)" }}>Saídas: {moneyAbs(pt.expenses ?? 0)}</div>
      {view === "day" && pt.pay ? <div style={{ color: "var(--warn)" }}>Pagamento de fatura: {moneyAbs(pt.pay)}</div> : null}
      {pt.balance != null ? <div>Saldo: {money(pt.balance)}</div> : null}
      {pt.projectedBalance != null ? <div className="faint">Projetado: {money(pt.projectedBalance)}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CashflowPage({
  onNavigate,
  onOpenImports,
  onOpenTransactions,
  session,
  period: cashflowPeriod,
  setPeriod: setCashflowPeriod,
}: {
  onNavigate: (page: Page) => void;
  onOpenImports?: () => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
  period: PeriodState;
  setPeriod: Dispatch<SetStateAction<PeriodState>>;
}) {
  const hasTransactions = useHasTransactions(session);
  const period = usePeriod(cashflowPeriod, setCashflowPeriod);
  const [view, setView] = useState<"mes" | "liq">("mes");
  const [chartMode, setChartMode] = useState<"day" | "month">("month");
  // history: 12 months ending at period.dateTo — for "Mês" chart regardless of filter
  const cashflowHistoryQuery = trailingMonthsQuery(period.dateTo || new Date().toISOString().slice(0, 10), 12);

  const summary = useQuery({
    queryKey: ["cashflow-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
    staleTime: 3 * 60 * 1000,
  });
  const cashflowMonthly = useQuery({
    queryKey: ["cashflow-history", session.token, cashflowHistoryQuery],
    queryFn: () => getMonthlyCashflow(session, cashflowHistoryQuery),
    staleTime: 10 * 60 * 1000,
  });
  const cashflowDaily = useQuery({
    queryKey: ["cashflow-daily", session.token, period.query],
    queryFn: () => getDailyCashflow(session, period.query),
    staleTime: 3 * 60 * 1000,
  });
  const ranking = useQuery({
    queryKey: ["cashflow-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "50" })),
    staleTime: 3 * 60 * 1000,
  });
  const subcategoryRanking = useQuery({
    queryKey: ["cashflow-subranking", session.token, period.query],
    queryFn: () => getSubcategoryRanking(session, withQueryParams(period.query, { limit: "50" })),
    staleTime: 3 * 60 * 1000,
  });
  const incomeSubcategoryRanking = useQuery({
    queryKey: ["cashflow-income-subranking", session.token, period.query],
    queryFn: () => getSubcategoryRanking(session, withQueryParams(period.query, { limit: "50", direction: "credit" })),
    staleTime: 3 * 60 * 1000,
  });
  const recurring = useQuery({
    queryKey: ["cashflow-recurring", session.token, period.recurringQuery],
    queryFn: () =>
      getRecurringExpenses(
        session,
        withQueryParams(period.recurringQuery, { limit: "6", min_months: "2" }),
      ),
    staleTime: 3 * 60 * 1000,
  });
  const breakdown = useQuery({
    queryKey: ["cashflow-breakdown", session.token, period.query],
    queryFn: () => getSpendingBreakdown(session, period.query),
    staleTime: 3 * 60 * 1000,
  });

  const income = Number(summary.data?.income ?? 0);
  const expenses = Number(summary.data?.expenses ?? 0);
  const netFlow = income - expenses;
  const currentBalance = summary.data?.current_balance != null ? Number(summary.data.current_balance) : null;

  const monthlyCashflow = useMemo(() => {
    const items = cashflowMonthly.data?.items ?? [];
    // Use the first item's month as date ref so year padding uses the correct year.
    // If items span two years the year extraction picks the start year, which is fine
    // since we want the real items (not a padded grid) — pass empty string to skip padding.
    const dateRef = items.length > 0 ? "" : (period.dateFrom || period.dateTo);
    return buildMonthlyCashflow(items, dateRef, []);
  }, [cashflowMonthly.data?.items, period.dateFrom, period.dateTo]);
  const dailyCashflow = useMemo(
    () =>
      buildDailyCashflow({
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        items: cashflowDaily.data?.items ?? [],
        projectionPoints: [],
      }),
    [cashflowDaily.data?.items, period.dateFrom, period.dateTo],
  );
  const chartRows = chartMode === "month" ? monthlyCashflow : dailyCashflow;
  const chartAxisDomain = useMemo(
    () =>
      moneyAxisDomain(
        chartRows as Array<Record<string, unknown>>,
        ["income", "expenses", "balance", "projectedBalance"],
        true,
      ),
    [chartRows],
  );
  // Derived split fields so both charts can fill green when positive / red when
  // negative (same visual language as the dashboard money-story chart).
  const chartData = useMemo(
    () => chartRows.map((row) => {
      const bal = row.balance ?? 0;
      const net = row.income + row.expenses;
      const pay = "payments" in row ? (row as { payments: number }).payments : 0;
      return {
        ...row,
        netFlow: net,
        balPos: Math.max(0, bal),
        balNeg: Math.min(0, bal),
        netPos: Math.max(0, net),
        netNeg: Math.min(0, net),
        pay,
      };
    }),
    [chartRows],
  );

  const categoryItems = ranking.data?.items ?? [];
  const subcategoryItems = subcategoryRanking.data?.items ?? [];
  const recurringItems = recurring.data?.items ?? [];

  // Composição das despesas: cálculo preciso por transação (fixo = recorrente com
  // valor estável; soma exatamente o total de despesas do período).
  const recurringFixed = Number(breakdown.data?.fixed.total ?? 0);
  const recurringVariable = Number(breakdown.data?.variable.total ?? 0);
  const compTotal = recurringFixed + recurringVariable;
  const fixedPct = compTotal > 0 ? Math.round((recurringFixed / compTotal) * 100) : 0;
  const varPct = 100 - fixedPct;

  function openCategoryTransactions(item: CategoryRankingItem) {
    if (!item.category_id) { onNavigate("review"); return; }
    onOpenTransactions({
      categoryId: item.category_id,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      label: item.category_name,
      periodPreset: period.periodPreset,
    });
  }

  function openChartTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    const range = chartMode === "month" ? monthRange(data.activeLabel) : { dateFrom: data.activeLabel, dateTo: data.activeLabel };
    if (!range) return;
    onOpenTransactions({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      label: chartMode === "month" ? `Fluxo ${monthTickLabel(data.activeLabel)}` : `Fluxo ${dateLabel(data.activeLabel)}`,
      periodPreset: "custom",
    });
  }

  const isEmpty = hasTransactions === false
    || (!summary.isLoading && summary.data != null && Number(summary.data.transaction_count ?? 0) === 0);
  if (isEmpty) {
    return (
      <div className="canvas stg">
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Fluxo de caixa</div>
          <h2 className="section-title"><ArrowDownUp size={18} /> Fluxo de caixa</h2>
        </div>
        <EmptyState icon={ArrowDownUp} title="Comece importando seus extratos"
          description="O SmartCashFlow monta seu fluxo de caixa, indicadores e projeções a partir dos seus extratos (OFX, CSV ou Excel). Importe o primeiro arquivo e o painel se preenche sozinho."
          actionLabel="Importar extrato" onAction={() => (onOpenImports ? onOpenImports() : onNavigate("dashboard"))} />
      </div>
    );
  }

  return (
    <div className="canvas stg">
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Visão</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: 0 }}>Fluxo de Caixa</h2>
          <div className="sub" style={{ marginTop: 2 }}>Por que sobrou ou faltou dinheiro? Entradas, saídas e saldo acumulado.</div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate("reports")}
          type="button"
        >
          Exportar
        </button>
      </div>

      {/* KPI grid — 4 tiles */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <button
          className="kpi"
          onClick={() => onOpenTransactions({ direction: "credit", dateFrom: period.dateFrom, dateTo: period.dateTo, label: "Receitas", periodPreset: period.periodPreset })}
          style={{ cursor: "pointer", textAlign: "left" }}
          type="button"
        >
          <div className="kpi-top">
            <div className="kpi-ic"><CIcon name="arrowDR" size={16} /></div>
            <span className="kpi-label">Receitas no período</span>
          </div>
          <div className="kpi-val" style={{ color: "var(--acc-ink)" }}>
            <span className="cur">R$</span>
            {num(income)}
          </div>
          <div className="kpi-sub">entradas confirmadas</div>
        </button>

        <button
          className="kpi"
          onClick={() => onOpenTransactions({ direction: "debit", dateFrom: period.dateFrom, dateTo: period.dateTo, label: "Despesas", periodPreset: period.periodPreset })}
          style={{ cursor: "pointer", textAlign: "left" }}
          type="button"
        >
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}><CIcon name="arrowUR" size={16} /></div>
            <span className="kpi-label">Despesas no período</span>
          </div>
          <div className="kpi-val" style={{ color: "var(--neg)" }}>
            <span className="cur">R$</span>
            {num(expenses)}
          </div>
          <div className="kpi-sub">saídas no período</div>
        </button>

        <button
          className="kpi"
          onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, label: "Fluxo líquido", periodPreset: period.periodPreset })}
          style={{ cursor: "pointer", textAlign: "left" }}
          type="button"
        >
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: netFlow >= 0 ? "var(--acc-soft)" : "var(--neg-soft)", color: netFlow >= 0 ? "var(--acc)" : "var(--neg)" }}>
              <CIcon name="flow" size={16} />
            </div>
            <span className="kpi-label">Fluxo líquido</span>
          </div>
          <div className="kpi-val" style={{ color: netFlow >= 0 ? "var(--acc-ink)" : "var(--neg)" }}>
            {money(netFlow)}
          </div>
          <div className="kpi-sub">sobrou neste período</div>
        </button>

        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: "var(--info-soft)", color: "var(--info)" }}><CIcon name="wallet" size={16} /></div>
            <span className="kpi-label">Saldo acumulado</span>
          </div>
          <div className="kpi-val">
            <span className="cur">R$</span>
            {num(currentBalance ?? netFlow)}
          </div>
          <div className="kpi-sub">
            {currentBalance != null ? "saldo integrado" : "estimado do fluxo"}
          </div>
        </div>
      </div>

      {/* AnswerCard */}
      <AnswerCard income={income} expenses={expenses} netFlow={netFlow} />

      {/* SankeyPanel — a jornada do dinheiro */}
      <SankeyPanel
        categories={categoryItems}
        subcategories={subcategoryItems}
        incomeSubcategories={incomeSubcategoryRanking.data?.items ?? []}
        totalIncome={income}
        onNav={onNavigate}
      />

      {/* Tendência mensal + composição */}
      <div className="dash-main" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <span className="ttl">Tendência mensal</span>
              <div className="sub">Receitas, despesas e fluxo líquido · 12 meses</div>
            </div>
            <div className="spacer" />
            <div className="seg">
              <button className={view === "mes" ? "on" : ""} onClick={() => setView("mes")} type="button">
                Receitas × Despesas
              </button>
              <button className={view === "liq" ? "on" : ""} onClick={() => setView("liq")} type="button">
                Fluxo líquido
              </button>
            </div>
            <div className="seg" style={{ marginLeft: 8 }}>
              <button className={chartMode === "month" ? "on" : ""} onClick={() => setChartMode("month")} type="button">Mês</button>
              <button className={chartMode === "day" ? "on" : ""} onClick={() => setChartMode("day")} type="button">Dia</button>
            </div>
          </div>
          <div className="card-body" style={{ height: 260, paddingBottom: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              {view === "mes" ? (
                <ComposedChart
                  data={chartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  onClick={openChartTransactions}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="cfPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--pos)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cfNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.02} />
                      <stop offset="100%" stopColor="var(--neg)" stopOpacity={0.22} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <ReferenceLine y={0} stroke="var(--ink-faint)" strokeWidth={1} />
                  <Area dataKey="balPos" fill="url(#cfPos)" stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />
                  <Area dataKey="balNeg" fill="url(#cfNeg)" stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />
                  <XAxis
                    dataKey={chartMode === "month" ? "month" : "date"}
                    tickFormatter={chartMode === "month" ? monthTickLabel : dayTickLabel}
                    tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--ink-3)" }}
                  />
                  <YAxis
                    tickFormatter={compactMoneyAxis}
                    tickLine={false} axisLine={false} width={60}
                    tick={{ fontSize: 11, fill: "var(--ink-3)" }}
                    domain={chartAxisDomain}
                  />
                  <Tooltip content={<CashflowTooltip view={chartMode} />} wrapperStyle={{ zIndex: 30, pointerEvents: "none" }} />
                  <Bar dataKey="income" name="Receitas" fill="var(--acc)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="expenses" name="Saídas" fill="var(--neg)" stackId="out" radius={[0, 0, 4, 4]} isAnimationActive={false} />
                  {/* Invoice payment: amber bar in day mode only (cash basis). Not shown
                      in month mode (accrual line) to avoid looking like double spend. */}
                  {chartMode === "day" && (
                    <Bar dataKey="pay" name="Pagamento de fatura" fill="var(--warn)" stackId="out" radius={[0, 0, 4, 4]} isAnimationActive={false} />
                  )}
                  <Line dataKey="balance" name="Saldo" stroke="var(--info)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={chartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  onClick={openChartTransactions}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="cfPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--pos)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cfNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.02} />
                      <stop offset="100%" stopColor="var(--neg)" stopOpacity={0.28} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <ReferenceLine y={0} stroke="var(--ink-faint)" strokeWidth={1} />
                  <XAxis
                    dataKey={chartMode === "month" ? "month" : "date"}
                    tickFormatter={chartMode === "month" ? monthTickLabel : dayTickLabel}
                    tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--ink-3)" }}
                  />
                  <YAxis
                    tickFormatter={compactMoneyAxis}
                    tickLine={false} axisLine={false} width={60}
                    tick={{ fontSize: 11, fill: "var(--ink-3)" }}
                  />
                  <Tooltip content={<CashflowTooltip view={chartMode} />} wrapperStyle={{ zIndex: 30, pointerEvents: "none" }} />
                  <Area dataKey="netPos" fill="url(#cfPos)" stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />
                  <Area dataKey="netNeg" fill="url(#cfNeg)" stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />
                  <Line dataKey="netFlow" name="Fluxo líquido" stroke="var(--info)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="legend" style={{ padding: "0 20px 16px" }}>
            {view === "mes" ? (
              <>
                <span className="legend-item"><span className="lz" style={{ background: "var(--acc)" }} />Receitas</span>
                <span className="legend-item"><span className="lz" style={{ background: "var(--neg)" }} />Despesas</span>
                {chartMode === "day" && (
                  <span className="legend-item"><span className="lz" style={{ background: "var(--warn)" }} />Pagamento de fatura</span>
                )}
                <span className="legend-item"><span className="lz" style={{ background: "var(--info)" }} />Saldo acumulado</span>
              </>
            ) : (
              <span className="legend-item"><span className="lz" style={{ background: "var(--info)" }} />Fluxo líquido mensal</span>
            )}
          </div>
        </div>

        {/* Painel direito: Composição das despesas + Receitas recorrentes */}
        <div className="vstack" style={{ gap: 16, height: "100%" }}>
          <div className="card card-pad" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Composição das despesas</div>
            <SplitBar fixed={recurringFixed} variable={recurringVariable} />
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              <MiniStat dot="var(--info)" label="Fixas" value={recurringFixed} pct={fixedPct} />
              <MiniStat dot="var(--warn)" label="Variáveis" value={recurringVariable} pct={varPct} />
            </div>
          </div>
          <div className="card card-pad" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Receitas recorrentes</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {brl(income)}
              </span>
              <span className="muted" style={{ fontSize: 12.5 }}>/mês recebidos</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.5 }}>
              {recurringFixed > 0 && expenses > 0
                ? `${fixedPct}% das suas despesas são recorrentes — ${fixedPct >= 60 ? "alta previsibilidade" : "boa previsibilidade"}. Bom para planejar.`
                : "Categorize suas transações para ver a composição das despesas."}
            </p>
          </div>
        </div>
      </div>

      {/* Categorias de maior impacto · Recorrências relevantes · Porte */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <span className="ttl">Categorias de maior impacto</span>
              <div className="sub">Categoria → subcategoria · todas as transações</div>
            </div>
            <div className="spacer" />
            <span className="badge b-pos" style={{ fontSize: 10.5 }}>inclui cartão, débito, PIX e manuais</span>
          </div>
          <div className="card-body">
            <CatImpactAccordion
              items={categoryItems}
              subcategoryItems={subcategoryItems}
              loading={ranking.isLoading}
              onOpenCategory={openCategoryTransactions}
              onOpenTransactions={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset, label: "Todas as saídas" })}
              onManageCategories={() => onNavigate("categories")}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <span className="ttl">Recorrências relevantes</span>
              <div className="sub">Entradas e saídas previsíveis</div>
            </div>
            <div className="spacer" />
          </div>
          <div className="card-body">
            <RecorrenciasCard
              items={recurringItems}
              loading={recurring.isLoading}
              onOpen={(item) =>
                onOpenTransactions({
                  dateFrom: period.dateFrom,
                  dateTo: period.dateTo,
                  label: item.description,
                  periodPreset: period.periodPreset,
                  search: item.description,
                })
              }
            />
          </div>
        </div>

        <SpendingProfileDetailed session={session} query={period.query} />
      </div>
    </div>
  );
}
