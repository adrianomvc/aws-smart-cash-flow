/* SmartCashFlow — Investimentos (visão de POSIÇÃO, não trades) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  function Invest({ onNav }) {
    const iv = S.invest;
    const [classFilter, setClassFilter] = useState('all');
    const classOf = (id) => iv.classes.find(c => c.id === id) || { label: id, color: '#999' };

    // Filtered data
    const filteredAssets = iv.assets.filter(a => classFilter === 'all' || a.class === classFilter);
    const filteredAccounts = classFilter === 'all'
      ? iv.accounts
      : iv.accounts.filter(acc => acc.classes.some(c => c.id === classFilter));

    const gainPct = (iv.totalGain / iv.totalContrib * 100);

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, {
        eyebrow: 'Crescimento',
        title: 'Investimentos',
        icon: 'coins',
        sub: 'Visão de posição da carteira — patrimônio, alocação por classe e onde cada parte está custodiada. Sem trades, sem operações.',
        right: React.createElement('div', { className: 'period' },
          React.createElement('button', { className: 'period-arrow' }, React.createElement(Icon, { name: 'chevL', size: 16 })),
          React.createElement('div', { className: 'period-current' }, 'Junho 2026'),
          React.createElement('button', { className: 'period-arrow' }, React.createElement(Icon, { name: 'chevR', size: 16 })))
      }),

      // Class filter chips
      React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' } },
        React.createElement('span', { className: 'eyebrow', style: { marginRight: 4 } }, 'Filtrar:'),
        React.createElement('button', { className: 'chip' + (classFilter === 'all' ? ' on' : ''), onClick: () => setClassFilter('all') }, 'Todas as classes'),
        iv.classes.map(c => React.createElement('button', {
          key: c.id,
          className: 'chip' + (classFilter === c.id ? ' on' : ''),
          onClick: () => setClassFilter(c.id),
          style: classFilter === c.id ? { borderColor: c.color, color: c.color, background: c.color + '14' } : null,
        },
          React.createElement('span', { className: 'catdot', style: { background: c.color, width: 8, height: 8 } }),
          c.label))),

      // KPIs
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Patrimônio investido', value: S.num(iv.total), cur: 'R$', icon: 'coins', prov: 'real', sub: iv.accounts.length + ' custódias · ' + iv.assets.length + ' ativos' }),
        React.createElement(UI.Kpi, { label: 'Rentabilidade no mês', value: S.num(iv.monthReturn, 2), cur: null, unit: '%', icon: 'trend', prov: 'real', delta: +iv.monthReturn, sub: 'vs CDI: 104%' }),
        React.createElement(UI.Kpi, { label: 'Rentabilidade no ano', value: S.num(iv.yearReturn, 1), cur: null, unit: '%', icon: 'bars', prov: 'real', delta: +iv.yearReturn, sub: 'YTD: +' + S.num(iv.ytdReturn, 1) + '%' }),
        React.createElement(UI.Kpi, { label: 'Ganho acumulado', value: S.num(iv.totalGain), cur: 'R$', icon: 'plus', prov: 'real', sub: '+' + S.num(gainPct, 1) + '% sobre R$ ' + S.num(iv.totalContrib) + ' aportados' })),

      // Chart row: evolution + allocation donut
      React.createElement('div', { className: 'dash-main' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, {
            title: 'Evolução do patrimônio investido',
            sub: '12 meses · variação ' + S.num((iv.history[11].v - iv.history[0].v) / iv.history[0].v * 100, 1) + '%',
            icon: 'trend', prov: 'real'
          }),
          React.createElement('div', { className: 'card-body' },
            React.createElement(C.LineChart, {
              series: [{ label: 'Patrimônio', color: 'var(--acc)', area: true,
                data: iv.history.map(h => ({ x: h.m, y: h.v / 1000 })) }],
              height: 260,
              fmt: (v) => 'R$ ' + v.toFixed(0) + 'k'
            }))),

        React.createElement(UI.Card, { className: 'card-pad', style: { display: 'flex', flexDirection: 'column' } },
          React.createElement('div', { className: 'eyebrow', style: { marginBottom: 4 } }, 'Alocação por classe'),
          React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, marginBottom: 14 } }, 'Como está dividido'),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 14 } },
            React.createElement(C.Donut, {
              data: iv.classes.map(c => ({ value: c.value, color: c.color })),
              size: 180, thickness: 26,
              center: React.createElement('div', { style: { textAlign: 'center' } },
                React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.3px' } }, BRL(iv.total)),
                React.createElement('div', { className: 't-sub', style: { fontSize: 10.5 } }, 'patrimônio'))
            })),
          React.createElement('div', { style: { display: 'grid', gap: 9 } },
            iv.classes.map(c => React.createElement('div', { key: c.id, style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 } },
              React.createElement('span', { className: 'catdot', style: { background: c.color } }),
              React.createElement('span', { style: { flex: 1, color: 'var(--ink-2)', fontWeight: 600 } }, c.label),
              React.createElement('span', { className: 'mono t-sub' }, S.num(c.pct, 1) + '%'),
              React.createElement('span', { className: 'mono', style: { fontWeight: 700, width: 90, textAlign: 'right' } }, BRL(c.value)))))
        )
      ),

      // Custódias section
      React.createElement('div', { style: { marginTop: 24, marginBottom: 14 } },
        React.createElement(UI.Section, {
          eyebrow: 'Onde está',
          title: 'Por custódia',
          icon: 'building',
          sub: 'Cada conta, corretora ou carteira é uma custódia. Posição consolidada por onde o dinheiro está guardado.'
        })),

      React.createElement('div', { className: 'cust-grid' },
        filteredAccounts.map(a => React.createElement(AccountCard, { key: a.id, account: a, classOf }))),

      filteredAccounts.length === 0 && React.createElement(UI.Card, { className: 'card-pad', style: { textAlign: 'center', color: 'var(--ink-3)' } },
        'Nenhuma custódia com essa classe.'),

      // Rentabilidade por classe
      React.createElement('div', { style: { marginTop: 24, marginBottom: 14 } },
        React.createElement(UI.Section, { eyebrow: 'Performance', title: 'Rentabilidade por classe', icon: 'bars' })),

      React.createElement(UI.Card, { className: 'card-pad' },
        React.createElement('div', { className: 'classes-perf' },
          iv.classes.map(c => React.createElement('div', { key: c.id, className: 'cp-row' + (classFilter !== 'all' && classFilter !== c.id ? ' dim' : '') },
            React.createElement('div', { className: 'cp-head' },
              React.createElement('span', { className: 'catdot', style: { background: c.color, width: 10, height: 10 } }),
              React.createElement('span', { className: 'cp-name' }, c.label),
              React.createElement('span', { className: 'cp-pct mono' }, S.num(c.pct, 1) + '%')),
            React.createElement('div', { className: 'cp-bar' },
              React.createElement('div', { className: 'cp-fill', style: { width: c.pct + '%', background: c.color } })),
            React.createElement('div', { className: 'cp-stats' },
              React.createElement('div', { className: 'cp-stat' },
                React.createElement('span', { className: 'cps-lab' }, 'Posição'),
                React.createElement('span', { className: 'cps-val mono' }, BRL(c.value))),
              React.createElement('div', { className: 'cp-stat' },
                React.createElement('span', { className: 'cps-lab' }, 'No mês'),
                React.createElement('span', { className: 'cps-val' }, React.createElement(UI.Delta, { v: c.monthRet }))),
              React.createElement('div', { className: 'cp-stat' },
                React.createElement('span', { className: 'cps-lab' }, 'No ano'),
                React.createElement('span', { className: 'cps-val' }, React.createElement(UI.Delta, { v: c.yearRet }))))))
        )),

      // Posição detalhada
      React.createElement('div', { style: { marginTop: 24, marginBottom: 14 } },
        React.createElement(UI.Section, {
          eyebrow: 'Ativos',
          title: 'Posição detalhada',
          icon: 'list',
          sub: 'Cada linha é uma posição, não uma operação. Use os filtros acima para focar em uma classe.',
          right: React.createElement('span', { className: 't-sub mono' }, filteredAssets.length + ' ativos · ' + BRL(filteredAssets.reduce((s, a) => s + a.value, 0)))
        })),

      React.createElement(UI.Card, null,
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Ativo'),
              React.createElement('th', null, 'Classe'),
              React.createElement('th', null, 'Custódia'),
              React.createElement('th', null, 'Detalhe'),
              React.createElement('th', null, 'Risco'),
              React.createElement('th', { className: 'num' }, 'Posição'),
              React.createElement('th', { className: 'num' }, 'Mês'),
              React.createElement('th', { className: 'num' }, 'Ano'))),
            React.createElement('tbody', null, filteredAssets.map((a, i) => {
              const cls = classOf(a.class);
              return React.createElement('tr', { key: i },
                React.createElement('td', null, React.createElement('span', { className: 't-desc' }, a.name)),
                React.createElement('td', null,
                  React.createElement('span', { className: 'pill', style: { background: cls.color + '1a', color: cls.color, border: '1px solid ' + cls.color + '33', fontWeight: 700 } },
                    React.createElement('span', { className: 'catdot', style: { background: cls.color, width: 7, height: 7 } }),
                    cls.label)),
                React.createElement('td', { className: 't-sub' }, a.account),
                React.createElement('td', { className: 't-sub' }, a.extra),
                React.createElement('td', null, React.createElement('span', { className: 'pill' }, a.risk)),
                React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, BRL(a.value)),
                React.createElement('td', { className: 'num' }, React.createElement(UI.Delta, { v: a.ret })),
                React.createElement('td', { className: 'num' }, React.createElement(UI.Delta, { v: a.ytd })));
            }))))));
  }

  function AccountCard({ account, classOf }) {
    const a = account;
    const deltaPct = ((a.value - a.prev) / a.prev * 100);
    const gain = a.value - a.contrib;
    const gainPct = (gain / a.contrib * 100);
    const totalForBars = a.classes.reduce((s, c) => s + c.value, 0) || 1;

    // Type icon by account.type
    const TYPE_ICON = { broker: 'bars', pension: 'shield', 'cex': 'globe', wallet: 'lock', reserve: 'wallet' };
    const TYPE_LABEL = { broker: 'Corretora', pension: 'Previdência', 'cex': 'Exchange', wallet: 'Self-custody', reserve: 'Reserva' };

    return React.createElement(UI.Card, { className: 'card-pad cust-card' },
      React.createElement('div', { className: 'cust-head' },
        React.createElement('span', { className: 'cust-brand', style: { background: a.color + '22', color: a.color, border: '1px solid ' + a.color + '55' } }, a.brand),
        React.createElement('div', { className: 'cust-name-wrap' },
          React.createElement('div', { className: 'cust-name' }, a.name),
          React.createElement('div', { className: 'cust-kind' },
            React.createElement(Icon, { name: TYPE_ICON[a.type] || 'building', size: 11 }),
            a.kind))),

      React.createElement('div', { className: 'cust-value-row' },
        React.createElement('div', null,
          React.createElement('div', { className: 'cust-val-lab' }, 'Posição atual'),
          React.createElement('div', { className: 'cust-val mono' }, BRL(a.value))),
        React.createElement('div', { className: 'cust-delta-col' },
          React.createElement('div', { className: 'cust-delta-lab' }, 'No mês'),
          React.createElement(UI.Delta, { v: +deltaPct.toFixed(2) }))),

      React.createElement('div', { className: 'cust-bars' },
        a.classes.map((c, i) => {
          const cls = classOf(c.id);
          const pct = c.value / totalForBars * 100;
          return React.createElement('div', { key: i, className: 'cust-bar-row' },
            React.createElement('div', { className: 'cust-bar-head' },
              React.createElement('span', { className: 'catdot', style: { background: cls.color, width: 7, height: 7 } }),
              React.createElement('span', { className: 'cbh-name' }, cls.label),
              React.createElement('span', { className: 'cbh-val mono' }, BRL(c.value))),
            React.createElement('div', { className: 'cust-bar-track' },
              React.createElement('div', { className: 'cust-bar-fill', style: { width: pct + '%', background: cls.color } })));
        })),

      React.createElement('div', { className: 'cust-foot' },
        React.createElement('div', { className: 'cust-foot-cell' },
          React.createElement('span', { className: 'cust-foot-lab' }, 'Aporte'),
          React.createElement('span', { className: 'cust-foot-val mono' }, BRL(a.contrib))),
        React.createElement('div', { className: 'cust-foot-cell' },
          React.createElement('span', { className: 'cust-foot-lab' }, 'Ganho'),
          React.createElement('span', { className: 'cust-foot-val mono', style: { color: gain >= 0 ? 'var(--pos)' : 'var(--neg)' } },
            (gain >= 0 ? '+' : '−') + 'R$ ' + S.num(Math.abs(gain)))),
        React.createElement('div', { className: 'cust-foot-cell' },
          React.createElement('span', { className: 'cust-foot-lab' }, '% s/aporte'),
          React.createElement('span', { className: 'cust-foot-val mono', style: { color: gain >= 0 ? 'var(--pos)' : 'var(--neg)' } },
            (gain >= 0 ? '+' : '') + S.num(gainPct, 1) + '%'))),

      React.createElement('div', { className: 'cust-sync' },
        React.createElement(Icon, { name: 'refresh', size: 11 }),
        React.createElement('span', { className: 'cust-sync-mode' }, a.sync),
        React.createElement('span', { className: 'cust-sync-when' }, '· ' + a.updated))
    );
  }

  window.Screens = window.Screens || {};
  window.Screens.invest = Invest;
})();
