/* SmartCashFlow — Calendário, Orçamentos, Metas */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  // ============ CALENDÁRIO ============
  function Calendar({ onNav }) {
    const [filter, setFilter] = useState('all');
    // June 2026 starts on Monday (1). 30 days.
    const firstDow = 1; // 0=Sun
    const evMap = {};
    S.upcoming.forEach(u => { (evMap[u.day] = evMap[u.day] || []).push(u); });
    // add salary events
    evMap[5] = [{ title: 'Salário', cat: 'renda', value: 8200, status: 'paid', kind: 'Renda' }];
    evMap[15] = [{ title: 'Salário', cat: 'renda', value: 10220, status: 'pred', kind: 'Renda' }, ...(evMap[15] || [])];
    const crit = [10, 12];
    const today = 6;

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= 30; d++) cells.push(d);

    const types = [
      { id: 'all', label: 'Todos' }, { id: 'renda', label: 'Receitas' },
      { id: 'moradia', label: 'Contas' }, { id: 'servicos', label: 'Faturas' }, { id: 'investido', label: 'Metas' },
    ];

    // Aggregates
    const allEvts = Object.values(evMap).flat();
    const totalOut = allEvts.filter(e => e.value < 0).reduce((s, e) => s + Math.abs(e.value), 0);
    const totalIn  = allEvts.filter(e => e.value > 0).reduce((s, e) => s + e.value, 0);
    const daysWith = Object.keys(evMap).length;
    const heaviest = Object.entries(evMap).map(([d, es]) => ({
      day: +d, impact: es.reduce((s, e) => s + Math.min(0, e.value), 0)
    })).sort((a, b) => a.impact - b.impact)[0] || { day: '—', impact: 0 };
    const byCat = {};
    allEvts.filter(e => e.value < 0).forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + Math.abs(e.value); });
    const catSorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const catTotal = catSorted.reduce((s, [, v]) => s + v, 0) || 1;
    const next7 = S.upcoming.filter(u => u.day >= today && u.day <= today + 9).slice(0, 6);

    // Weekday averages (June 2026 starts Monday)
    const WD = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    const wdBuckets = WD.map(() => ({ sum: 0, n: 0 }));
    S.daily.forEach(d => {
      const w = (d.d - 1) % 7;
      wdBuckets[w].sum += Math.abs(d.exp);
      wdBuckets[w].n += 1;
    });
    const wdAvg = wdBuckets.map((b, i) => ({ wd: WD[i], avg: b.sum / Math.max(1, b.n), n: b.n }));
    const wdMax = Math.max(...wdAvg.map(w => w.avg));
    const wdTop = [...wdAvg].sort((a, b) => b.avg - a.avg)[0];
    const wdLow = [...wdAvg].sort((a, b) => a.avg - b.avg)[0];
    const wdAvgWk = wdAvg.reduce((s, w) => s + w.avg, 0) / 7;
    const wdAvgWeek = wdAvg.slice(0, 5).reduce((s, w) => s + w.avg, 0) / 5;
    const wdAvgWeekend = (wdAvg[5].avg + wdAvg[6].avg) / 2;

    // Abbreviated category labels (fit narrow cells)
    const CATABBR = {
      moradia: 'Casa', alimentacao: 'Alim.', educacao: 'Educ.', transporte: 'Transp.',
      saude: 'Saúde', lazer: 'Lazer', assinaturas: 'Assin.', mercado: 'Merc.',
      servicos: 'Serv.', investido: 'Invest.', renda: 'Renda', outros: 'Outros',
    };


    // Compact value: -2,9k / +10,2k / 340
    const shortVal = v => {
      const a = Math.abs(v);
      const sign = v < 0 ? '−' : (v > 0 ? '+' : '');
      if (a >= 1000) return sign + (a / 1000).toFixed(1).replace('.', ',') + 'k';
      return sign + Math.round(a);
    };

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Visão', title: 'Calendário Financeiro', icon: 'calendar',
        sub: 'Compromissos por data, com categorias, valores e impacto previsto no saldo.',
        right: React.createElement('div', { className: 'period' },
          React.createElement('button', { className: 'period-arrow' }, React.createElement(Icon, { name: 'chevL', size: 16 })),
          React.createElement('div', { className: 'period-current' }, 'Junho 2026'),
          React.createElement('button', { className: 'period-arrow' }, React.createElement(Icon, { name: 'chevR', size: 16 }))) }),

      // Slim KPI strip
      React.createElement('div', { className: 'cal-strip' },
        React.createElement('div', { className: 'cal-strip-cell' },
          React.createElement('span', { className: 'cs-lab' }, 'A pagar'),
          React.createElement('span', { className: 'cs-val neg' }, '− R$ ' + S.num(totalOut)),
          React.createElement('span', { className: 'cs-sub' }, allEvts.filter(e=>e.value<0).length + ' lançamentos')),
        React.createElement('div', { className: 'cal-strip-cell' },
          React.createElement('span', { className: 'cs-lab' }, 'A receber'),
          React.createElement('span', { className: 'cs-val pos' }, '+ R$ ' + S.num(totalIn)),
          React.createElement('span', { className: 'cs-sub' }, '2 entradas')),
        React.createElement('div', { className: 'cal-strip-cell' },
          React.createElement('span', { className: 'cs-lab' }, 'Dias com lançamento'),
          React.createElement('span', { className: 'cs-val' }, daysWith + ' / 30'),
          React.createElement('span', { className: 'cs-sub' }, 'no mês')),
        React.createElement('div', { className: 'cal-strip-cell warn' },
          React.createElement('span', { className: 'cs-lab' }, 'Dia mais pesado'),
          React.createElement('span', { className: 'cs-val' }, heaviest.day + '/jun'),
          React.createElement('span', { className: 'cs-sub' }, '− R$ ' + S.num(Math.abs(heaviest.impact))))),

      // Filters
      React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' } },
        types.map(t => React.createElement('button', { key: t.id, className: 'chip' + (filter === t.id ? ' on' : ''), onClick: () => setFilter(t.id) }, t.label)),
        React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' } },
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot paid' }), 'Pago'),
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot pred' }), 'Previsto'),
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot est' }), 'Estimado'),
          React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'sdot late' }), 'Atrasado'))),

      React.createElement('div', { className: 'dash-main cal-layout' },
        // ---- LEFT COLUMN: calendar only ----
        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, { className: 'card-pad cal-card' },
            React.createElement('div', { className: 'cal-grid', style: { marginBottom: 6 } },
              ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => React.createElement('div', { key: d, className: 'cal-dow' }, d))),
            React.createElement('div', { className: 'cal-grid' },
            cells.map((d, i) => {
              if (d === null) return React.createElement('div', { key: i, className: 'cal-cell empty' });
              const evs = (evMap[d] || []).filter(e => filter === 'all' || e.cat === filter);
              const isCrit = crit.includes(d);
              const dayTotal = evs.reduce((s, e) => s + e.value, 0);
              return React.createElement('div', { key: i, className: 'cal-cell' + (isCrit ? ' crit' : '') + (d === today ? ' today' : '') + (evs.length === 0 ? ' quiet' : '') },
                React.createElement('div', { className: 'cal-cell-head' },
                  React.createElement('span', { className: 'cal-day' }, d),
                  evs.length > 0 && React.createElement('span', { className: 'cal-count' + (isCrit ? ' crit' : '') }, evs.length)),
                React.createElement('div', { className: 'cal-evts' },
                  evs.slice(0, 2).map((e, j) => React.createElement('div', { key: j, className: 'cal-evt', title: e.title + ' · ' + S.BRL(e.value),
                    style: { background: S.CATS[e.cat].color + '1f', color: S.CATS[e.cat].color, borderLeft: '2px solid ' + S.CATS[e.cat].color } },
                    React.createElement('span', { className: 'cal-evt-cat' }, CATABBR[e.cat] || S.CATS[e.cat].label),
                    React.createElement('span', { className: 'cal-evt-val' }, shortVal(e.value)))),
                  evs.length > 2 && React.createElement('div', { className: 'cal-more' }, '+' + (evs.length - 2) + ' mais')),
                evs.length > 1 && React.createElement('div', { className: 'cal-total', style: { color: dayTotal < 0 ? 'var(--neg)' : 'var(--pos)' } },
                  React.createElement('span', { style: { color: 'var(--ink-faint)', fontWeight: 500 } }, 'líquido'),
                  React.createElement('span', null, shortVal(dayTotal))));
            }))),

        ),

        // ---- SIDE PANELS ----
        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          // Próximos 7 dias
          React.createElement(UI.Card, null,
            React.createElement(UI.CardHead, { title: 'Próximos 7 dias', sub: next7.length + ' compromissos', icon: 'clock' }),
            React.createElement('div', { style: { padding: '6px 8px' } },
              next7.map((u, i) => React.createElement('div', { key: i, className: 'row-item', style: { cursor: 'pointer' } },
                React.createElement('div', { className: 'date-chip', style: { background: crit.includes(u.day) ? 'var(--warn-soft)' : 'var(--bg-sunken)' } },
                  React.createElement('span', { className: 'd' }, u.day),
                  React.createElement('span', { className: 'm' }, u.month)),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { className: 't-desc', style: { fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, u.title),
                  React.createElement('div', { className: 't-sub', style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { className: 'catdot', style: { background: S.CATS[u.cat].color, width: 7, height: 7 } }),
                    S.CATS[u.cat].label, ' · ', u.kind)),
                React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: u.value < 0 ? 'var(--neg)' : 'var(--pos)' } }, S.BRL(u.value)))))),

          // Distribuição por categoria
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 12 } }, 'Saídas previstas · por categoria'),
            React.createElement('div', { style: { display: 'grid', gap: 11 } },
              catSorted.map(([k, v], i) => React.createElement('div', { key: i },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12.5 } },
                  React.createElement('span', { className: 'catdot', style: { background: S.CATS[k].color } }),
                  React.createElement('span', { style: { fontWeight: 600 } }, S.CATS[k].label),
                  React.createElement('span', { style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700 } }, S.BRL(v))),
                React.createElement('div', { className: 'track thin' },
                  React.createElement('div', { className: 'fill', style: { width: (v / catTotal * 100) + '%', background: S.CATS[k].color } })),
                React.createElement('div', { className: 't-sub mono', style: { marginTop: 3 } }, S.num(v / catTotal * 100, 1) + '% do previsto'))))),

          // Dias críticos
          React.createElement(UI.Card, null,
            React.createElement(UI.CardHead, { title: 'Dias críticos', sub: 'Risco de saldo apertado', icon: 'alert' }),
            React.createElement('div', { style: { padding: '6px 8px' } },
              S.upcoming.filter(u => crit.includes(u.day)).map((u, i) => React.createElement('div', { key: i, className: 'row-item' },
                React.createElement('div', { className: 'date-chip', style: { background: 'var(--warn-soft)' } }, React.createElement('span', { className: 'd' }, u.day), React.createElement('span', { className: 'm' }, u.month)),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('div', { className: 't-desc', style: { fontSize: 12.5 } }, u.title),
                  React.createElement('div', { className: 't-sub' }, u.kind)),
                React.createElement('span', { style: { fontWeight: 700, color: 'var(--neg)', fontVariantNumeric: 'tabular-nums', fontSize: 13 } }, S.BRL(u.value)))),
              React.createElement('div', { style: { padding: '10px 12px 4px', borderTop: '1px solid var(--line)', marginTop: 4 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
                  React.createElement('span', { className: 'eyebrow' }, 'Saldo no fundo do vale'),
                  React.createElement('span', { style: { marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--warn)' } }, S.BRL(18120))),
                React.createElement(C.Spark, { data: [24.6,24.4,21.6,18.1,18.3,28.5,27.9,27.3,27.1,24.6], w: 240, h: 36, color: 'var(--warn)' })))))),


      // ============ 3-COL ROW: Média / Assinaturas / Faturas ============
      React.createElement('div', { className: 'cal-trio' },
        // ---- Card 1: Média de saídas por dia da semana ----
        React.createElement(UI.Card, { className: 'card-pad cal-trio-card' },
          React.createElement('div', { className: 'cal-trio-head' },
            React.createElement('div', null,
              React.createElement('div', { className: 'eyebrow' }, 'Visão temporal'),
              React.createElement('div', { className: 'cal-trio-title' }, 'Média por dia da semana')),
            React.createElement(UI.Prov, { k: 'real', withLabel: false })),
          React.createElement('div', { className: 'wdbars', style: { marginTop: 14, marginBottom: 14 } },
            wdAvg.map((w, i) => React.createElement('div', { key: i, className: 'wdbar' + (w.wd === wdTop.wd ? ' top' : '') + (w.wd === wdLow.wd ? ' low' : '') },
              React.createElement('div', { className: 'wdbar-val mono' }, 'R$ ' + S.num(w.avg, 0)),
              React.createElement('div', { className: 'wdbar-track' },
                React.createElement('div', { className: 'wdbar-fill', style: { height: (w.avg / wdMax * 100) + '%' } })),
              React.createElement('div', { className: 'wdbar-lab' }, w.wd)))),
          React.createElement('div', { className: 'cal-trio-stats' },
            React.createElement('div', { className: 'cts-cell' },
              React.createElement('span', { className: 'cts-lab' }, 'Melhor dia'),
              React.createElement('span', { className: 'cts-val pos' }, wdLow.wd),
              React.createElement('span', { className: 'cts-sub' }, 'R$ ' + S.num(wdLow.avg, 0) + '/dia')),
            React.createElement('div', { className: 'cts-cell' },
              React.createElement('span', { className: 'cts-lab' }, 'Pior dia'),
              React.createElement('span', { className: 'cts-val neg' }, wdTop.wd),
              React.createElement('span', { className: 'cts-sub' }, 'R$ ' + S.num(wdTop.avg, 0) + '/dia')),
            React.createElement('div', { className: 'cts-cell' },
              React.createElement('span', { className: 'cts-lab' }, 'Média diária'),
              React.createElement('span', { className: 'cts-val' }, 'R$ ' + S.num(wdAvgWk, 0)),
              React.createElement('span', { className: 'cts-sub' }, 'últimos 30 dias')))),

        // ---- Card 2: Assinaturas ----
        (function () {
          const subs = [
            { name: 'Netflix',      value: 39.90, day: 15, color: '#E50914', initial: 'N' },
            { name: 'Spotify',      value: 21.90, day: 18, color: '#1DB954', initial: 'S' },
            { name: 'Amazon Prime', value: 14.90, day: 22, color: '#1C99FF', initial: 'A' },
            { name: 'Google One',   value:  9.99, day: 25, color: '#7C3AED', initial: 'G' },
          ];
          const subsTotal = subs.reduce((s, x) => s + x.value, 0);
          const subsNext = [...subs].sort((a, b) => (a.day < today ? a.day + 30 : a.day) - (b.day < today ? b.day + 30 : b.day))[0];
          return React.createElement(UI.Card, { className: 'card-pad cal-trio-card' },
            React.createElement('div', { className: 'cal-trio-head' },
              React.createElement('div', null,
                React.createElement('div', { className: 'eyebrow' }, 'Recorrentes'),
                React.createElement('div', { className: 'cal-trio-title' }, 'Assinaturas')),
              React.createElement(UI.Badge, { kind: 'info' }, subs.length + ' ativas')),
            React.createElement('div', { className: 'cal-trio-hero' },
              React.createElement('span', { className: 'cth-lab' }, 'Total mensal'),
              React.createElement('span', { className: 'cth-val' }, 'R$ ' + S.num(subsTotal, 2)),
              React.createElement('span', { className: 'cth-sub' }, 'Próxima: ', React.createElement('b', null, subsNext.name), ' · ', subsNext.day + '/jun')),
            React.createElement('div', { className: 'sub-list' },
              subs.map((s, i) => React.createElement('div', { key: i, className: 'sub-row' },
                React.createElement('span', { className: 'sub-logo', style: { background: s.color + '22', color: s.color, border: '1px solid ' + s.color + '55' } }, s.initial),
                React.createElement('div', { className: 'sub-meta' },
                  React.createElement('span', { className: 'sub-name' }, s.name),
                  React.createElement('span', { className: 'sub-due' }, 'cobra dia ' + s.day + '/jun')),
                React.createElement('span', { className: 'sub-val mono' }, 'R$ ' + S.num(s.value, 2))))),
            React.createElement('button', { className: 'cal-trio-cta', onClick: () => onNav && onNav('transactions') },
              'Ver todas as assinaturas', React.createElement(Icon, { name: 'chevR', size: 13 })));
        })(),

        // ---- Card 3: Faturas ----
        (function () {
          const cardsList = S.cards.map(c => ({
            name: c.name, invoice: c.invoice, due: c.due,
            color: c.color, dleft: ((c.due - today + 30) % 30) || 30,
          }));
          const invTotal = cardsList.reduce((s, c) => s + c.invoice, 0);
          const renda = S.kpis.receitas.val;
          const compromisso = invTotal / renda * 100;
          const invNext = [...cardsList].sort((a, b) => a.dleft - b.dleft)[0];
          const dueStatus = (d) => d <= 7 ? 'neg' : d <= 15 ? 'warn' : 'info';
          return React.createElement(UI.Card, { className: 'card-pad cal-trio-card' },
            React.createElement('div', { className: 'cal-trio-head' },
              React.createElement('div', null,
                React.createElement('div', { className: 'eyebrow' }, 'Cartões'),
                React.createElement('div', { className: 'cal-trio-title' }, 'Faturas')),
              React.createElement(UI.Badge, { kind: 'warn' }, cardsList.length + ' cartões')),
            React.createElement('div', { className: 'cal-trio-hero' },
              React.createElement('span', { className: 'cth-lab' }, 'Total em faturas'),
              React.createElement('span', { className: 'cth-val' }, 'R$ ' + S.num(invTotal)),
              React.createElement('span', { className: 'cth-sub' },
                React.createElement('b', null, S.num(compromisso, 0) + '%'), ' da renda mensal · próxima: ', React.createElement('b', null, invNext.name), ' em ', invNext.dleft, 'd')),
            React.createElement('div', { className: 'sub-list' },
              cardsList.map((c, i) => React.createElement('div', { key: i, className: 'sub-row' },
                React.createElement('span', { className: 'sub-logo', style: { background: c.color + '22', color: c.color, border: '1px solid ' + c.color + '55' } }, c.name[0]),
                React.createElement('div', { className: 'sub-meta' },
                  React.createElement('span', { className: 'sub-name' }, c.name),
                  React.createElement('span', { className: 'sub-due' },
                    'vence ', c.due, '/jun · ',
                    React.createElement('span', { className: 'badge b-' + dueStatus(c.dleft), style: { fontSize: 9.5, padding: '1px 6px' } }, c.dleft + ' dias'))),
                React.createElement('span', { className: 'sub-val mono', style: { color: c.dleft <= 7 ? 'var(--neg)' : 'var(--ink)' } }, 'R$ ' + S.num(c.invoice))))),
            React.createElement('button', { className: 'cal-trio-cta', onClick: () => onNav && onNav('cards') },
              'Ver todas as faturas', React.createElement(Icon, { name: 'chevR', size: 13 })));
        })())

    );
  }

  // ============ ORÇAMENTOS ============
  function Budgets({ onNav }) {
    const totP = S.budgets.reduce((s, b) => s + b.planned, 0);
    const totA = S.budgets.reduce((s, b) => s + b.actual, 0);
    const statusOf = (b) => { const p = b.actual / b.planned; return p > 1 ? 'over' : p > 0.9 ? 'warn' : 'ok'; };
    const stMeta = { ok: { k: 'pos', label: 'Dentro' }, warn: { k: 'warn', label: 'Atenção' }, over: { k: 'neg', label: 'Estourado' } };

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Planejamento', title: 'Orçamentos', icon: 'target',
        sub: 'Planejado vs. realizado por categoria. Aja antes de estourar os limites.',
        right: React.createElement('button', { className: 'btn btn-ghost btn-sm' }, React.createElement(Icon, { name: 'edit', size: 14 }), 'Editar orçamento') }),

      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Orçamento do mês', value: S.num(totP), cur: 'R$', icon: 'target', prov: 'real' }),
        React.createElement(UI.Kpi, { label: 'Realizado', value: S.num(totA), cur: 'R$', icon: 'wallet', prov: 'real', sub: S.num(totA/totP*100,0) + '% consumido' }),
        React.createElement(UI.Kpi, { label: 'Saldo restante', value: S.num(totP - totA), cur: 'R$', icon: 'flow', prov: 'real' }),
        React.createElement('div', { className: 'kpi' },
          React.createElement('div', { className: 'kpi-top' }, React.createElement('div', { className: 'kpi-ic' }, React.createElement(Icon, { name: 'alert', size: 15 })), React.createElement('span', { className: 'kpi-label' }, 'Categorias em alerta')),
          React.createElement('div', { className: 'kpi-val' }, S.budgets.filter(b => statusOf(b) !== 'ok').length),
          React.createElement('div', { className: 'kpi-sub' }, '2 perto do limite, 1 estourada'))),

      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Por categoria', sub: 'Planejado × realizado · Junho 2026', icon: 'pie', prov: 'real' }),
        React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 18 } },
          S.budgets.map((b, i) => {
            const st = statusOf(b), pct = b.actual / b.planned * 100;
            return React.createElement('div', { key: i },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 } },
                React.createElement(UI.Cat, { k: b.key }),
                React.createElement('span', { style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: 13 } },
                  React.createElement('b', null, BRL(b.actual)), React.createElement('span', { className: 'muted' }, ' / ' + BRL(b.planned))),
                React.createElement('span', { style: { width: 90, textAlign: 'right' } }, React.createElement(UI.Badge, { kind: stMeta[st].k }, stMeta[st].label))),
              React.createElement('div', { className: 'track', style: { height: 10 } }, React.createElement('div', { className: 'fill', style: { width: Math.min(100, pct) + '%', background: st === 'over' ? 'var(--neg)' : st === 'warn' ? 'var(--warn)' : 'var(--acc)' } })),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 } },
                React.createElement('span', { className: 'mono t-sub' }, S.num(pct, 0) + '% consumido'),
                React.createElement('span', { className: 't-sub' }, st === 'over' ? 'Excedeu em ' + BRL(b.actual - b.planned) : 'Restam ' + BRL(b.planned - b.actual))));
          }))));
  }

  // ============ METAS ============
  function Goals({ onNav }) {
    const stMeta = { ontrack: { k: 'pos', label: 'No prazo' }, attention: { k: 'warn', label: 'Atenção' }, late: { k: 'neg', label: 'Atrasada' } };
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Planejamento', title: 'Metas', icon: 'flag',
        sub: 'Objetivos financeiros da família, com progresso e contribuição sugerida.',
        right: React.createElement('button', { className: 'btn btn-primary btn-sm' }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Nova meta') }),

      React.createElement('div', { className: 'grid cols-3' },
        S.goals.map((g, i) => {
          const pct = g.current / g.target * 100, st = stMeta[g.status];
          const color = S.CATS[g.cat].color;
          return React.createElement(UI.Card, { key: i, className: 'card-pad' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
              React.createElement('span', { className: 'goal-ic', style: { width: 38, height: 38, background: color + '1e', color } }, React.createElement(Icon, { name: g.icon, size: 19 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, g.title),
                React.createElement('div', { className: 't-sub' }, 'até ' + g.deadline)),
              React.createElement(UI.Badge, { kind: st.k }, st.label)),
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 8 } },
              React.createElement(C.Ring, { value: pct, size: 64, thickness: 7, color }, React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 } }, S.num(pct, 0) + '%')),
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.4px' } }, BRL(g.current)),
                React.createElement('div', { className: 't-sub' }, 'de ' + BRL(g.target)))),
            React.createElement('hr', { className: 'divider', style: { margin: '12px 0' } }),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5 } },
              React.createElement('span', { className: 'muted' }, 'Contribuição sugerida'),
              React.createElement('span', { className: 'mono', style: { fontWeight: 700 } }, BRL(g.monthly) + '/mês')),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 4 } },
              React.createElement('span', { className: 'muted' }, 'Impacto no orçamento'),
              React.createElement('span', { style: { fontWeight: 600, color: g.monthly > 1500 ? 'var(--warn)' : 'var(--ink-2)' } }, S.num(g.monthly / 18420 * 100, 0) + '% da renda')));
        }),
        React.createElement('button', { className: 'card', style: { border: '2px dashed var(--line-strong)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 200, color: 'var(--ink-3)', boxShadow: 'none' } },
          React.createElement('span', { className: 'goal-ic', style: { width: 40, height: 40, background: 'var(--bg-sunken)' } }, React.createElement(Icon, { name: 'plus', size: 20 })),
          React.createElement('span', { style: { fontWeight: 600, fontSize: 13.5 } }, 'Criar nova meta'),
          React.createElement('span', { style: { fontSize: 12 } }, 'Reserva, viagem, educação…'))));
  }

  window.Screens = window.Screens || {};
  window.Screens.calendar = Calendar;
  window.Screens.budgets = Budgets;
  window.Screens.goals = Goals;
})();
