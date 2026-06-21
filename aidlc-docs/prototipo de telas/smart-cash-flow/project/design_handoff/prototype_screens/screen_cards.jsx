/* SmartCashFlow — Cartões de Crédito (prioridade 6) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  function Cards({ onNav }) {
    const [active, setActive] = useState(0);
    const card = S.cards[active];
    const avail = card.limit - card.used;

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Planejamento', title: 'Cartões de Crédito', icon: 'card',
        sub: 'Faturas, limites, vencimentos e parcelados. Compra, fatura e pagamento são tratados separadamente para evitar dupla contagem.',
        right: React.createElement('button', { className: 'btn btn-ghost btn-sm' }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Adicionar cartão') }),

      // card selector
      React.createElement('div', { style: { display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' } },
        S.cards.map((c, i) => React.createElement('button', { key: i, onClick: () => setActive(i),
          className: 'cc' + (active === i ? ' on' : ''),
          style: { background: 'linear-gradient(135deg,' + c.color + ',' + shade(c.color) + ')' } },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
            React.createElement('span', { style: { fontWeight: 700, fontSize: 15 } }, c.name),
            React.createElement('span', { style: { fontSize: 11, opacity: .8, fontFamily: 'var(--font-mono)' } }, c.brand)),
          React.createElement('div', { style: { fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: 2, marginTop: 18 } }, '•••• ' + c.last),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 } },
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 9.5, opacity: .75, textTransform: 'uppercase', letterSpacing: .5 } }, 'Fatura atual'), React.createElement('div', { style: { fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' } }, BRL(c.invoice))),
            React.createElement('div', { style: { textAlign: 'right' } }, React.createElement('div', { style: { fontSize: 9.5, opacity: .75, textTransform: 'uppercase', letterSpacing: .5 } }, 'Vence'), React.createElement('div', { style: { fontWeight: 700, fontSize: 13 } }, c.due + '/jun')))))),

      // invoice detail KPIs
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Fatura atual', value: S.num(card.invoice), cur: 'R$', icon: 'receipt', prov: 'real', sub: 'fecha ' + card.close + '/jun' }),
        React.createElement(UI.Kpi, { label: 'Limite disponível', value: S.num(avail), cur: 'R$', icon: 'wallet', prov: 'real', sub: 'de ' + BRL(card.limit) }),
        React.createElement(UI.Kpi, { label: 'Parcelado futuro', value: S.num(card.parcelado), cur: 'R$', icon: 'repeat', prov: 'real', hint: 'Compras parceladas que ainda vão pesar nas próximas faturas.' }),
        React.createElement('div', { className: 'kpi' },
          React.createElement('div', { className: 'kpi-top' }, React.createElement('div', { className: 'kpi-ic' }, React.createElement(Icon, { name: 'star', size: 15 })), React.createElement('span', { className: 'kpi-label' }, 'Melhor dia de compra')),
          React.createElement('div', { className: 'kpi-val' }, 'Dia ', card.bestDay),
          React.createElement('div', { className: 'kpi-sub' }, 'maior prazo até o pagamento'))),

      // limit usage + 4 stages
      React.createElement(UI.Card, { className: 'card-pad', style: { marginBottom: 16 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
          React.createElement('span', { className: 'eyebrow' }, 'Uso do limite'),
          React.createElement('span', { className: 'mono', style: { fontSize: 12.5, color: 'var(--ink-3)' } }, BRL(card.used) + ' de ' + BRL(card.limit) + ' · ' + card.util + '%')),
        React.createElement('div', { className: 'track', style: { height: 12 } }, React.createElement('div', { className: 'fill', style: { width: card.util + '%', background: card.util > 70 ? 'var(--warn)' : 'var(--acc)' } })),
        card.util > 55 && React.createElement('div', { style: { marginTop: 12 } }, React.createElement(UI.Alert, { type: 'warn', title: 'Comprometimento do limite em ' + card.util + '%' }, 'Acima de 70% o score de crédito pode ser afetado. Considere antecipar parte da fatura ou reduzir novas compras parceladas.'))),

      // the 4 stages explainer
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(StageCard, { ic: 'card', tone: 'var(--info)', title: 'Compra', desc: 'Lançamento no cartão. Ainda não é despesa de caixa.', amount: 'R$ 8.420 no ciclo' }),
        React.createElement(StageCard, { ic: 'receipt', tone: 'var(--warn)', title: 'Fatura', desc: 'Soma das compras do ciclo. Vence dia ' + card.due + '.', amount: BRL(card.invoice) }),
        React.createElement(StageCard, { ic: 'check', tone: 'var(--acc)', title: 'Pagamento', desc: 'Saída de caixa real. Concilia a fatura — sem dupla contagem.', amount: 'a conciliar' }),
        React.createElement(StageCard, { ic: 'repeat', tone: 'var(--st-future)', title: 'Parcela futura', desc: 'Compromete as próximas faturas.', amount: BRL(card.parcelado) })),

      React.createElement('div', { className: 'dash-main' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Lançamentos da fatura', sub: card.name + ' · ciclo atual', icon: 'list', prov: 'real',
            right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onNav('transactions') }, 'Ver todos') }),
          React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Data'), React.createElement('th', null, 'Descrição'), React.createElement('th', null, 'Categoria'), React.createElement('th', { className: 'num' }, 'Valor'))),
            React.createElement('tbody', null, S.cardTx.map((t, i) => React.createElement('tr', { key: i },
              React.createElement('td', { className: 'mono t-sub' }, t.date),
              React.createElement('td', null, React.createElement('span', { className: 't-desc' }, t.desc), t.inst && React.createElement('span', { className: 'pill', style: { marginLeft: 8, fontSize: 10 } }, 'Parcela ' + t.inst)),
              React.createElement('td', null, React.createElement(UI.Cat, { k: t.cat })),
              React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, BRL(t.value))))))),

        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, { className: 'card-pad', style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            React.createElement('div', { className: 'eyebrow', style: { alignSelf: 'flex-start', marginBottom: 12 } }, 'Gastos por categoria'),
            React.createElement(C.Donut, { data: S.cardCats.map(c => ({ value: c.value, color: S.CATS[c.key].color })), size: 150, thickness: 22,
              center: React.createElement('div', null, React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 } }, BRL(card.used)), React.createElement('div', { className: 't-sub' }, 'usado')) }),
            React.createElement('div', { style: { marginTop: 14, width: '100%', display: 'grid', gap: 8 } },
              S.cardCats.map((c, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 } },
                React.createElement('span', { className: 'catdot', style: { background: S.CATS[c.key].color } }),
                React.createElement('span', { style: { flex: 1, color: 'var(--ink-2)' } }, S.CATS[c.key].label),
                React.createElement('span', { className: 'mono', style: { fontWeight: 600 } }, BRL(c.value)))))),
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
              React.createElement('span', { className: 'goal-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)' } }, React.createElement(Icon, { name: 'check', size: 15 })),
              React.createElement('span', { style: { fontWeight: 700, fontSize: 14 } }, 'Conciliação de pagamento')),
            React.createElement('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.5 } },
              'Ao registrar o pagamento da fatura, vinculamos à fatura correspondente. O valor entra como saída de caixa uma única vez.'),
            React.createElement('button', { className: 'btn btn-primary btn-sm', style: { width: '100%' } }, 'Conciliar fatura de junho'))))));
  }

  function StageCard({ ic, tone, title, desc, amount }) {
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
        React.createElement('span', { className: 'goal-ic', style: { background: tone + '1e', color: tone } }, React.createElement(Icon, { name: ic, size: 15 })),
        React.createElement('span', { style: { fontWeight: 700, fontSize: 13.5 } }, title)),
      React.createElement('p', { style: { fontSize: 11.5, color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.45, minHeight: 48 } }, desc),
      React.createElement('div', { className: 'mono', style: { fontSize: 12.5, fontWeight: 700, color: tone } }, amount));
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) - 30, g = ((n >> 8) & 255) - 20, b = (n & 255) - 10;
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  window.Screens = window.Screens || {};
  window.Screens.cards = Cards;
})();
