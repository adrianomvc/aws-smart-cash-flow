/* SmartCashFlow — Fluxo de Caixa (prioridade 4) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  function CashFlow({ onNav }) {
    const [view, setView] = useState('mes');
    const fixed = 8100, variable = 4900, recurring = 16820;

    // monthly trend series
    const trend = [
      { label: 'Receitas', color: 'var(--acc)', area: true, data: S.monthly.map(m => ({ x: m.m.toLowerCase(), y: m.inc })) },
      { label: 'Despesas', color: 'var(--neg)', data: S.monthly.map(m => ({ x: m.m.toLowerCase(), y: m.exp })) },
    ];
    const netSeries = [{ label: 'Fluxo líquido', color: 'var(--info)', area: true, data: S.monthly.map(m => ({ x: m.m.toLowerCase(), y: m.inc - m.exp })) }];

    const recurrences = [
      { desc: 'Salário — Marcos', cat: 'renda', value: 8200, freq: 'Mensal', dir: 'in' },
      { desc: 'Aluguel recebido — Kitnet', cat: 'renda', value: 1400, freq: 'Mensal', dir: 'in' },
      { desc: 'Financiamento do imóvel', cat: 'moradia', value: -2980, freq: 'Mensal', dir: 'out' },
      { desc: 'Mensalidade escolar', cat: 'educacao', value: -1900, freq: 'Mensal', dir: 'out' },
      { desc: 'Plano de saúde', cat: 'saude', value: -680, freq: 'Mensal', dir: 'out' },
      { desc: 'Assinaturas (4)', cat: 'assinaturas', value: -212, freq: 'Mensal', dir: 'out' },
    ];

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Visão', title: 'Fluxo de Caixa', icon: 'flow',
        sub: 'Por que sobrou ou faltou dinheiro neste período? Entradas, saídas e o saldo acumulado em detalhe.',
        right: React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('reports') }, React.createElement(Icon, { name: 'download', size: 14 }), 'Exportar') }),

      // summary KPIs
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Receitas no período', value: S.num(18420), cur: 'R$', icon: 'arrowDR', prov: 'real', delta: +4.2 }),
        React.createElement(UI.Kpi, { label: 'Despesas no período', value: S.num(13180), cur: 'R$', icon: 'arrowUR', prov: 'real', delta: +7.8, deltaInvert: true }),
        React.createElement(UI.Kpi, { label: 'Fluxo líquido', value: S.num(5240), cur: 'R$', icon: 'flow', prov: 'real', sub: 'sobrou este mês' }),
        React.createElement(UI.Kpi, { label: 'Saldo acumulado', value: S.num(24640), cur: 'R$', icon: 'wallet', prov: 'est', hint: 'Estimado a partir do fluxo importado.' })),

      // answer card — why
      React.createElement(UI.Card, { className: 'card-pad', style: { marginBottom: 16, background: 'linear-gradient(135deg,var(--acc-soft),var(--card) 55%)' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          React.createElement('span', { className: 'goal-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)', border: '1px solid var(--acc-soft-2)' } }, React.createElement(Icon, { name: 'info', size: 15 })),
          React.createElement('span', { className: 'eyebrow', style: { color: 'var(--acc-ink)' } }, 'Por que você fechou no positivo'),
          React.createElement(UI.Prov, { k: 'real', withLabel: false })),
        React.createElement('div', { style: { fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' } },
          'Suas receitas (', React.createElement('b', null, 'R$ 18.420'), ') superaram as despesas (', React.createElement('b', null, 'R$ 13.180'), ') em ', React.createElement('b', { style: { color: 'var(--acc-ink)' } }, 'R$ 5.240'), '. O principal motivo foi o ',
          React.createElement('b', null, 'aluguel recebido (+R$ 1.400)'), ' somado à contenção em transporte. O ponto de atenção foi ', React.createElement('b', null, 'alimentação, 12,5% acima da média'), '.')),

      // sankey: jornada completa do dinheiro
      React.createElement(SankeyPanel, { onNav }),

      React.createElement('div', { style: { height: 16 } }),

      // trend chart + composition
      React.createElement('div', { className: 'dash-main' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Tendência mensal', sub: 'Receitas, despesas e fluxo líquido · 12 meses', icon: 'bars', prov: 'real',
            right: React.createElement(UI.Tabs, { value: view, onChange: setView, tabs: [{ id: 'mes', label: 'Receitas x Despesas' }, { id: 'liq', label: 'Fluxo líquido' }] }) }),
          React.createElement('div', { className: 'card-body' },
            React.createElement(C.LineChart, { series: view === 'mes' ? trend : netSeries, height: 260 }),
            React.createElement('div', { className: 'legend', style: { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' } },
              (view === 'mes' ? trend : netSeries).map((s, i) => React.createElement('span', { key: i, className: 'legend-item' }, React.createElement('span', { className: 'lz', style: { background: s.color } }), s.label))))),

        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 12 } }, 'Composição das despesas'),
            React.createElement(SplitBar, { fixed, variable }),
            React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 14 } },
              React.createElement(MiniStat, { dot: 'var(--info)', label: 'Fixas', value: fixed, pct: 62 }),
              React.createElement(MiniStat, { dot: 'var(--warn)', label: 'Variáveis', value: variable, pct: 38 }))),
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 6 } }, 'Receitas recorrentes'),
            React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
              React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, BRL(recurring)),
              React.createElement('span', { className: 'muted', style: { fontSize: 12.5 } }, '/mês previsíveis')),
            React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.5 } }, '91% da sua receita é recorrente — alta previsibilidade. Bom para planejar.'))) ),

      React.createElement('div', { style: { height: 16 } }),

      // categories impact + recurrences with drill-down
      React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '1fr 1fr' } },
        React.createElement(CatImpact, { onNav }),

        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Recorrências relevantes', sub: 'Entradas e saídas previsíveis', icon: 'repeat', prov: 'real' }),
          React.createElement('div', { style: { padding: '6px 8px' } },
            recurrences.map((r, i) => React.createElement('div', { key: i, className: 'row-item' },
              React.createElement('span', { className: 'goal-ic', style: { background: S.CATS[r.cat].color + '1e', color: S.CATS[r.cat].color } }, React.createElement(Icon, { name: 'repeat', size: 14 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { className: 't-desc', style: { fontSize: 13 } }, r.desc),
                React.createElement('div', { className: 't-sub' }, r.freq + ' · ' + S.CATS[r.cat].label)),
              React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.dir === 'in' ? 'var(--acc)' : 'var(--neg)' } }, BRL(r.value, { sign: r.dir === 'in' }))))))));
  }

  function SankeyPanel({ onNav }) {
    const [withSubs, setWithSubs] = useState(true);
    const data = window.Charts.buildSankeyData({ withSubs });
    return React.createElement(UI.Card, { style: { marginBottom: 16 } },
      React.createElement(UI.CardHead, {
        title: 'A jornada do seu dinheiro', sub: 'Fontes de receita → categorias' + (withSubs ? ' → subcategorias' : ' e sobra') + ' · todas as transações', icon: 'flow', prov: 'real',
        right: React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
          React.createElement(UI.Tabs, {
            value: withSubs ? 'sub' : 'cat', onChange: v => setWithSubs(v === 'sub'),
            tabs: [{ id: 'cat', label: 'Categorias' }, { id: 'sub', label: 'Subcategorias' }],
          }),
          React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('reports') },
            React.createElement(Icon, { name: 'download', size: 13 }), 'Exportar'))
      }),
      React.createElement('div', { className: 'card-body', style: { padding: '14px 16px 18px' } },
        React.createElement(window.Charts.Sankey, {
          columns: data.columns, links: data.links,
          height: withSubs ? 560 : 440, gap: 5, padTopBot: 18,
          onClickNode: (n) => { if (n.kind === 'expense' || n.kind === 'sub') onNav('categories'); },
        }),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' } },
          React.createElement(SankeyStat, { label: 'Entradas', value: data.totals.income, sub: data.totals.sources + ' fontes', tone: 'pos' }),
          React.createElement(SankeyStat, { label: 'Saídas', value: data.totals.expense, sub: data.totals.categories + ' categorias', tone: 'neg' }),
          React.createElement(SankeyStat, { label: 'Sobrou', value: data.totals.sobra, sub: S.num(data.totals.sobra / data.totals.income * 100, 1) + '% da renda', tone: 'acc' }),
          React.createElement(SankeyStat, { label: 'Detalhe', value: data.totals.subs, sub: 'subcategorias usadas', tone: 'neutral', numeric: true }))));
  }

  function SankeyStat({ label, value, sub, tone, numeric }) {
    const color = tone === 'pos' ? 'var(--acc-ink)' : tone === 'neg' ? 'var(--neg)' : tone === 'acc' ? 'var(--pos)' : 'var(--ink)';
    return React.createElement('div', { style: { padding: '6px 0' } },
      React.createElement('div', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: .3, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' } }, label),
      React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' } },
        numeric ? value : 'R$ ' + S.num(value)),
      React.createElement('div', { className: 't-sub', style: { marginTop: 2 } }, sub));
  }

  function CatImpact({ onNav }) {
    const [open, setOpen] = useState({});
    // agrupa subcategorias por categoria, somente despesas, TODAS as origens (cartão + débito + manual)
    const subByCat = {};
    S.transactions.forEach(t => {
      if (t.dir !== 'out') return;
      if (!subByCat[t.cat]) subByCat[t.cat] = {};
      const k = t.sub || 'Sem subcategoria';
      if (!subByCat[t.cat][k]) subByCat[t.cat][k] = { sub: k, value: 0, count: 0, accs: new Set() };
      subByCat[t.cat][k].value += Math.abs(t.value);
      subByCat[t.cat][k].count += 1;
      subByCat[t.cat][k].accs.add(t.acc);
    });
    const list = S.topCats.filter(c => c.key !== 'renda').slice(0, 7);

    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, {
        title: 'Categorias de maior impacto', sub: 'Categoria → subcategoria · todas as transações', icon: 'pie', prov: 'real',
        right: React.createElement('span', { className: 'badge b-pos', style: { fontSize: 10.5 } }, 'inclui cartão, débito, PIX e manuais')
      }),
      React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 10, paddingTop: 4 } },
        list.map((c, i) => {
          const subs = Object.values(subByCat[c.key] || {}).sort((a, b) => b.value - a.value);
          const isOpen = !!open[c.key];
          return React.createElement('div', { key: i, style: { border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' } },
            React.createElement('button', {
              onClick: () => setOpen(o => ({ ...o, [c.key]: !o[c.key] })),
              style: { display: 'block', width: '100%', textAlign: 'left', padding: '11px 12px', background: isOpen ? 'var(--card-2)' : 'transparent', transition: 'background .12s' }
            },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                React.createElement('span', { style: { color: 'var(--ink-faint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'grid' } },
                  React.createElement(Icon, { name: 'chevR', size: 13 })),
                React.createElement(UI.Cat, { k: c.key }),
                React.createElement('span', { className: 'mono faint', style: { fontSize: 11 } }, subs.length, ' subcat. · ', subs.reduce((a, b) => a + b.count, 0), ' lanç.'),
                React.createElement('span', { style: { marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, BRL(c.value)),
                React.createElement('span', { className: 'mono faint', style: { fontSize: 11, width: 44, textAlign: 'right' } }, S.num(c.pct, 1) + '%')),
              React.createElement('div', { className: 'track thin' }, React.createElement('div', { className: 'fill', style: { width: c.pct * 2.4 + '%', background: S.CATS[c.key].color } }))),
            isOpen && React.createElement('div', { style: { borderTop: '1px solid var(--line)', padding: '4px 12px 10px 30px' } },
              subs.length === 0
                ? React.createElement('div', { style: { padding: '10px 0', fontSize: 12, color: 'var(--ink-3)' } }, 'Sem lançamentos nesta categoria no período.')
                : subs.map((s, j) => {
                  const spct = (s.value / c.value) * 100;
                  return React.createElement('div', { key: j, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: j < subs.length - 1 ? '1px dashed var(--line)' : 'none' } },
                    React.createElement('span', { className: 'catdot', style: { background: S.CATS[c.key].color, width: 7, height: 7 } }),
                    React.createElement('span', { style: { fontWeight: 600, fontSize: 12.5, minWidth: 0, flex: '0 0 160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.sub),
                    React.createElement('span', { className: 't-sub', style: { fontSize: 11, flex: '0 0 90px' } }, [...s.accs].slice(0, 2).join(' · ')),
                    React.createElement('div', { style: { flex: 1 } },
                      React.createElement('div', { className: 'track thin' }, React.createElement('div', { className: 'fill', style: { width: Math.min(100, spct) + '%', background: S.CATS[c.key].color } }))),
                    React.createElement('span', { className: 'mono faint', style: { fontSize: 11, width: 60, textAlign: 'right' } }, s.count, ' lanç.'),
                    React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 86, textAlign: 'right', fontSize: 12.5 } }, BRL(s.value)),
                    React.createElement('span', { className: 'mono faint', style: { fontSize: 10.5, width: 42, textAlign: 'right' } }, S.num(spct, 0) + '%'));
                }),
              React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 8 } },
                React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('transactions') }, 'Ver lançamentos'),
                React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('categories') },
                  React.createElement(Icon, { name: 'plus', size: 12 }), 'Editar subcategorias'))));
        })));
  }

  function SplitBar({ fixed, variable }) {
    const total = fixed + variable;
    return React.createElement('div', { style: { display: 'flex', height: 14, borderRadius: 20, overflow: 'hidden', gap: 2 } },
      React.createElement('div', { style: { width: (fixed / total * 100) + '%', background: 'var(--info)' } }),
      React.createElement('div', { style: { width: (variable / total * 100) + '%', background: 'var(--warn)' } }));
  }
  function MiniStat({ dot, label, value, pct }) {
    return React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement('span', { className: 'sdot', style: { background: dot, width: 8, height: 8 } }),
        React.createElement('span', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 } }, label),
        React.createElement('span', { className: 'mono', style: { marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)' } }, pct + '%')),
      React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginTop: 2, fontVariantNumeric: 'tabular-nums' } }, BRL(value)));
  }

  window.Screens = window.Screens || {};
  window.Screens.cashflow = CashFlow;
})();
