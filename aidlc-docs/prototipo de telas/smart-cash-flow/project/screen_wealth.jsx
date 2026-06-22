/* SmartCashFlow — Patrimônio (visão de longo prazo) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  // ============ PATRIMÔNIO ============
  function Wealth({ onNav }) {
    const w = S.wealth;
    const totA = w.assets.reduce((s, a) => s + a.value, 0);
    const totL = w.liabilities.reduce((s, a) => s + a.value, 0);
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Crescimento', title: 'Patrimônio', icon: 'building',
        sub: 'Patrimônio líquido = Ativos − Passivos. Diferente do fluxo de caixa: aqui medimos riqueza acumulada, não movimento mensal.' }),

      React.createElement('div', { className: 'grid cols-3', style: { marginBottom: 16 } },
        React.createElement('div', { className: 'kpi', style: { background: 'linear-gradient(135deg,var(--acc-soft),var(--card))' } },
          React.createElement('div', { className: 'kpi-top' }, React.createElement('div', { className: 'kpi-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)', border: '1px solid var(--acc-soft-2)' } }, React.createElement(Icon, { name: 'building', size: 15 })), React.createElement('span', { className: 'kpi-label' }, 'Patrimônio líquido'), React.createElement('div', { style: { marginLeft: 'auto' } }, React.createElement(UI.Prov, { k: 'est', withLabel: false }))),
          React.createElement('div', { className: 'kpi-val', style: { fontSize: 30, color: 'var(--acc-ink)' } }, React.createElement('span', { className: 'cur' }, 'R$ '), S.num(w.net)),
          React.createElement('div', { className: 'kpi-sub' }, React.createElement(UI.Delta, { v: +2.1 }), 'no último mês')),
        React.createElement(UI.Kpi, { label: 'Total de ativos', value: S.num(totA), cur: 'R$', icon: 'plus', prov: 'est' }),
        React.createElement(UI.Kpi, { label: 'Total de passivos', value: S.num(totL), cur: 'R$', icon: 'minus', prov: 'real' })),

      React.createElement('div', { className: 'dash-main' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Evolução do patrimônio líquido', sub: '12 meses', icon: 'trend', prov: 'est' }),
          React.createElement('div', { className: 'card-body' },
            React.createElement(C.LineChart, { series: [{ label: 'Patrimônio líquido', color: 'var(--acc)', area: true, data: w.history.map((h, i) => ({ x: ['jul','','set','','nov','','jan','','mar','','mai',''][i], y: h.v })) }], height: 240, fmt: (v) => 'R$ ' + (v/1000).toFixed(0) + 'k' }))),
        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, null,
            React.createElement('div', { className: 'card-head', style: { paddingBottom: 11 } }, React.createElement('span', { className: 'ttl', style: { color: 'var(--acc)' } }, 'Ativos'), React.createElement('span', { className: 'spacer' }), React.createElement('span', { className: 'mono', style: { fontWeight: 700 } }, BRL(totA))),
            React.createElement('div', { style: { padding: '4px 8px 8px' } }, w.assets.map((a, i) => React.createElement(WRow, { key: i, item: a })))),
          React.createElement(UI.Card, null,
            React.createElement('div', { className: 'card-head', style: { paddingBottom: 11 } }, React.createElement('span', { className: 'ttl', style: { color: 'var(--neg)' } }, 'Passivos'), React.createElement('span', { className: 'spacer' }), React.createElement('span', { className: 'mono', style: { fontWeight: 700 } }, BRL(totL))),
            React.createElement('div', { style: { padding: '4px 8px 8px' } }, w.liabilities.map((a, i) => React.createElement(WRow, { key: i, item: a, neg: true })))))));
  }

  function WRow({ item, neg }) {
    return React.createElement('div', { className: 'row-item', style: { padding: '9px 10px' } },
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink)' } }, item.label),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 } },
          React.createElement('span', { className: 't-sub' }, item.sub), React.createElement(UI.Prov, { k: item.prov, withLabel: false }))),
      React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: neg ? 'var(--neg)' : 'var(--ink)' } }, BRL(item.value)));
  }

  window.Screens = window.Screens || {};
  window.Screens.wealth = Wealth;
})();
