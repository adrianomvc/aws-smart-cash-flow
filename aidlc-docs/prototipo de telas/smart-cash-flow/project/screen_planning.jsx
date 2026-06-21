/* SmartCashFlow — Planejamento / Projeção (prioridade 2) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  function Planning({ onNav }) {
    const [h, setH] = useState(30);
    const horizon = S.projection.horizons.find(x => x.d === h);
    const riskMap = { low: { k: 'pos', label: 'Risco baixo', txt: 'Sem risco de saldo negativo no período.' }, medium: { k: 'warn', label: 'Atenção', txt: 'Saldo fica apertado, mas positivo.' }, high: { k: 'neg', label: 'Risco alto', txt: 'Possível saldo negativo. Ação recomendada.' } };
    const risk = riskMap[horizon.risk];

    // chart series cropped to horizon
    const months = h === 30 ? 1 : h === 60 ? 2 : h === 90 ? 3 : 12;
    const slice = S.projection.series.slice(0, months + 1);
    const mLabels = ['jun','jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun'];
    const mk = (key, label, color, dashed) => ({ label, color, dashed, area: key === 'prob', data: slice.map((p, i) => ({ x: i % Math.ceil(slice.length / 6) === 0 ? mLabels[i] : '', y: p[key] })) });
    const series = [mk('best', 'Melhor cenário', '#7fbf9f', true), mk('prob', 'Cenário provável', 'var(--acc)'), mk('worst', 'Pior cenário', '#d99a8f', true)];

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, {
        eyebrow: 'Planejamento', title: 'Projeção de saldo futuro', icon: 'trend',
        sub: 'Antecipe riscos e veja para onde seu saldo caminha. Distinguimos dados reais, estimados e premissas.',
        right: React.createElement('div', { className: 'seg' },
          S.projection.horizons.map(x => React.createElement('button', { key: x.d, className: h === x.d ? 'on' : '', onClick: () => setH(x.d) }, x.d === 365 ? '12 meses' : x.d + ' dias')))
      }),

      // top KPIs of horizon
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Saldo ao fim do período', value: S.num(horizon.end), cur: 'R$', icon: 'wallet', prov: horizon.prov }),
        React.createElement(UI.Kpi, { label: 'Menor saldo previsto', value: S.num(horizon.min), cur: 'R$', icon: 'down', prov: 'est', sub: 'em ' + horizon.minDay }),
        React.createElement(UI.Kpi, { label: 'Variação no período', value: S.num(horizon.end - 24860), cur: 'R$', icon: 'trend', prov: horizon.prov, delta: +((horizon.end - 24860) / 24860 * 100) }),
        React.createElement('div', { className: 'kpi', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
          React.createElement('div', { className: 'kpi-top' }, React.createElement('div', { className: 'kpi-ic' }, React.createElement(Icon, { name: 'shield', size: 15 })), React.createElement('span', { className: 'kpi-label' }, 'Risco de saldo negativo')),
          React.createElement('div', { style: { marginTop: 2 } }, React.createElement(UI.Badge, { kind: risk.k, icon: risk.k === 'pos' ? 'checkCircle' : 'alert' }, risk.label)),
          React.createElement('div', { className: 'kpi-sub', style: { marginTop: 8 } }, risk.txt))),

      // main projection chart
      React.createElement('div', { className: 'dash-main' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Trajetória do saldo', sub: 'Cenários para os próximos ' + (h === 365 ? '12 meses' : h + ' dias'), icon: 'bars', prov: 'est' }),
          React.createElement('div', { className: 'card-body' },
            React.createElement(C.LineChart, { series, height: 280 }),
            React.createElement('div', { className: 'legend', style: { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' } },
              React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz dash', style: { borderColor: '#7fbf9f' } }), 'Melhor cenário'),
              React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz', style: { background: 'var(--acc)' } }), 'Cenário provável'),
              React.createElement('span', { className: 'legend-item' }, React.createElement('span', { className: 'lz dash', style: { borderColor: '#d99a8f' } }), 'Pior cenário')))),

        // assumptions panel
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Premissas usadas', sub: 'Base do cálculo', icon: 'sliders' }),
          React.createElement('div', { style: { padding: '6px 8px' } },
            S.projection.assumptions.map((a, i) => React.createElement('div', { key: i, className: 'row-item', style: { padding: '9px 10px' } },
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 } }, a.label),
                React.createElement('div', { className: 'mono', style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 1 } }, a.value)),
              React.createElement(UI.Prov, { k: a.prov, withLabel: false })))),
          React.createElement('div', { style: { padding: '0 14px 14px' } },
            React.createElement('button', { className: 'btn btn-ghost btn-sm', style: { width: '100%' }, onClick: () => onNav('settings') }, React.createElement(Icon, { name: 'cog', size: 14 }), 'Ajustar premissas'))),
      ),

      React.createElement('div', { style: { height: 16 } }),

      // scenarios trio + future events
      React.createElement('div', { className: 'grid cols-3' },
        React.createElement(ScenarioCard, { tone: 'pos', title: 'Melhor cenário', value: horizon.end + 6200, note: 'Renda extra + cortes em lazer e delivery.', prov: 'est' }),
        React.createElement(ScenarioCard, { tone: 'acc', title: 'Cenário provável', value: horizon.end, note: 'Mantendo o padrão atual de receitas e gastos.', prov: 'est', main: true }),
        React.createElement(ScenarioCard, { tone: 'neg', title: 'Pior cenário', value: horizon.min - 1800, note: 'Queda de receita e despesas variáveis acima da média.', prov: 'est' })),

      React.createElement('div', { style: { height: 16 } }),

      React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '1.4fr 1fr' } },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Eventos futuros relevantes', sub: 'O que move o saldo no período', icon: 'calendar' }),
          React.createElement('div', { style: { padding: '6px 8px' } },
            S.upcoming.slice(0, 5).map((u, i) => React.createElement('div', { key: i, className: 'row-item' },
              React.createElement('div', { className: 'date-chip' }, React.createElement('span', { className: 'd' }, u.day), React.createElement('span', { className: 'm' }, u.month)),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { className: 't-desc', style: { fontSize: 13 } }, u.title),
                React.createElement('div', { className: 't-sub' }, u.kind)),
              React.createElement('span', { className: 'sdot ' + u.status }),
              React.createElement('div', { style: { fontWeight: 700, color: 'var(--neg)', fontVariantNumeric: 'tabular-nums', width: 90, textAlign: 'right' } }, BRL(u.value)))))),
        React.createElement(UI.Card, { className: 'card-pad', style: { display: 'flex', flexDirection: 'column' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
            React.createElement('span', { className: 'goal-ic', style: { background: 'var(--warn-soft)', color: 'var(--warn)' } }, React.createElement(Icon, { name: 'alert', size: 15 })),
            React.createElement('span', { className: 'section-title', style: { fontSize: 15 } }, 'O que exige ação')),
          React.createElement(UI.Alert, { type: 'warn', title: 'Concentração de vencimentos em 10–12/jun', }, 'Mantenha ao menos R$ 7.600 disponível antes do dia 10 para cobrir financiamento e fatura sem usar a reserva.'),
          React.createElement('div', { style: { height: 10 } }),
          React.createElement(UI.Alert, { type: 'info', title: '13º e renda extra não considerados' }, 'A projeção é conservadora. Receitas sazonais elevariam o saldo final — adicione-as em Cenários.'),
          React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 14 }, onClick: () => onNav('scenarios') }, React.createElement(Icon, { name: 'sliders', size: 15 }), 'Simular um cenário'))));
  }

  function ScenarioCard({ tone, title, value, note, prov, main }) {
    const col = tone === 'neg' ? 'var(--neg)' : tone === 'pos' ? 'var(--acc)' : 'var(--acc-ink)';
    return React.createElement(UI.Card, { className: 'card-pad', style: main ? { borderColor: 'var(--acc-soft-2)', boxShadow: 'var(--sh-md)' } : null },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
        React.createElement('span', { className: 'sdot', style: { background: col, width: 9, height: 9 } }),
        React.createElement('span', { style: { fontWeight: 700, fontSize: 13.5 } }, title),
        main && React.createElement('span', { style: { marginLeft: 'auto' }, className: 'badge b-pos' }, 'principal'),
        !main && React.createElement('span', { style: { marginLeft: 'auto' } }, React.createElement(UI.Prov, { k: prov, withLabel: false }))),
      React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, letterSpacing: '-.6px', color: col, fontVariantNumeric: 'tabular-nums' } }, BRL(value)),
      React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.5 } }, note));
  }

  window.Screens = window.Screens || {};
  window.Screens.planning = Planning;
})();
