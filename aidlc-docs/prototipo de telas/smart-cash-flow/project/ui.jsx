/* SmartCashFlow — UI primitives. Provenance badges are first-class. */
(function () {
  const { useState } = React;
  const Icon = window.Icon;

  // ---------- Provenance badge (real | est | integ | future | low) ----------
  const PROV = {
    real:   { cls: 'b-real',   icon: 'checkCircle', label: 'Real',        long: 'Dado real, calculado a partir das suas transações importadas.' },
    est:    { cls: 'b-est',    icon: 'sparkles',    label: 'Estimado',    long: 'Valor estimado a partir de médias e tendências. Pode variar.' },
    integ:  { cls: 'b-integ',  icon: 'link',        label: 'A integrar',  long: 'Depende de saldo bancário integrado. Mostramos uma estimativa por ora.' },
    future: { cls: 'b-future', icon: 'sparkles',    label: 'Visão futura',long: 'Este indicador faz parte da visão futura do produto.' },
    low:    { cls: 'b-low',    icon: 'alert',       label: 'Baixa conf.', long: 'Há poucos dados para este cálculo. Importe mais extratos para melhorar.' },
  };
  function Prov({ k, withLabel = true, mono = false }) {
    const p = PROV[k]; if (!p) return null;
    return React.createElement('span', { className: 'tip', style: { display: 'inline-flex' } },
      React.createElement('span', { className: `badge ${p.cls}${mono ? ' tag-mono' : ''}` },
        React.createElement(Icon, { name: p.icon, size: 12 }),
        withLabel && p.label),
      React.createElement('span', { className: 'tip-pop' }, p.long));
  }

  // ---------- Generic badge ----------
  function Badge({ kind = 'neutral', icon, children, mono = false }) {
    return React.createElement('span', { className: `badge b-${kind}${mono ? ' tag-mono' : ''}` },
      icon && React.createElement(Icon, { name: icon, size: 12 }), children);
  }

  // ---------- Delta (up/down %) ----------
  function Delta({ v, suffix = '%', invert = false }) {
    if (v === 0 || v == null) return React.createElement('span', { className: 'delta', style: { color: 'var(--ink-faint)' } }, '—');
    const good = invert ? v < 0 : v > 0;
    return React.createElement('span', { className: 'delta ' + (good ? 'up' : 'down') },
      React.createElement(Icon, { name: v > 0 ? 'up' : 'down', size: 12 }),
      window.SCF.num(Math.abs(v), Math.abs(v) % 1 ? 1 : 0) + suffix);
  }

  // ---------- Card ----------
  function Card({ children, className = '', style, pad, ...rest }) {
    return React.createElement('div', { className: `card ${className}`, style: pad ? { ...style, padding: pad === true ? '18px 20px' : pad } : style, ...rest }, children);
  }
  function CardHead({ title, sub, icon, right, prov }) {
    return React.createElement('div', { className: 'card-head' },
      icon && React.createElement('div', { className: 'kpi-ic', style: { width: 28, height: 28 } }, React.createElement(Icon, { name: icon, size: 15 })),
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { className: 'ttl' }, title),
        sub && React.createElement('div', { className: 'sub' }, sub)),
      React.createElement('div', { className: 'spacer' }),
      prov && React.createElement(Prov, { k: prov, withLabel: true }),
      right);
  }

  // ---------- Section header ----------
  function Section({ title, sub, eyebrow, right, icon, children, style }) {
    return React.createElement('div', { style: { marginBottom: 14, ...style } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 12 } },
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          eyebrow && React.createElement('div', { className: 'eyebrow', style: { marginBottom: 5 } }, eyebrow),
          React.createElement('h2', { className: 'section-title' },
            icon && React.createElement('span', { style: { color: 'var(--acc)', display: 'inline-flex' } }, React.createElement(Icon, { name: icon, size: 18 })),
            title),
          sub && React.createElement('div', { className: 'section-sub' }, sub)),
        right),
      children);
  }

  // ---------- KPI tile ----------
  function Kpi({ label, value, cur = 'R$', unit, icon, prov, delta, deltaInvert, sub, spark, sparkColor, big = false, hint }) {
    return React.createElement('div', { className: 'kpi' },
      React.createElement('div', { className: 'kpi-top' },
        icon && React.createElement('div', { className: 'kpi-ic' }, React.createElement(Icon, { name: icon, size: 15 })),
        React.createElement('span', { className: 'kpi-label' }, label),
        hint && React.createElement('span', { className: 'tip', style: { marginLeft: 'auto', display: 'inline-flex', color: 'var(--ink-faint)' } },
          React.createElement(Icon, { name: 'info', size: 13 }),
          React.createElement('span', { className: 'tip-pop' }, hint)),
        !hint && prov && React.createElement('div', { style: { marginLeft: 'auto' } }, React.createElement(Prov, { k: prov, withLabel: false }))),
      React.createElement('div', { className: 'kpi-val', style: big ? { fontSize: 30 } : null },
        cur && React.createElement('span', { className: 'cur' }, cur + ' '),
        value, unit && React.createElement('span', { style: { fontSize: '.62em', color: 'var(--ink-3)', fontWeight: 500 } }, unit)),
      (sub || delta != null || (hint && prov)) && React.createElement('div', { className: 'kpi-sub' },
        delta != null && React.createElement(Delta, { v: delta, invert: deltaInvert }),
        sub, hint && prov && React.createElement(Prov, { k: prov, withLabel: false })),
      spark && React.createElement('div', { className: 'kpi-spark' }, React.createElement(window.Charts.Spark, { data: spark, color: sparkColor || 'var(--acc)', w: 70, h: 28 })));
  }

  // ---------- Progress bar with status ----------
  function Bar({ value, max, color, status }) {
    const pct = Math.min(100, (value / max) * 100);
    const c = color || (status === 'over' ? 'var(--neg)' : status === 'warn' ? 'var(--warn)' : 'var(--acc)');
    return React.createElement('div', { className: 'track' }, React.createElement('div', { className: 'fill', style: { width: pct + '%', background: c } }));
  }

  // ---------- Category chip (dot + label) ----------
  function Cat({ k, size = 9 }) {
    const c = window.SCF.CATS[k] || { label: k, color: 'var(--ink-faint)' };
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7 } },
      React.createElement('span', { className: 'catdot', style: { width: size, height: size, background: c.color } }),
      React.createElement('span', null, c.label));
  }

  // ---------- Empty / state ----------
  function State({ icon = 'folder', title, children, action }) {
    return React.createElement('div', { className: 'state' },
      React.createElement('div', { className: 'state-ic' }, React.createElement(Icon, { name: icon, size: 24 })),
      React.createElement('h4', null, title),
      children && React.createElement('p', null, children),
      action);
  }

  // ---------- Skeleton block ----------
  function Skel({ w = '100%', h = 16, r = 6, style }) {
    return React.createElement('div', { className: 'skel', style: { width: w, height: h, borderRadius: r, ...style } });
  }

  // ---------- Alert / insight row ----------
  function Alert({ type = 'info', icon, title, children, action }) {
    const ic = icon || { warn: 'alert', neg: 'alert', info: 'info', pos: 'checkCircle' }[type];
    return React.createElement('div', { className: `alert ${type}` },
      React.createElement('div', { className: 'alert-ic' }, React.createElement(Icon, { name: ic, size: 17 })),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { className: 'a-ttl' }, title),
        children && React.createElement('div', { className: 'a-txt' }, children),
        action && React.createElement('div', { style: { marginTop: 9 } }, action)));
  }

  // ---------- Future module banner ----------
  function FutureBanner({ title, children }) {
    return React.createElement('div', { className: 'alert info hatch', style: { borderColor: '#d6cef2', background: 'var(--st-future-soft)' } },
      React.createElement('div', { className: 'alert-ic', style: { background: 'var(--st-future)' } }, React.createElement(Icon, { name: 'sparkles', size: 17 })),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { className: 'a-ttl' }, title || 'Módulo da visão futura'),
        React.createElement('div', { className: 'a-txt' }, children || 'A interface abaixo representa como este módulo funcionará. Os dados são ilustrativos até a funcionalidade ser ativada para o seu workspace.')));
  }

  // ---------- Tabs ----------
  function Tabs({ tabs, value, onChange }) {
    return React.createElement('div', { className: 'seg' },
      tabs.map(t => React.createElement('button', { key: t.id, className: value === t.id ? 'on' : '', onClick: () => onChange(t.id) },
        t.label, t.count != null && React.createElement('span', { style: { marginLeft: 6, opacity: .6, fontVariantNumeric: 'tabular-nums' } }, t.count))));
  }

  // ---------- Toggle switch ----------
  function Toggle({ on, onChange }) {
    return React.createElement('button', { onClick: () => onChange(!on), style: { width: 38, height: 22, borderRadius: 20, background: on ? 'var(--acc)' : 'var(--line-strong)', position: 'relative', transition: 'background .18s', flex: 'none' } },
      React.createElement('span', { style: { position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left .18s' } }));
  }

  window.UI = { Prov, PROV, Badge, Delta, Card, CardHead, Section, Kpi, Bar, Cat, State, Skel, Alert, FutureBanner, Tabs, Toggle };
})();
