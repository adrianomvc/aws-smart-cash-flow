/* SmartCashFlow — Relatórios (prioridade 3) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  const REPORTS = [
    { id: 'exec', label: 'Resumo executivo', icon: 'report' },
    { id: 'cashflow', label: 'Fluxo de caixa mensal', icon: 'flow' },
    { id: 'sankey', label: 'Sankey financeiro', icon: 'flow' },
    { id: 'cats', label: 'Despesas por categoria', icon: 'pie' },
    { id: 'income', label: 'Receitas por origem', icon: 'arrowDR' },
    { id: 'cards', label: 'Cartões', icon: 'card' },
    { id: 'budgets', label: 'Orçamentos', icon: 'target' },
    { id: 'goals', label: 'Metas', icon: 'flag' },
    { id: 'quality', label: 'Qualidade dos dados', icon: 'db' },
    { id: 'wealth', label: 'Patrimônio', icon: 'building' },
    { id: 'proj', label: 'Projeção futura', icon: 'trend' },
  ];

  function Reports({ onNav }) {
    const [rep, setRep] = useState('exec');
    const current = REPORTS.find(r => r.id === rep);
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Crescimento', title: 'Relatórios', icon: 'report',
        sub: 'Visões consolidadas e executivas dos seus dados financeiros.',
        right: React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { className: 'btn btn-ghost btn-sm' }, React.createElement(Icon, { name: 'download', size: 14 }), 'CSV'),
          React.createElement('button', { className: 'btn btn-primary btn-sm' }, React.createElement(Icon, { name: 'file', size: 14 }), 'Exportar PDF')) }),

      React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '232px 1fr', alignItems: 'start' } },
        React.createElement(UI.Card, { className: 'card-pad', style: { position: 'sticky', top: 80 } },
          React.createElement('div', { className: 'eyebrow', style: { marginBottom: 8, paddingLeft: 4 } }, 'Tipo de relatório'),
          React.createElement('div', { className: 'list-select' },
            REPORTS.map(r => React.createElement('button', { key: r.id, className: rep === r.id ? 'on' : '', onClick: () => setRep(r.id) },
              React.createElement(Icon, { name: r.icon, size: 16 }),
              React.createElement('span', { style: { flex: 1 } }, r.label))))),

        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            React.createElement('span', { className: 'chip on' }, React.createElement(Icon, { name: 'calendar', size: 13 }), 'Junho 2026'),
            React.createElement('span', { className: 'chip' }, 'Todas as contas'),
            React.createElement('span', { style: { marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' } }, 'Período analisado: 01/06 a 30/06/2026 · gerado em 06/06')),
          React.createElement(ReportBody, { rep, onNav, current })))
    );
  }

  function ReportBody({ rep, onNav, current }) {
    if (rep === 'sankey') return React.createElement(SankeyReport, { onNav });
    if (rep === 'cats') return React.createElement(CatReport, null);
    if (rep === 'income') return React.createElement(IncomeReport, null);
    if (rep === 'cashflow') return React.createElement(CashReport, null);
    if (rep === 'quality') return React.createElement(QualityReport, { onNav });
    if (rep === 'wealth') return React.createElement(FutureReport, { onNav });
    if (rep === 'cards') return React.createElement(CardsReport, null);
    if (rep === 'budgets') return React.createElement(BudgetsReport, null);
    if (rep === 'goals') return React.createElement(GoalsReport, null);
    if (rep === 'proj') return React.createElement(ProjReport, null);
    return React.createElement(ExecReport, { rep, current });
  }

  function SankeyReport({ onNav }) {
    const [withSubs, setWithSubs] = useState(true);
    const data = window.Charts.buildSankeyData({ withSubs });

    // ranking auxiliares: top fontes e top destinos
    const sourcesRanked = data.columns[0].nodes.slice().sort((a, b) => b.value - a.value);
    const rightRanked = data.columns[2].nodes.slice().sort((a, b) => b.value - a.value);
    const topExpense = rightRanked.find(n => n.kind === 'expense') || rightRanked[0];

    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Receita total', value: S.num(data.totals.income), cur: 'R$', icon: 'arrowDR', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Despesas no período', value: S.num(data.totals.expense), cur: 'R$', icon: 'arrowUR', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Sobrou', value: S.num(data.totals.sobra), cur: 'R$', icon: 'wallet', prov: 'real', sub: S.num(data.totals.sobra / data.totals.income * 100, 1) + '% da renda' }),
        React.createElement(UI.Kpi, { label: 'Subcategorias usadas', value: data.totals.subs, cur: null, icon: 'tag', prov: 'real', sub: data.totals.categories + ' categorias · ' + data.totals.sources + ' fontes' })),

      React.createElement(UI.Card, { style: { marginBottom: 16 } },
        React.createElement(UI.CardHead, {
          title: 'Sankey — fluxo completo do mês', sub: 'Fontes → Renda → ' + (withSubs ? 'Categorias → Subcategorias' : 'Categorias e sobra'), icon: 'flow', prov: 'real',
          right: React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            React.createElement(UI.Tabs, {
              value: withSubs ? 'sub' : 'cat', onChange: v => setWithSubs(v === 'sub'),
              tabs: [{ id: 'cat', label: '3 colunas' }, { id: 'sub', label: '4 colunas' }],
            }))
        }),
        React.createElement('div', { className: 'card-body', style: { padding: '14px 16px' } },
          React.createElement(window.Charts.Sankey, {
            columns: data.columns, links: data.links,
            height: withSubs ? 620 : 480,
            gap: 5, padTopBot: 18,
          }),
          React.createElement('div', { className: 'legend', style: { marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink-3)' } },
            React.createElement(Icon, { name: 'info', size: 13, style: { marginRight: 6, verticalAlign: '-2px' } }),
            'A largura de cada fita é proporcional ao valor. Passe o mouse para ver detalhes. ',
            withSubs ? 'A coluna de subcategorias soma o valor de despesas (não inclui sobra).' : 'O nó "Sobrou" representa o resultado positivo do mês.'))),

      React.createElement('div', { className: 'grid cols-2' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Origens da renda', sub: 'do maior para o menor', icon: 'arrowDR', prov: 'real' }),
          React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Origem'),
              React.createElement('th', { className: 'num' }, 'Valor'),
              React.createElement('th', { className: 'num' }, '% da renda'),
              React.createElement('th', null, ''))),
            React.createElement('tbody', null, sourcesRanked.map((s, i) => React.createElement('tr', { key: i },
              React.createElement('td', null,
                React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 8 } },
                  React.createElement('span', { className: 'catdot', style: { background: s.color, width: 10, height: 10 } }),
                  React.createElement('span', { className: 't-desc' }, s.label))),
              React.createElement('td', { className: 'num', style: { fontWeight: 700, color: 'var(--acc)' } }, BRL(s.value)),
              React.createElement('td', { className: 'num t-sub mono' }, S.num(s.value / data.totals.income * 100, 1) + '%'),
              React.createElement('td', null, React.createElement('div', { className: 'track thin', style: { width: 80 } },
                React.createElement('div', { className: 'fill', style: { width: Math.min(100, s.value / sourcesRanked[0].value * 100) + '%', background: s.color } })))))))),

        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Destinos da renda', sub: 'categorias + sobra', icon: 'pie', prov: 'real' }),
          React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Destino'),
              React.createElement('th', { className: 'num' }, 'Valor'),
              React.createElement('th', { className: 'num' }, '% da renda'),
              React.createElement('th', null, ''))),
            React.createElement('tbody', null, rightRanked.map((n, i) => React.createElement('tr', { key: i, onClick: () => n.kind === 'expense' && onNav('categories'), style: { cursor: n.kind === 'expense' ? 'pointer' : 'default' } },
              React.createElement('td', null,
                React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 8 } },
                  React.createElement('span', { className: 'catdot', style: { background: n.color, width: 10, height: 10 } }),
                  React.createElement('span', { className: 't-desc' }, n.label),
                  n.kind === 'save' && React.createElement(UI.Badge, { kind: 'pos' }, 'sobra'))),
              React.createElement('td', { className: 'num', style: { fontWeight: 700, color: n.kind === 'save' ? 'var(--pos)' : 'var(--neg)' } }, BRL(n.value)),
              React.createElement('td', { className: 'num t-sub mono' }, S.num(n.value / data.totals.income * 100, 1) + '%'),
              React.createElement('td', null, React.createElement('div', { className: 'track thin', style: { width: 80 } },
                React.createElement('div', { className: 'fill', style: { width: Math.min(100, n.value / rightRanked[0].value * 100) + '%', background: n.color } })))))))) ),

      React.createElement(UI.Card, { className: 'card-pad', style: { marginTop: 16, background: 'linear-gradient(135deg, var(--acc-soft), var(--card) 60%)' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          React.createElement('span', { className: 'goal-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)', border: '1px solid var(--acc-soft-2)' } }, React.createElement(Icon, { name: 'sparkles', size: 15 })),
          React.createElement('span', { className: 'eyebrow', style: { color: 'var(--acc-ink)' } }, 'Leitura do Sankey')),
        React.createElement('div', { style: { fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink)' } },
          'A renda da família foi de ', React.createElement('b', null, BRL(data.totals.income)), ', com ',
          React.createElement('b', null, S.num(sourcesRanked[0].value / data.totals.income * 100, 0) + '%'),
          ' concentrada em ', React.createElement('b', null, sourcesRanked[0].label), '. ',
          'O maior destino de gasto foi ', React.createElement('b', null, topExpense.label), ' (',
          React.createElement('b', null, BRL(topExpense.value)),
          '), ', React.createElement('b', null, S.num(topExpense.value / data.totals.income * 100, 1) + '%'), ' da renda. ',
          'Restaram ', React.createElement('b', { style: { color: 'var(--pos)' } }, BRL(data.totals.sobra)), ' (',
          React.createElement('b', null, S.num(data.totals.sobra / data.totals.income * 100, 1) + '%'), ') como fluxo positivo do mês.')))));
  }

  function ExecReport({ current }) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4' },
        React.createElement(UI.Kpi, { label: 'Receitas', value: S.num(18420), cur: 'R$', prov: 'real', delta: +4.2 }),
        React.createElement(UI.Kpi, { label: 'Despesas', value: S.num(13180), cur: 'R$', prov: 'real', delta: +7.8, deltaInvert: true }),
        React.createElement(UI.Kpi, { label: 'Resultado', value: S.num(5240), cur: 'R$', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Saving rate', value: '28,4', cur: null, unit: '%', prov: 'real', delta: +1.6 })),
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Fluxo de caixa — 12 meses', icon: 'bars', prov: 'real' }),
        React.createElement('div', { className: 'card-body' },
          React.createElement(C.LineChart, { series: [
            { label: 'Receitas', color: 'var(--acc)', area: true, data: S.monthly.map(m => ({ x: m.m.toLowerCase(), y: m.inc })) },
            { label: 'Despesas', color: 'var(--neg)', data: S.monthly.map(m => ({ x: m.m.toLowerCase(), y: m.exp })) },
          ], height: 230 }))),
      React.createElement('div', { className: 'grid cols-2' },
        React.createElement(NarrativeCard, null),
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Top categorias', icon: 'pie', prov: 'real' }),
          React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 11 } },
            S.topCats.slice(0, 6).map((c, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement(UI.Cat, { k: c.key }),
              React.createElement('div', { className: 'track thin', style: { flex: 1, margin: '0 8px' } }, React.createElement('div', { className: 'fill', style: { width: c.pct * 2.4 + '%', background: S.CATS[c.key].color } })),
              React.createElement('span', { className: 'mono', style: { fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' } }, BRL(c.value)))) ))));
  }

  function NarrativeCard() {
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement('div', { className: 'eyebrow', style: { marginBottom: 10 } }, 'Leitura do período'),
      React.createElement('div', { style: { fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)' } },
        'A Família Andrade fechou junho com ', React.createElement('b', { style: { color: 'var(--ink)' } }, 'resultado positivo de R$ 5.240'), ', mantendo a tendência dos últimos 5 meses. As receitas seguem ',
        React.createElement('b', null, '91% recorrentes'), ', o que dá alta previsibilidade. ',
        'O comprometimento da renda (', React.createElement('b', null, '41%'), ') está acima do ideal de 35%, puxado pelo financiamento. ',
        'Recomenda-se direcionar o excedente para a reserva de emergência, hoje em 79% da meta.'),
      React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' } },
        React.createElement('span', { className: 'badge b-pos' }, React.createElement(Icon, { name: 'checkCircle', size: 12 }), 'Saldo positivo'),
        React.createElement('span', { className: 'badge b-warn' }, React.createElement(Icon, { name: 'alert', size: 12 }), 'Comprometimento alto'),
        React.createElement('span', { className: 'badge b-real' }, React.createElement(Icon, { name: 'db', size: 12 }), 'Qualidade 86%')));
  }

  function IncomeReport() {
    const ib = S.incomeBreakdown;
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Receita total', value: S.num(ib.total), cur: 'R$', icon: 'arrowDR', prov: 'real', delta: ib.delta }),
        React.createElement(UI.Kpi, { label: 'Origens ativas', value: ib.items.length, cur: null, icon: 'list', prov: 'real', sub: 'subcategorias' }),
        React.createElement(UI.Kpi, { label: 'Receita recorrente', value: '91', cur: null, unit: '%', icon: 'refresh', prov: 'real', sub: 'alta previsibilidade' }),
        React.createElement(UI.Kpi, { label: 'Maior fonte', value: '44,5', cur: null, unit: '%', icon: 'target', prov: 'real', sub: 'Salário principal' })),

      React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '300px 1fr' } },
        React.createElement(UI.Card, { className: 'card-pad', style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
          React.createElement('div', { className: 'eyebrow', style: { alignSelf: 'flex-start', marginBottom: 14 } }, 'Distribuição por origem'),
          React.createElement(C.Donut, { data: ib.items.map((it, i) => ({ value: it.value, color: `oklch(58% 0.14 ${150 + i * 22})` })), size: 180, thickness: 26,
            center: React.createElement('div', null,
              React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 } }, BRL(ib.total)),
              React.createElement('div', { className: 't-sub' }, 'total no mês')) }),
          React.createElement('div', { style: { width: '100%', marginTop: 16, display: 'grid', gap: 8 } },
            ib.items.slice(0, 5).map((it, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 } },
              React.createElement('span', { className: 'sdot', style: { background: `oklch(58% 0.14 ${150 + i * 22})`, width: 9, height: 9 } }),
              React.createElement('span', { style: { flex: 1, color: 'var(--ink-2)' } }, it.sub),
              React.createElement('span', { className: 'mono', style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, S.num(it.pct, 1) + '%'))))),

        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Receitas por categoria e subcategoria', sub: 'Onde o dinheiro entrou em junho', icon: 'arrowDR', prov: 'real' }),
          React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Categoria'),
              React.createElement('th', null, 'Subcategoria'),
              React.createElement('th', null, 'Origem'),
              React.createElement('th', { className: 'num' }, 'Lanç.'),
              React.createElement('th', { className: 'num' }, 'Valor'),
              React.createElement('th', { className: 'num' }, '% do total'),
              React.createElement('th', { className: 'num' }, 'vs. média'))),
            React.createElement('tbody', null, ib.items.map((it, i) => React.createElement('tr', { key: i },
              React.createElement('td', null, React.createElement(UI.Cat, { k: it.cat })),
              React.createElement('td', { style: { fontWeight: 600 } }, it.sub),
              React.createElement('td', { className: 't-sub' }, it.note),
              React.createElement('td', { className: 'num t-sub mono' }, it.count),
              React.createElement('td', { className: 'num', style: { fontWeight: 700, color: 'var(--acc)' } }, BRL(it.value)),
              React.createElement('td', { className: 'num' }, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' } },
                React.createElement('div', { className: 'track thin', style: { width: 80 } }, React.createElement('div', { className: 'fill', style: { width: Math.min(100, it.pct * 2) + '%', background: 'var(--acc)' } })),
                React.createElement('span', { className: 'mono', style: { fontVariantNumeric: 'tabular-nums', minWidth: 42, textAlign: 'right' } }, S.num(it.pct, 1) + '%'))),
              React.createElement('td', { className: 'num' }, it.delta === 0
                ? React.createElement('span', { className: 't-sub mono' }, '—')
                : React.createElement(UI.Delta, { v: it.delta }))))))))));
  }

  function CatReport() {
    return React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '300px 1fr' } },
      React.createElement(UI.Card, { className: 'card-pad', style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        React.createElement('div', { className: 'eyebrow', style: { alignSelf: 'flex-start', marginBottom: 14 } }, 'Distribuição'),
        React.createElement(C.Donut, { data: S.topCats.slice(0, 6).map(c => ({ value: c.value, color: S.CATS[c.key].color })), size: 180, thickness: 26,
          center: React.createElement('div', null, React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 } }, BRL(13180)), React.createElement('div', { className: 't-sub' }, 'total')) })),
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Despesas por categoria', icon: 'pie', prov: 'real' }),
        React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
          React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Categoria'), React.createElement('th', { className: 'num' }, 'Valor'), React.createElement('th', { className: 'num' }, '% do total'), React.createElement('th', { className: 'num' }, 'vs. média'))),
          React.createElement('tbody', null, S.topCats.map((c, i) => React.createElement('tr', { key: i },
            React.createElement('td', null, React.createElement(UI.Cat, { k: c.key })),
            React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, BRL(c.value)),
            React.createElement('td', { className: 'num t-sub mono' }, S.num(c.pct, 1) + '%'),
            React.createElement('td', { className: 'num' }, React.createElement(UI.Delta, { v: c.delta, invert: true })))))))));
  }

  function CashReport() {
    let acc = 0;
    const rows = S.monthly.map((m, i) => {
      const r = m.inc - m.exp; acc += r;
      return React.createElement('tr', { key: i, style: m.current ? { background: 'var(--acc-soft)' } : null },
        React.createElement('td', { style: { fontWeight: 600 } }, m.m + (m.current ? ' (atual)' : '')),
        React.createElement('td', { className: 'num', style: { color: 'var(--acc)' } }, BRL(m.inc)),
        React.createElement('td', { className: 'num', style: { color: 'var(--neg)' } }, BRL(m.exp)),
        React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, BRL(r, { sign: true })),
        React.createElement('td', { className: 'num t-sub mono' }, BRL(acc)));
    });
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Fluxo de caixa mensal', icon: 'flow', prov: 'real' }),
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { className: 'tbl' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, 'Mês'), React.createElement('th', { className: 'num' }, 'Receitas'),
            React.createElement('th', { className: 'num' }, 'Despesas'), React.createElement('th', { className: 'num' }, 'Resultado'),
            React.createElement('th', { className: 'num' }, 'Acum.'))),
          React.createElement('tbody', null, rows))));
  }

  function QualityReport({ onNav }) {
    const items = [
      { label: 'Transações categorizadas', val: 92, total: '286 de 311' },
      { label: 'Importações sem erro', val: 88, total: '5 de 6 arquivos' },
      { label: 'Contas conciliadas', val: 70, total: '7 de 10' },
      { label: 'Transações revisadas', val: 86, total: '268 de 311' },
    ];
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-2' },
        React.createElement(UI.Card, { className: 'card-pad', style: { display: 'flex', gap: 18, alignItems: 'center' } },
          React.createElement(C.Ring, { value: 86, size: 100, thickness: 10 }, React.createElement('div', null, React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 } }, '86%'), React.createElement('div', { className: 't-sub' }, 'qualidade'))),
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 700, fontSize: 16, marginBottom: 4 } }, 'Boa qualidade de dados'),
            React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 } }, 'Resolver as 3 categorizações pendentes elevaria a precisão dos indicadores para ~94%.'),
            React.createElement('button', { className: 'btn btn-ghost btn-sm', style: { marginTop: 12 }, onClick: () => onNav('transactions') }, 'Revisar pendências'))),
        React.createElement(UI.Card, { className: 'card-pad' },
          React.createElement('div', { className: 'eyebrow', style: { marginBottom: 14 } }, 'Critérios de qualidade'),
          React.createElement('div', { style: { display: 'grid', gap: 13 } }, items.map((it, i) => React.createElement('div', { key: i },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 } }, React.createElement('span', { style: { fontWeight: 600 } }, it.label), React.createElement('span', { className: 'mono t-sub' }, it.total)),
            React.createElement(UI.Bar, { value: it.val, max: 100, status: it.val < 75 ? 'warn' : 'ok' })))))));
  }

  function FutureReport({ onNav }) {
    return React.createElement(React.Fragment, null,
      React.createElement(UI.Card, { className: 'card-pad' },
        React.createElement('div', { className: 'grid cols-3' },
          React.createElement(UI.Kpi, { label: 'Patrimônio líquido', value: '913.100', cur: 'R$', prov: 'est' }),
          React.createElement(UI.Kpi, { label: 'Ativos', value: '1.130.160', cur: 'R$', prov: 'est' }),
          React.createElement(UI.Kpi, { label: 'Passivos', value: '217.060', cur: 'R$', prov: 'real' }))),
      React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 16 }, onClick: () => onNav('wealth') }, 'Abrir módulo Patrimônio', React.createElement(Icon, { name: 'chevR', size: 15 })));
  }

  // ============ CARTÕES ============
  function CardsReport() {
    const totLimit = S.cards.reduce((a, c) => a + c.limit, 0);
    const totUsed = S.cards.reduce((a, c) => a + c.used, 0);
    const totInvoice = S.cards.reduce((a, c) => a + c.invoice, 0);
    const totParc = S.cards.reduce((a, c) => a + c.parcelado, 0);
    const util = Math.round((totUsed / totLimit) * 100);
    const sumCats = S.cardCats.reduce((a, c) => a + c.value, 0);

    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Limite total', value: S.num(totLimit), cur: 'R$', icon: 'card', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Utilizado', value: S.num(totUsed), cur: 'R$', icon: 'bars', prov: 'real', sub: util + '% do limite' }),
        React.createElement(UI.Kpi, { label: 'Próxima fatura', value: S.num(totInvoice), cur: 'R$', icon: 'receipt', prov: 'real', sub: 'fecha em 4 dias' }),
        React.createElement(UI.Kpi, { label: 'Em parcelado', value: S.num(totParc), cur: 'R$', icon: 'refresh', prov: 'real', sub: 'parcelas futuras' })),

      React.createElement('div', { className: 'grid cols-2', style: { marginBottom: 16 } },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Limite × utilização', sub: 'por cartão', icon: 'card', prov: 'real' }),
          React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 16 } },
            S.cards.map((c, i) => {
              const pct = Math.round((c.used / c.limit) * 100);
              return React.createElement('div', { key: i },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 } },
                  React.createElement('span', { style: { width: 8, height: 8, borderRadius: 2, background: c.color } }),
                  React.createElement('span', { style: { fontWeight: 700 } }, c.name),
                  React.createElement('span', { className: 'mono t-sub' }, '•' + c.last + ' · ' + c.brand),
                  React.createElement('span', { className: 'mono', style: { marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, BRL(c.used) + ' / ' + BRL(c.limit))),
                React.createElement(UI.Bar, { value: c.used, max: c.limit, status: pct > 80 ? 'over' : pct > 60 ? 'warn' : 'ok' }),
                React.createElement('div', { style: { display: 'flex', gap: 14, marginTop: 6, fontSize: 11.5, color: 'var(--ink-3)' } },
                  React.createElement('span', null, 'Fatura ', React.createElement('b', { style: { color: 'var(--ink-2)' } }, BRL(c.invoice))),
                  React.createElement('span', null, 'Fecha dia ', React.createElement('b', null, c.close)),
                  React.createElement('span', null, 'Vence dia ', React.createElement('b', null, c.due)),
                  React.createElement('span', null, 'Parcelado ', React.createElement('b', null, BRL(c.parcelado)))));
            }))),

        React.createElement(UI.Card, { className: 'card-pad' },
          React.createElement(UI.CardHead, { title: 'Gastos do cartão por categoria', sub: 'mês corrente', icon: 'pie', prov: 'real' }),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 18, marginTop: 8 } },
            React.createElement(C.Donut, { data: S.cardCats.map(c => ({ value: c.value, color: S.CATS[c.key].color })), size: 150, thickness: 22,
              center: React.createElement('div', null,
                React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 } }, BRL(sumCats)),
                React.createElement('div', { className: 't-sub' }, 'cartões')) }),
            React.createElement('div', { style: { flex: 1, display: 'grid', gap: 8 } },
              S.cardCats.map((c, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 } },
                React.createElement(UI.Cat, { k: c.key }),
                React.createElement('span', { className: 'mono', style: { marginLeft: 'auto', fontWeight: 700 } }, BRL(c.value)),
                React.createElement('span', { className: 'mono t-sub', style: { width: 44, textAlign: 'right' } }, S.num(c.value / sumCats * 100, 0) + '%')))))) ),

      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Lançamentos recentes nos cartões', icon: 'list', prov: 'real' }),
        React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, 'Data'), React.createElement('th', null, 'Descrição'),
            React.createElement('th', null, 'Categoria'), React.createElement('th', null, 'Parcela'),
            React.createElement('th', { className: 'num' }, 'Valor'))),
          React.createElement('tbody', null, S.cardTx.map((t, i) => React.createElement('tr', { key: i },
            React.createElement('td', { className: 'mono t-sub' }, t.date),
            React.createElement('td', null, t.desc),
            React.createElement('td', null, React.createElement(UI.Cat, { k: t.cat })),
            React.createElement('td', null, t.inst ? React.createElement('span', { className: 'pill', style: { fontFamily: 'var(--font-mono)' } }, t.inst) : React.createElement('span', { className: 't-sub' }, '—')),
            React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, BRL(t.value)))))))));
  }
  function BudgetsReport() {
    const totPl = S.budgets.reduce((a, b) => a + b.planned, 0);
    const totAc = S.budgets.reduce((a, b) => a + b.actual, 0);
    const over = S.budgets.filter(b => b.actual > b.planned).length;
    const ontrack = S.budgets.filter(b => b.actual <= b.planned * 0.9).length;
    const sorted = [...S.budgets].sort((a, b) => (b.actual / b.planned) - (a.actual / a.planned));

    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Planejado', value: S.num(totPl), cur: 'R$', icon: 'target', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Realizado', value: S.num(totAc), cur: 'R$', icon: 'bars', prov: 'real', sub: S.num(totAc / totPl * 100, 0) + '% do planejado' }),
        React.createElement(UI.Kpi, { label: 'Sobra do mês', value: S.num(totPl - totAc), cur: 'R$', icon: 'flow', prov: 'real', sub: 'antes do fim do mês' }),
        React.createElement(UI.Kpi, { label: 'Estouradas', value: over, cur: null, icon: 'alert', prov: 'real', sub: ontrack + ' tranquilas' })),

      React.createElement('div', { className: 'grid cols-2' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Categorias × orçamento', sub: 'Da mais comprometida para a menos', icon: 'pie', prov: 'real' }),
          React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 16 } },
            sorted.map((b, i) => {
              const pct = (b.actual / b.planned) * 100;
              const status = pct > 100 ? 'over' : pct > 90 ? 'warn' : 'ok';
              const label = pct > 100 ? 'Estourou' : pct > 90 ? 'No limite' : 'Ok';
              const kind = pct > 100 ? 'neg' : pct > 90 ? 'warn' : 'real';
              return React.createElement('div', { key: i },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                  React.createElement(UI.Cat, { k: b.key }),
                  React.createElement('span', { className: 'mono', style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700 } },
                    BRL(b.actual), React.createElement('span', { className: 'muted', style: { fontWeight: 400 } }, ' / ' + BRL(b.planned))),
                  React.createElement('span', { style: { width: 88, textAlign: 'right' } }, React.createElement(UI.Badge, { kind }, label))),
                React.createElement(UI.Bar, { value: b.actual, max: b.planned, status }),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5, color: 'var(--ink-3)' } },
                  React.createElement('span', { className: 'mono' }, S.num(pct, 0) + '% consumido'),
                  React.createElement('span', null, b.actual > b.planned ? 'estourou ' + BRL(b.actual - b.planned) : 'restam ' + BRL(b.planned - b.actual))));
            }))),

        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 10 } }, 'Resumo'),
            React.createElement('div', { style: { fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)' } },
              'Você gastou ', React.createElement('b', { style: { color: 'var(--ink)' } }, BRL(totAc)), ' contra o planejado de ', React.createElement('b', null, BRL(totPl)), ' — ',
              React.createElement('b', { style: { color: 'var(--acc)' } }, S.num(totAc / totPl * 100, 0) + '%'), ' do orçamento. ',
              over + ' categoria' + (over !== 1 ? 's' : '') + ' acima do limite: ',
              React.createElement('b', null, S.budgets.filter(b => b.actual > b.planned).map(b => S.CATS[b.key].label).join(', ')), '.')),
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 10 } }, 'Maiores variações'),
            React.createElement('div', { style: { display: 'grid', gap: 10 } },
              sorted.slice(0, 4).map((b, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement(UI.Cat, { k: b.key }),
                React.createElement('span', { className: 'mono', style: { marginLeft: 'auto', fontWeight: 700, color: b.actual > b.planned ? 'var(--neg)' : 'var(--acc)' } },
                  (b.actual > b.planned ? '+' : '−') + BRL(Math.abs(b.actual - b.planned))))))))));
  }

  // ============ METAS ============
  function GoalsReport() {
    const totC = S.goals.reduce((a, g) => a + g.current, 0);
    const totT = S.goals.reduce((a, g) => a + g.target, 0);
    const totM = S.goals.reduce((a, g) => a + g.monthly, 0);
    const ontrack = S.goals.filter(g => g.status === 'ontrack').length;
    const st = { ontrack: { k: 'pos', label: 'No prazo' }, attention: { k: 'warn', label: 'Atenção' }, late: { k: 'neg', label: 'Atrasada' } };

    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Total guardado', value: S.num(totC), cur: 'R$', icon: 'flag', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Meta combinada', value: S.num(totT), cur: 'R$', icon: 'target', prov: 'real', sub: S.num(totC / totT * 100, 0) + '% atingido' }),
        React.createElement(UI.Kpi, { label: 'Aportes mensais', value: S.num(totM), cur: 'R$', icon: 'refresh', prov: 'real', sub: 'todas as metas' }),
        React.createElement(UI.Kpi, { label: 'Metas no prazo', value: ontrack + ' / ' + S.goals.length, cur: null, icon: 'check', prov: 'real' })),

      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Acompanhamento das metas', icon: 'flag', prov: 'real' }),
        React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 18 } },
          S.goals.map((g, i) => {
            const pct = (g.current / g.target) * 100;
            const cat = S.CATS[g.cat] || { color: 'var(--acc)' };
            const missing = g.target - g.current;
            const monthsTo = Math.ceil(missing / g.monthly);
            return React.createElement('div', { key: i, style: { display: 'grid', gridTemplateColumns: '40px 1fr 180px', gap: 14, alignItems: 'center' } },
              React.createElement('div', { style: { background: cat.color + '20', color: cat.color, width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Icon, { name: g.icon, size: 18 })),
              React.createElement('div', null,
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
                  React.createElement('span', { style: { fontWeight: 700, fontSize: 14 } }, g.title),
                  React.createElement(UI.Cat, { k: g.cat }),
                  React.createElement('span', { style: { marginLeft: 'auto' }, className: 'mono faint' }, S.num(pct, 0) + '%')),
                React.createElement(UI.Bar, { value: g.current, max: g.target, color: cat.color }),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5, color: 'var(--ink-3)' } },
                  React.createElement('span', { className: 'mono' }, BRL(g.current) + ' / ' + BRL(g.target)),
                  React.createElement('span', null, 'aporte ', React.createElement('b', { style: { color: 'var(--ink-2)' } }, BRL(g.monthly) + '/mês')),
                  React.createElement('span', null, 'até ', React.createElement('b', null, g.deadline)))),
              React.createElement('div', { style: { textAlign: 'right' } },
                React.createElement(UI.Badge, { kind: st[g.status].k }, st[g.status].label),
                React.createElement('div', { className: 't-sub mono', style: { marginTop: 6, fontSize: 11 } }, missing > 0 ? monthsTo + ' meses restantes' : 'concluída')));
          }))));
  }

  // ============ PROJEÇÃO FUTURA ============
  function ProjReport() {
    const p = S.projection;
    const riskMap = { low: { k: 'pos', label: 'Baixo' }, medium: { k: 'warn', label: 'Médio' }, high: { k: 'neg', label: 'Alto' } };
    const monthLbls = ['jun','jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun'];

    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Saldo projetado em 30d', value: S.num(p.horizons[0].end), cur: 'R$', icon: 'trend', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Saldo projetado em 90d', value: S.num(p.horizons[2].end), cur: 'R$', icon: 'bars', prov: 'est' }),
        React.createElement(UI.Kpi, { label: 'Saldo projetado em 12m', value: S.num(p.horizons[3].end), cur: 'R$', icon: 'flow', prov: 'est' }),
        React.createElement(UI.Kpi, { label: 'Menor saldo previsto', value: S.num(p.horizons[3].min), cur: 'R$', icon: 'alert', prov: 'est', sub: p.horizons[3].minDay })),

      React.createElement(UI.Card, { style: { marginBottom: 16 } },
        React.createElement(UI.CardHead, { title: 'Projeção de saldo — 12 meses', sub: 'Cenários provável, otimista e pessimista', icon: 'trend', prov: 'est' }),
        React.createElement('div', { className: 'card-body' },
          React.createElement(C.LineChart, {
            series: [
              { label: 'Otimista',   color: 'var(--pos)', data: p.series.map(s => ({ x: monthLbls[s.m], y: s.best  / 1000 })) },
              { label: 'Provável',   color: 'var(--acc)', area: true, data: p.series.map(s => ({ x: monthLbls[s.m], y: s.prob  / 1000 })) },
              { label: 'Pessimista', color: 'var(--neg)', data: p.series.map(s => ({ x: monthLbls[s.m], y: s.worst / 1000 })) },
            ], height: 260,
          }),
          React.createElement('div', { className: 'legend', style: { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 18 } },
            React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot', style: { background: 'var(--pos)' } }), 'Otimista'),
            React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot', style: { background: 'var(--acc)' } }), 'Provável'),
            React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot', style: { background: 'var(--neg)' } }), 'Pessimista'),
            React.createElement('span', { style: { marginLeft: 'auto' }, className: 't-sub mono' }, 'valores em milhares de R$')))),

      React.createElement('div', { className: 'grid cols-2' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Horizontes', icon: 'calendar', prov: 'est' }),
          React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Horizonte'),
              React.createElement('th', { className: 'num' }, 'Saldo final'),
              React.createElement('th', { className: 'num' }, 'Menor saldo'),
              React.createElement('th', null, 'Quando'),
              React.createElement('th', null, 'Risco'))),
            React.createElement('tbody', null, p.horizons.map((h, i) => React.createElement('tr', { key: i },
              React.createElement('td', { style: { fontWeight: 700 } }, h.d >= 365 ? '12 meses' : h.d + ' dias'),
              React.createElement('td', { className: 'num', style: { color: 'var(--acc)', fontWeight: 700 } }, BRL(h.end)),
              React.createElement('td', { className: 'num' }, BRL(h.min)),
              React.createElement('td', { className: 'mono t-sub' }, h.minDay),
              React.createElement('td', null, React.createElement(UI.Badge, { kind: riskMap[h.risk].k }, riskMap[h.risk].label)))))))),

        React.createElement(UI.Card, { className: 'card-pad' },
          React.createElement('div', { className: 'eyebrow', style: { marginBottom: 10 } }, 'Premissas usadas'),
          React.createElement('div', { style: { display: 'grid', gap: 10, marginBottom: 14 } },
            p.assumptions.map((a, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: i < p.assumptions.length - 1 ? '1px dashed var(--line)' : 'none' } },
              React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', flex: 1 } }, a.label),
              React.createElement('span', { className: 'mono', style: { fontWeight: 700, fontSize: 12.5 } }, a.value),
              React.createElement(UI.Prov, { k: a.prov, withLabel: false })))),
          React.createElement(UI.Alert, { type: 'info', title: 'Cenário pessimista' }, 'Considera queda de 20% na receita variável e gastos com saúde 30% acima da média. A linha pessimista cruzaria a faixa de R$ 12 mil em ' + p.horizons[3].minDay + '.'))));
  }

  window.Screens = window.Screens || {};
  window.Screens.reports = Reports;
})();
