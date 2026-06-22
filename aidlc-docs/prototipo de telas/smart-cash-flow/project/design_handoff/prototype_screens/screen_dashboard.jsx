/* SmartCashFlow — Dashboard / Cockpit (prioridade 1) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  // ---- "A história do seu dinheiro" strip ----
  function StoryStrip() {
    const e = S.exec;
    const steps = [
      { label: 'Entrou', value: e.entrou, icon: 'arrowDR', tone: 'pos', prov: 'real' },
      { label: 'Saiu', value: -e.saiu, icon: 'arrowUR', tone: 'neg', prov: 'real' },
      { label: 'Sobrou', value: e.sobrou, icon: 'wallet', tone: 'pos', prov: 'real', strong: true },
      { label: 'Compromissos a vencer', value: -e.compromissos, icon: 'clock', tone: 'neg', prov: 'est' },
      { label: 'Saldo previsto', value: e.saldoPrev, icon: 'trend', tone: 'acc', prov: 'est', strong: true },
    ];
    return React.createElement(UI.Card, { className: 'story', pad: '4px' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'stretch' } },
        steps.map((s, i) => {
          const notLast = i + 1 !== steps.length;
          return React.createElement(React.Fragment, { key: i },
          React.createElement('div', { className: 'story-step' + (s.strong ? ' strong' : '') },
            React.createElement('div', { className: 'story-lab' },
              React.createElement('span', { className: 'story-ic ' + s.tone }, React.createElement(Icon, { name: s.icon, size: 14 })),
              s.label),
            React.createElement('div', { className: 'story-val', style: { color: s.tone === 'neg' ? 'var(--neg)' : s.tone === 'acc' ? 'var(--acc-ink)' : 'var(--ink)' } },
              BRL(s.value, { sign: s.value > 0 && s.tone !== 'acc' })),
            React.createElement(UI.Prov, { k: s.prov, withLabel: false })),
          notLast ? React.createElement('div', { className: 'story-arrow' }, React.createElement(Icon, { name: 'chevR', size: 18 })) : null);
        })));
  }

  // ---- KPI deck ----
  function KpiDeck() {
    const k = S.kpis;
    const tiles = [
      { ...k.saldoAtual, value: S.num(k.saldoAtual.val), icon: 'wallet', cur: 'R$', spark: [22,21,23,24,23,24.8], sub: 'estimado do fluxo' },
      { ...k.receitas, value: S.num(k.receitas.val), icon: 'arrowDR', cur: 'R$', delta: k.receitas.delta, spark: [17,17.6,18,18.2,18.25,18.42] },
      { ...k.despesas, value: S.num(k.despesas.val), icon: 'arrowUR', cur: 'R$', delta: k.despesas.delta, deltaInvert: true, spark: [12.4,11.9,13.9,12.7,12.2,13.18] },
      { ...k.fluxoLiquido, value: S.num(k.fluxoLiquido.val), icon: 'flow', cur: 'R$', delta: k.fluxoLiquido.delta, spark: [4.8,5.7,4.3,5.6,6,5.24] },
      { ...k.savingRate, value: S.num(k.savingRate.val, 1), icon: 'pie', cur: null, unit: '%', delta: k.savingRate.delta },
      { ...k.burnRate, value: S.num(k.burnRate.val), icon: 'zap', cur: 'R$', hint: k.burnRate.hint },
      { ...k.runway, value: S.num(k.runway.val, 1), icon: 'shield', cur: null, unit: ' meses', hint: k.runway.hint },
      { ...k.safeSpend, value: S.num(k.safeSpend.val), icon: 'check', cur: 'R$', hint: k.safeSpend.hint },
      { ...k.commitment, value: S.num(k.commitment.val), icon: 'lock', cur: null, unit: '%', hint: k.commitment.hint },
      { ...k.dataQuality, value: S.num(k.dataQuality.val), icon: 'db', cur: null, unit: '%' },
    ];
    return React.createElement('div', { className: 'kpi-deck' },
      tiles.map((t, i) => React.createElement(UI.Kpi, { key: i, label: t.label, value: t.value, cur: t.cur, unit: t.unit, icon: t.icon, prov: t.prov, delta: t.delta, deltaInvert: t.deltaInvert, sub: t.sub, hint: t.hint, spark: t.spark })));
  }

  // ---- Main flow chart ----
  function FlowCard() {
    const [mode, setMode] = useState('day');
    const data = mode === 'day' ? S.daily : S.monthly.map(m => ({ d: m.m, m: m.m, inc: m.inc, exp: -m.exp, acc: m.inc - m.exp + 19000, proj: m.current }));
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, {
        title: 'A história do seu dinheiro', sub: 'Entradas, saídas e saldo acumulado · Junho 2026', icon: 'bars',
        right: React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          React.createElement(UI.Tabs, { value: mode, onChange: setMode, tabs: [{ id: 'day', label: 'Dia' }, { id: 'month', label: 'Mês' }] }))
      }),
      React.createElement('div', { className: 'card-body' },
        React.createElement(C.FlowChart, { data, mode }),
        React.createElement('div', { className: 'legend', style: { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' } },
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz', style: { background: 'var(--acc)', height: 8, width: 8, borderRadius: 2 } }), 'Receitas'),
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz', style: { background: 'var(--neg)', height: 8, width: 8, borderRadius: 2 } }), 'Despesas'),
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz', style: { background: 'var(--acc-strong)' } }), 'Saldo acumulado'),
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz dash', style: { borderColor: 'var(--acc-strong)' } }), 'Saldo projetado'),
          React.createElement('span', { className: 'legend-item', style: { marginLeft: 'auto' } }, React.createElement(Icon, { name: 'info', size: 13 }), 'Pagamentos de fatura não entram como despesa comum'))));
  }

  // ---- Health score panel ----
  function HealthCard() {
    const score = S.kpis.healthScore.val;
    const factors = [
      { label: 'Saving rate', val: 84, note: '28,4%' },
      { label: 'Comprometimento', val: 59, note: '41%' },
      { label: 'Runway', val: 72, note: '5,4 meses' },
      { label: 'Qualidade dos dados', val: 86, note: '86%' },
    ];
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement('div', { style: { display: 'flex', gap: 16, alignItems: 'center' } },
        React.createElement(C.Ring, { value: score, size: 96, thickness: 9, color: 'var(--acc)' },
          React.createElement('div', null,
            React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, lineHeight: 1 } }, score),
            React.createElement('div', { style: { fontSize: 9.5, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', letterSpacing: .5 } }, '/100'))),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 } },
            React.createElement('span', { className: 'section-title', style: { fontSize: 15 } }, 'Saúde financeira'),
            React.createElement(UI.Prov, { k: 'est', withLabel: false })),
          React.createElement('div', { className: 'section-sub' }, 'Boa — com espaço para evoluir. Reduzir o comprometimento elevaria o score.'))),
      React.createElement('div', { style: { marginTop: 16, display: 'grid', gap: 10 } },
        factors.map((f, i) => React.createElement('div', { key: i },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 } },
            React.createElement('span', { style: { color: 'var(--ink-2)', fontWeight: 600 } }, f.label),
            React.createElement('span', { className: 'mono', style: { color: 'var(--ink-3)' } }, f.note)),
          React.createElement(UI.Bar, { value: f.val, max: 100, status: f.val < 60 ? 'warn' : 'ok' })))));
  }

  // ---- Priority insight ----
  function PriorityAlert({ onNav }) {
    return React.createElement(UI.Alert, {
      type: 'warn', icon: 'alert', title: 'Atenção: semana de 10–12 de junho concentra R$ 6.400 em compromissos',
      action: React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('calendar') }, React.createElement(Icon, { name: 'calendar', size: 14 }), 'Ver no calendário'),
        React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('planning') }, 'Ver projeção')),
    }, 'O financiamento (dia 10) e a fatura do Nubank (dia 12) caem antes do próximo salário (dia 15). Seu saldo previsto chega ao menor ponto do mês: ', React.createElement('b', null, 'R$ 18.120'), '. Há folga, mas evite grandes compras nessa janela.');
  }

  // ---- Top categories (expansível → subcategorias, como no Fluxo de Caixa) ----
  function TopCats({ onNav }) {
    const [open, setOpen] = useState({});
    // agrupa subcategorias por categoria — somente despesas, todas as origens
    const subByCat = {};
    S.transactions.forEach(t => {
      if (t.dir !== 'out') return;
      if (!subByCat[t.cat]) subByCat[t.cat] = {};
      const k = t.sub || 'Sem subcategoria';
      if (!subByCat[t.cat][k]) subByCat[t.cat][k] = { sub: k, value: 0, count: 0 };
      subByCat[t.cat][k].value += Math.abs(t.value);
      subByCat[t.cat][k].count += 1;
    });
    const top = S.topCats.filter(c => c.key !== 'renda').slice(0, 6);
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Top categorias', sub: 'Onde o dinheiro foi este mês · clique para ver subcategorias', icon: 'pie', prov: 'real',
        right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('cashflow') }, 'Detalhar', React.createElement(Icon, { name: 'chevR', size: 14 })) }),
      React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 8, paddingTop: 4 } },
        top.map((c, i) => {
          const cat = S.CATS[c.key];
          const subs = Object.values(subByCat[c.key] || {}).sort((a, b) => b.value - a.value);
          const isOpen = !!open[c.key];
          return React.createElement('div', { key: i, style: { border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' } },
            React.createElement('button', {
              onClick: () => setOpen(o => ({ ...o, [c.key]: !o[c.key] })),
              style: { display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', background: isOpen ? 'var(--card-2)' : 'transparent', transition: 'background .12s' }
            },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 } },
                React.createElement('span', { style: { color: 'var(--ink-faint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'grid' } },
                  React.createElement(Icon, { name: 'chevR', size: 12 })),
                React.createElement(UI.Cat, { k: c.key }),
                React.createElement('span', { style: { marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, BRL(c.value)),
                React.createElement('span', { className: 'mono faint', style: { fontSize: 11, width: 42, textAlign: 'right' } }, S.num(c.pct, 1) + '%'),
                c.delta !== 0 && React.createElement('span', { style: { width: 50, textAlign: 'right' } }, React.createElement(UI.Delta, { v: c.delta, invert: true }))),
              React.createElement('div', { className: 'track thin' }, React.createElement('div', { className: 'fill', style: { width: c.pct * 2.4 + '%', background: cat.color } }))),
            isOpen && React.createElement('div', { style: { borderTop: '1px solid var(--line)', padding: '4px 11px 9px 28px' } },
              subs.length === 0
                ? React.createElement('div', { style: { padding: '8px 0', fontSize: 12, color: 'var(--ink-3)' } }, 'Sem lançamentos nesta categoria no período.')
                : subs.map((s, j) => {
                  const spct = (s.value / c.value) * 100;
                  return React.createElement('div', { key: j, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: j < subs.length - 1 ? '1px dashed var(--line)' : 'none' } },
                    React.createElement('span', { className: 'catdot', style: { background: cat.color, width: 7, height: 7, flex: 'none' } }),
                    React.createElement('span', { style: { fontWeight: 600, fontSize: 12, minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.sub),
                    React.createElement('span', { className: 'mono faint', style: { fontSize: 10.5, flex: 'none' } }, s.count, ' lanç.'),
                    React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12, minWidth: 74, textAlign: 'right' } }, BRL(s.value)),
                    React.createElement('span', { className: 'mono faint', style: { fontSize: 10.5, width: 34, textAlign: 'right' } }, S.num(spct, 0) + '%'));
                }),
              React.createElement('button', { className: 'btn btn-quiet btn-sm', style: { marginTop: 8 }, onClick: () => onNav('cashflow') }, 'Ver no fluxo de caixa', React.createElement(Icon, { name: 'chevR', size: 12 }))));
        })));
  }

  // ---- Upcoming commitments ----
  function Upcoming({ onNav }) {
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Próximos compromissos', sub: 'Vencimentos do mês', icon: 'clock',
        right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('calendar') }, 'Calendário', React.createElement(Icon, { name: 'chevR', size: 14 })) }),
      React.createElement('div', { style: { padding: '6px 8px' } },
        S.upcoming.slice(0, 6).map((u, i) => React.createElement('div', { key: i, className: 'row-item' },
          React.createElement('div', { className: 'date-chip' },
            React.createElement('span', { className: 'd' }, u.day), React.createElement('span', { className: 'm' }, u.month)),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { className: 't-desc', style: { fontSize: 13 } }, u.title),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 } },
              React.createElement('span', { className: 't-sub' }, u.kind),
              React.createElement('span', { className: 'sdot ' + u.status }),
              React.createElement('span', { className: 't-sub' }, u.status === 'pred' ? 'previsto' : u.status === 'est' ? 'estimado' : 'pago'))),
          React.createElement('div', { style: { fontWeight: 700, color: 'var(--neg)', fontVariantNumeric: 'tabular-nums', fontSize: 13.5 } }, BRL(u.value))))));
  }

  // ---- Cards mini ----
  function CardsMini({ onNav }) {
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Cartões de crédito', sub: 'Faturas e limites', icon: 'card', prov: 'real',
        right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('cards') }, 'Gerenciar', React.createElement(Icon, { name: 'chevR', size: 14 })) }),
      React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 14 } },
        S.cards.map((c, i) => React.createElement('div', { key: i },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 } },
            React.createElement('span', { style: { width: 26, height: 18, borderRadius: 4, background: c.color, flex: 'none' } }),
            React.createElement('span', { style: { fontWeight: 700, fontSize: 13 } }, c.name),
            React.createElement('span', { className: 'mono faint', style: { fontSize: 11 } }, '•' + c.last),
            React.createElement('span', { style: { marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, BRL(c.invoice)),
            React.createElement('span', { className: 't-sub' }, 'vence ' + c.due + '/jun')),
          React.createElement('div', { className: 'track thin' }, React.createElement('div', { className: 'fill', style: { width: c.util + '%', background: c.util > 70 ? 'var(--warn)' : 'var(--acc)' } })),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 } },
            React.createElement('span', { className: 't-sub' }, c.util + '% do limite usado'),
            React.createElement('span', { className: 't-sub mono' }, BRL(c.limit - c.used) + ' livre'))))));
  }

  // ---- Goals mini ----
  function GoalsMini({ onNav }) {
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Metas em andamento', sub: 'Objetivos da família', icon: 'flag',
        right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('goals') }, 'Ver metas', React.createElement(Icon, { name: 'chevR', size: 14 })) }),
      React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 13 } },
        S.goals.slice(0, 3).map((g, i) => {
          const pct = (g.current / g.target) * 100;
          return React.createElement('div', { key: i },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 } },
              React.createElement('span', { className: 'goal-ic', style: { background: S.CATS[g.cat].color + '22', color: S.CATS[g.cat].color } }, React.createElement(Icon, { name: g.icon, size: 15 })),
              React.createElement('span', { style: { fontWeight: 600, fontSize: 13 } }, g.title),
              React.createElement('span', { style: { marginLeft: 'auto' }, className: 'mono faint' }, S.num(pct, 0) + '%')),
            React.createElement(UI.Bar, { value: g.current, max: g.target, status: g.status === 'late' ? 'warn' : 'ok' }),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 } },
              React.createElement('span', { className: 't-sub mono' }, BRL(g.current) + ' / ' + BRL(g.target)),
              React.createElement('span', { className: 't-sub' }, g.deadline)));
        })));
  }

  // ---- Budget mini ----
  function BudgetMini({ onNav }) {
    const totPlanned = S.budgets.reduce((s, b) => s + b.planned, 0);
    const totActual = S.budgets.reduce((s, b) => s + b.actual, 0);
    const pct = (totActual / totPlanned) * 100;
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
        React.createElement('div', { className: 'kpi-ic', style: { width: 28, height: 28 } }, React.createElement(Icon, { name: 'target', size: 15 })),
        React.createElement('div', null,
          React.createElement('div', { className: 'card-head', style: { padding: 0, border: 'none' } }, React.createElement('span', { className: 'ttl' }, 'Orçamento do mês')),
          React.createElement('div', { className: 'sub', style: { fontSize: 11.5, color: 'var(--ink-3)' } }, 'Planejado vs. realizado')),
        React.createElement('button', { className: 'btn btn-quiet btn-sm', style: { marginLeft: 'auto' }, onClick: () => onNav('budgets') }, 'Abrir', React.createElement(Icon, { name: 'chevR', size: 14 }))),
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 } },
        React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, BRL(totActual)),
        React.createElement('span', { className: 'muted', style: { fontSize: 13 } }, 'de ' + BRL(totPlanned))),
      React.createElement(UI.Bar, { value: totActual, max: totPlanned, status: pct > 100 ? 'over' : pct > 90 ? 'warn' : 'ok' }),
      React.createElement('div', { style: { display: 'flex', gap: 14, marginTop: 12 } },
        S.budgets.slice(0, 4).map((b, i) => {
          const p = (b.actual / b.planned) * 100;
          return React.createElement('div', { key: i, style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, S.CATS[b.key].label),
            React.createElement('div', { className: 'track thin' }, React.createElement('div', { className: 'fill', style: { width: Math.min(100, p) + '%', background: p > 100 ? 'var(--neg)' : p > 90 ? 'var(--warn)' : 'var(--acc)' } })),
            React.createElement('div', { className: 'mono', style: { fontSize: 10, color: 'var(--ink-faint)', marginTop: 3 } }, S.num(p, 0) + '%'));
        })));
  }

  // ---- Tip + data quality ----
  function TipCard({ onNav }) {
    return React.createElement(UI.Card, { className: 'card-pad', style: { background: 'linear-gradient(135deg, var(--acc-soft), var(--card))' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
        React.createElement('span', { className: 'goal-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)', border: '1px solid var(--acc-soft-2)' } }, React.createElement(Icon, { name: 'sparkles', size: 15 })),
        React.createElement('span', { className: 'eyebrow', style: { color: 'var(--acc-ink)' } }, 'Dica personalizada'),
        React.createElement(UI.Prov, { k: 'est', withLabel: false })),
      React.createElement('div', { style: { fontSize: 14, lineHeight: 1.55, color: 'var(--ink)', fontWeight: 500 } },
        'Você economizou ', React.createElement('b', null, 'R$ 1.640 acima da sua meta'), ' este mês. Direcionar esse valor para a reserva de emergência elevaria seu runway para ', React.createElement('b', null, '5,8 meses'), '.'),
      React.createElement('button', { className: 'btn btn-primary btn-sm', style: { marginTop: 12 }, onClick: () => onNav('goals') }, 'Direcionar para metas'));
  }

  function DataQuality({ onNav }) {
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
        React.createElement(C.Ring, { value: 86, size: 56, thickness: 6, color: 'var(--acc)' },
          React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 } }, '86%')),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, 'Qualidade dos dados'),
          React.createElement('div', { className: 't-sub' }, '3 transações pendentes de categoria'))),
      React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.5 } },
        'Categorize as transações pendentes para elevar a precisão dos seus indicadores para ~94%.'),
      React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('transactions') }, React.createElement(Icon, { name: 'check', size: 14 }), 'Revisar pendências'));
  }

  function SankeyMini({ onNav }) {
    const data = window.Charts.buildSankeyData({ withSubs: false });
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, {
        title: 'De onde veio · para onde foi', sub: 'Renda → categorias e sobra · todas as origens', icon: 'flow', prov: 'real',
        right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('cashflow') },
          'Visão completa', React.createElement(Icon, { name: 'chevR', size: 14 }))
      }),
      React.createElement('div', { className: 'card-body', style: { padding: '8px 12px 12px' } },
        React.createElement(window.Charts.Sankey, {
          columns: data.columns, links: data.links,
          height: 320, compact: true, gap: 5, padTopBot: 12,
        }),
        React.createElement('div', { style: { display: 'flex', gap: 18, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11.5 } },
          React.createElement('span', { className: 'mono', style: { color: 'var(--ink-3)' } },
            'Entrou ', React.createElement('b', { style: { color: 'var(--acc-ink)' } }, BRL(data.totals.income))),
          React.createElement('span', { className: 'mono', style: { color: 'var(--ink-3)' } },
            'Saiu ', React.createElement('b', { style: { color: 'var(--neg)' } }, BRL(data.totals.expense))),
          React.createElement('span', { className: 'mono', style: { color: 'var(--ink-3)' } },
            'Sobrou ', React.createElement('b', { style: { color: 'var(--pos)' } }, BRL(data.totals.sobra))),
          React.createElement('span', { style: { marginLeft: 'auto', color: 'var(--ink-faint)', fontSize: 11 } },
            'A largura de cada fita é proporcional ao valor em R$'))));
  }

  function Dashboard({ onNav }) {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 18 } },
        React.createElement('div', null,
          React.createElement('h1', { style: { margin: 0, fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-.4px' } }, greet + ', Marcos'),
          React.createElement('p', { style: { margin: '4px 0 0', color: 'var(--ink-3)', fontSize: 13.5 } }, 'Aqui está a situação da Família Andrade em ', React.createElement('b', { style: { color: 'var(--ink-2)' } }, 'Junho de 2026'), '. Tudo sob controle.')),
        React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
          React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('reports') }, React.createElement(Icon, { name: 'report', size: 14 }), 'Relatório'),
          React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('copilot') }, React.createElement(Icon, { name: 'chat', size: 14 }), 'Perguntar ao Copilot'))),
      React.createElement(StoryStrip, null),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement(KpiDeck, null),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement(PriorityAlert, { onNav }),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement('div', { className: 'dash-main' },
        React.createElement(FlowCard, null),
        React.createElement(HealthCard, null)),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement('div', { className: 'grid cols-3' },
        React.createElement(TopCats, { onNav }),
        React.createElement(Upcoming, { onNav }),
        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(CardsMini, { onNav }),
          React.createElement(DataQuality, { onNav }))),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement(SankeyMini, { onNav }),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement('div', { className: 'grid cols-3' },
        React.createElement(BudgetMini, { onNav }),
        React.createElement(GoalsMini, { onNav }),
        React.createElement(TipCard, { onNav })));
  }

  window.Screens = window.Screens || {};
  window.Screens.dashboard = Dashboard;
})();
