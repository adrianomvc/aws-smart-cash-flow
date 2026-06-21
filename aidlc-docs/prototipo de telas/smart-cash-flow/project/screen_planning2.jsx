/* SmartCashFlow — Cenários / Simulador (interativo) */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, C = window.Charts, S = window.SCF;
  const BRL = S.BRL;

  const BASE = { saldo: 24860, safeSpend: 1240, minProj: 18120, runway: 5.4, savingRate: 28.4, monthlyNet: 5240 };

  function Scenarios({ onNav }) {
    const [purchase, setPurchase] = useState(800);
    const [installments, setInstallments] = useState(1);
    const [foodCut, setFoodCut] = useState(0);
    const [incomeDrop, setIncomeDrop] = useState(0);
    const [newSub, setNewSub] = useState(0);
    const [advance, setAdvance] = useState(false);

    const monthlyPurchase = installments > 1 ? purchase / installments : purchase;
    const foodSaving = 2640 * (foodCut / 100);
    const incomeLoss = 18420 * (incomeDrop / 100);
    const advanceCost = advance ? 2980 : 0;
    const netImpact = -monthlyPurchase + foodSaving - incomeLoss - newSub;
    const newMinProj = BASE.minProj + netImpact - advanceCost - (installments === 1 ? purchase - monthlyPurchase : 0);
    const newSafe = BASE.safeSpend - (installments === 1 ? purchase : monthlyPurchase) + foodSaving - newSub;
    const newRunway = BASE.runway + (foodSaving - newSub - incomeLoss) / 13180;
    const newSaving = BASE.savingRate + (netImpact / 18420) * 100;
    const newMonthlyNet = BASE.monthlyNet + netImpact;

    let verdict, vlabel, reasons;
    if (newMinProj > 5000 && newMonthlyNet > 0) { verdict = 'seguro'; vlabel = 'Decisão segura'; }
    else if (newMinProj > 0) { verdict = 'atencao'; vlabel = 'Requer atenção'; }
    else { verdict = 'nao'; vlabel = 'Não recomendado'; }
    reasons = [];
    if (newMinProj > 5000) reasons.push({ ok: true, t: 'Menor saldo previsto permanece confortável (' + BRL(newMinProj) + ')' });
    else if (newMinProj > 0) reasons.push({ ok: null, t: 'Saldo fica apertado no mês: menor ponto em ' + BRL(newMinProj) });
    else reasons.push({ ok: false, t: 'Saldo previsto fica negativo (' + BRL(newMinProj) + ')' });
    if (newMonthlyNet > 0) reasons.push({ ok: true, t: 'Você ainda termina o mês no positivo (' + BRL(newMonthlyNet) + ')' });
    else reasons.push({ ok: false, t: 'O mês fecharia no negativo' });
    if (newRunway >= BASE.runway) reasons.push({ ok: true, t: 'Runway se mantém ou melhora (' + S.num(newRunway, 1) + ' meses)' });
    else if (newRunway > 4) reasons.push({ ok: null, t: 'Runway cai levemente para ' + S.num(newRunway, 1) + ' meses' });
    else reasons.push({ ok: false, t: 'Runway cai abaixo do recomendado (' + S.num(newRunway, 1) + ' meses)' });

    const presets = [
      { label: 'Comprar algo de R$ 800', fn: () => { reset(); setPurchase(800); } },
      { label: 'Reduzir alimentação 15%', fn: () => { reset(); setFoodCut(15); } },
      { label: 'Antecipar uma parcela', fn: () => { reset(); setAdvance(true); } },
      { label: 'E se a receita cair 20%?', fn: () => { reset(); setIncomeDrop(20); } },
      { label: 'Nova assinatura R$ 60', fn: () => { reset(); setNewSub(60); } },
    ];
    function reset() { setPurchase(0); setInstallments(1); setFoodCut(0); setIncomeDrop(0); setNewSub(0); setAdvance(false); }

    const vmap = { seguro: { k: 'pos', ic: 'checkCircle', col: 'var(--acc)' }, atencao: { k: 'warn', ic: 'alert', col: 'var(--warn)' }, nao: { k: 'neg', ic: 'xCircle', col: 'var(--neg)' } };
    const v = vmap[verdict];

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Planejamento', title: 'Simulador de cenários', icon: 'sliders',
        sub: 'Teste uma decisão antes de tomá-la. Veja o impacto no saldo, no runway e nas metas — em tempo real.' }),

      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 } },
        presets.map((p, i) => React.createElement('button', { key: i, className: 'chip', onClick: p.fn }, React.createElement(Icon, { name: 'zap', size: 13 }), p.label))),

      React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '1fr 1fr' } },
        // controls
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Monte seu cenário', icon: 'edit',
            right: React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: reset }, React.createElement(Icon, { name: 'refresh', size: 14 }), 'Limpar') }),
          React.createElement('div', { className: 'card-body', style: { display: 'grid', gap: 18 } },
            React.createElement(SliderRow, { label: 'Valor de uma compra', value: purchase, min: 0, max: 8000, step: 50, fmt: BRL, onChange: setPurchase }),
            React.createElement('div', null,
              React.createElement('div', { className: 'sim-lab' }, React.createElement('span', null, 'Parcelar em'), React.createElement('span', { className: 'mono', style: { fontWeight: 700 } }, installments + 'x')),
              React.createElement('div', { className: 'seg', style: { width: '100%' } },
                [1, 2, 3, 6, 10, 12].map(x => React.createElement('button', { key: x, className: installments === x ? 'on' : '', style: { flex: 1 }, onClick: () => setInstallments(x) }, x + 'x')))),
            React.createElement(SliderRow, { label: 'Reduzir gastos com alimentação', value: foodCut, min: 0, max: 50, step: 5, fmt: (v) => v + '%', onChange: setFoodCut, accent: 'var(--acc)' }),
            React.createElement(SliderRow, { label: 'Queda de receita', value: incomeDrop, min: 0, max: 40, step: 5, fmt: (v) => v + '%', onChange: setIncomeDrop, accent: 'var(--neg)' }),
            React.createElement(SliderRow, { label: 'Nova assinatura mensal', value: newSub, min: 0, max: 500, step: 10, fmt: BRL, onChange: setNewSub, accent: 'var(--warn)' }),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 10 } },
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, 'Antecipar 1 parcela do financiamento'),
                React.createElement('div', { className: 't-sub' }, 'Desembolso extra de R$ 2.980 este mês')),
              React.createElement(UI.Toggle, { on: advance, onChange: setAdvance })))),

        // result
        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, { className: 'card-pad', style: { borderColor: v.col + '44', background: 'linear-gradient(135deg, ' + v.col + '0f, var(--card) 60%)' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 } },
              React.createElement('span', { className: 'goal-ic', style: { width: 40, height: 40, background: v.col, color: '#fff' } }, React.createElement(Icon, { name: v.ic, size: 22 })),
              React.createElement('div', null,
                React.createElement('div', { className: 'eyebrow' }, 'Recomendação'),
                React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, color: v.col, letterSpacing: '-.3px' } }, vlabel)),
              React.createElement('span', { style: { marginLeft: 'auto' } }, React.createElement(UI.Prov, { k: 'est', withLabel: false }))),
            React.createElement('div', { style: { display: 'grid', gap: 9 } },
              reasons.map((r, i) => React.createElement('div', { key: i, style: { display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 } },
                React.createElement('span', { style: { color: r.ok === true ? 'var(--acc)' : r.ok === false ? 'var(--neg)' : 'var(--warn)', flex: 'none', marginTop: 1 } }, React.createElement(Icon, { name: r.ok === true ? 'check' : r.ok === false ? 'x' : 'minus', size: 14 })),
                r.t)))),

          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 12 } }, 'Impacto nos indicadores'),
            React.createElement('div', { style: { display: 'grid', gap: 12 } },
              React.createElement(ImpactRow, { label: 'Menor saldo previsto', before: BASE.minProj, after: newMinProj, money: true }),
              React.createElement(ImpactRow, { label: 'Gasto seguro restante', before: BASE.safeSpend, after: newSafe, money: true }),
              React.createElement(ImpactRow, { label: 'Resultado do mês', before: BASE.monthlyNet, after: newMonthlyNet, money: true }),
              React.createElement(ImpactRow, { label: 'Runway financeiro', before: BASE.runway, after: newRunway, money: false, unit: ' meses', dec: 1 }),
              React.createElement(ImpactRow, { label: 'Saving rate', before: BASE.savingRate, after: newSaving, money: false, unit: '%', dec: 1 }))),

          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement(Icon, { name: 'flag', size: 16, style: { color: 'var(--ink-3)' } }),
              React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, 'Impacto nas metas'),
              React.createElement('span', { style: { marginLeft: 'auto', fontSize: 12.5, color: netImpact >= 0 ? 'var(--acc)' : 'var(--neg)', fontWeight: 600 } },
                netImpact >= 0 ? 'Acelera reserva em ' + Math.round(Math.abs(netImpact) / 1200 * 30) + ' dias' : 'Atrasa reserva em ' + Math.round(Math.abs(netImpact) / 1200 * 30) + ' dias')),
            React.createElement('button', { className: 'btn btn-ghost btn-sm', style: { marginTop: 12, width: '100%' }, onClick: () => onNav('goals') }, 'Ver metas afetadas', React.createElement(Icon, { name: 'chevR', size: 14 }))))));
  }

  function SliderRow({ label, value, min, max, step, fmt, onChange, accent = 'var(--acc)' }) {
    return React.createElement('div', null,
      React.createElement('div', { className: 'sim-lab' }, React.createElement('span', null, label), React.createElement('span', { className: 'mono', style: { fontWeight: 700, color: value > 0 ? accent : 'var(--ink-3)' } }, fmt(value))),
      React.createElement('input', { type: 'range', min, max, step, value, onChange: (e) => onChange(+e.target.value), className: 'rng', style: { accentColor: accent } }));
  }

  function ImpactRow({ label, before, after, money, unit = '', dec = 0 }) {
    const f = (v) => money ? BRL(v) : S.num(v, dec) + unit;
    const improved = after >= before;
    const changed = Math.abs(after - before) > 0.01;
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', flex: 1 } }, label),
      React.createElement('span', { className: 'mono', style: { fontSize: 12.5, color: 'var(--ink-faint)', textDecoration: changed ? 'line-through' : 'none' } }, f(before)),
      changed && React.createElement(Icon, { name: 'chevR', size: 13, style: { color: 'var(--ink-faint)' } }),
      changed && React.createElement('span', { className: 'mono', style: { fontSize: 13, fontWeight: 700, color: improved ? 'var(--acc)' : 'var(--neg)' } }, f(after)));
  }

  window.Screens = window.Screens || {};
  window.Screens.scenarios = Scenarios;
})();
