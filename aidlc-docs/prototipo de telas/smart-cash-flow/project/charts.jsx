/* SmartCashFlow — SVG charts (self-contained, responsive via viewBox) */
(function () {
  const { useState } = React;

  // ---------- helpers ----------
  const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const smoothPath = (pts) => {
    if (pts.length < 2) return path(pts);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };

  // ---------- FlowChart: bars (in/out) + accumulated line + projected dashed ----------
  function FlowChart({ data, height = 260, mode = 'day', showProjected = true }) {
    const [hover, setHover] = useState(null);
    const W = 920, H = height, padX = 16, padTop = 18, padBot = 30;
    const innerW = W - padX * 2, innerH = H - padTop - padBot;
    const maxBar = Math.max(...data.map(d => Math.max(d.inc, Math.abs(d.exp)))) * 1.1 || 1;
    const accs = data.map(d => d.acc);
    const accMin = Math.min(...accs), accMax = Math.max(...accs);
    const accRange = (accMax - accMin) || 1;
    const n = data.length;
    const slot = innerW / n;
    const bw = Math.min(slot * 0.34, 16);
    const zeroY = padTop + innerH * 0.62;
    const barTop = padTop, barBot = zeroY;
    const accY = (v) => padTop + (1 - (v - accMin) / accRange) * innerH;

    const accPts = data.map((d, i) => [padX + slot * i + slot / 2, accY(d.acc)]);
    const realPts = accPts.filter((_, i) => !data[i].proj);
    const projStart = data.findIndex(d => d.proj);
    const projPts = projStart > 0 ? accPts.slice(projStart - 1) : [];

    return React.createElement('div', { style: { position: 'relative' } },
      React.createElement('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', display: 'block' }, onMouseLeave: () => setHover(null) },
        React.createElement('defs', null,
          React.createElement('linearGradient', { id: 'accFill', x1: 0, y1: 0, x2: 0, y2: 1 },
            React.createElement('stop', { offset: '0%', stopColor: 'var(--acc)', stopOpacity: .16 }),
            React.createElement('stop', { offset: '100%', stopColor: 'var(--acc)', stopOpacity: 0 }))),
        // grid baseline
        React.createElement('line', { x1: padX, x2: W - padX, y1: zeroY, y2: zeroY, stroke: 'var(--line-strong)', strokeWidth: 1 }),
        // bars
        data.map((d, i) => {
          const cx = padX + slot * i + slot / 2;
          const incH = (d.inc / maxBar) * (barBot - barTop);
          const expH = (Math.abs(d.exp) / maxBar) * (innerH - (barBot - barTop) + 0);
          const isH = hover === i;
          return React.createElement('g', { key: i, opacity: d.proj ? .55 : 1 },
            d.inc > 0 && React.createElement('rect', { x: cx - bw / 2, y: zeroY - incH, width: bw, height: incH, rx: 2, fill: 'var(--acc)', opacity: isH ? 1 : .9 }),
            Math.abs(d.exp) > 0 && React.createElement('rect', { x: cx - bw / 2, y: zeroY, width: bw, height: Math.min(expH, innerH - (zeroY - padTop)), rx: 2, fill: 'var(--neg)', opacity: isH ? .95 : .72 }));
        }),
        // accumulated area + line (real)
        realPts.length > 1 && React.createElement('path', { d: smoothPath(realPts) + ` L ${realPts[realPts.length-1][0]} ${H-padBot} L ${realPts[0][0]} ${H-padBot} Z`, fill: 'url(#accFill)' }),
        realPts.length > 1 && React.createElement('path', { d: smoothPath(realPts), fill: 'none', stroke: 'var(--acc-strong)', strokeWidth: 2.4 }),
        // projected dashed
        showProjected && projPts.length > 1 && React.createElement('path', { d: smoothPath(projPts), fill: 'none', stroke: 'var(--acc-strong)', strokeWidth: 2, strokeDasharray: '2 5', opacity: .7 }),
        // hover columns
        data.map((d, i) => React.createElement('rect', { key: 'h' + i, x: padX + slot * i, y: padTop, width: slot, height: innerH, fill: 'transparent', onMouseEnter: () => setHover(i) })),
        // x labels (sparse)
        data.map((d, i) => (i % (mode === 'day' ? 4 : 1) === 0) && React.createElement('text', { key: 'x' + i, x: padX + slot * i + slot / 2, y: H - 9, textAnchor: 'middle', fontSize: 10, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }, mode === 'day' ? d.d : d.m)),
        // hover marker
        hover !== null && React.createElement('circle', { cx: accPts[hover][0], cy: accPts[hover][1], r: 4, fill: '#fff', stroke: 'var(--acc-strong)', strokeWidth: 2 })
      ),
      hover !== null && (() => {
        const d = data[hover];
        const left = `calc(${(accPts[hover][0] / W) * 100}% )`;
        return React.createElement('div', { style: { position: 'absolute', top: 4, left, transform: 'translateX(-50%)', pointerEvents: 'none' } },
          React.createElement('div', { className: 'chart-tip' },
            React.createElement('div', { style: { fontWeight: 700, marginBottom: 4 } }, (mode === 'day' ? 'Dia ' + d.d : d.m) + (d.proj ? ' · projetado' : '')),
            d.inc > 0 && React.createElement('div', { className: 'ct-row' }, React.createElement('span', { className: 'ct-dot', style: { background: 'var(--acc)' } }), 'Entrou ', React.createElement('b', null, window.SCF.BRL(d.inc))),
            React.createElement('div', { className: 'ct-row' }, React.createElement('span', { className: 'ct-dot', style: { background: 'var(--neg)' } }), 'Saiu ', React.createElement('b', null, window.SCF.BRL(d.exp))),
            React.createElement('div', { className: 'ct-row' }, React.createElement('span', { className: 'ct-dot', style: { background: 'var(--acc-strong)' } }), 'Saldo ', React.createElement('b', null, window.SCF.BRL(d.acc)))));
      })());
  }

  // ---------- LineChart: multi-series ----------
  function LineChart({ series, height = 230, money = true, fmt }) {
    const [hover, setHover] = useState(null);
    const W = 920, H = height, padX = 14, padTop = 16, padBot = 26;
    const innerW = W - padX * 2, innerH = H - padTop - padBot;
    const all = series.flatMap(s => s.data.map(p => p.y));
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const n = series[0].data.length;
    const X = (i) => padX + (innerW * i) / (n - 1);
    const Y = (v) => padTop + (1 - (v - lo) / (hi - lo)) * innerH;
    const fmtV = fmt || (money ? (v) => window.SCF.BRL(v) : (v) => window.SCF.num(v));

    return React.createElement('div', { style: { position: 'relative' } },
      React.createElement('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', display: 'block' }, onMouseLeave: () => setHover(null) },
        [0, .25, .5, .75, 1].map((t, i) => React.createElement('line', { key: i, x1: padX, x2: W - padX, y1: padTop + innerH * t, y2: padTop + innerH * t, stroke: 'var(--line)', strokeWidth: 1 })),
        series.map((s, si) => {
          const pts = s.data.map((p, i) => [X(i), Y(p.y)]);
          return React.createElement('g', { key: si },
            s.area && React.createElement('path', { d: smoothPath(pts) + ` L ${pts[pts.length-1][0]} ${H-padBot} L ${pts[0][0]} ${H-padBot} Z`, fill: s.color, opacity: .1 }),
            React.createElement('path', { d: smoothPath(pts), fill: 'none', stroke: s.color, strokeWidth: s.width || 2.4, strokeDasharray: s.dashed ? '3 5' : 'none', opacity: s.dashed ? .8 : 1 }));
        }),
        series[0].data.map((p, i) => React.createElement('rect', { key: i, x: X(i) - innerW/(n-1)/2, y: padTop, width: innerW/(n-1), height: innerH, fill: 'transparent', onMouseEnter: () => setHover(i) })),
        hover !== null && React.createElement('line', { x1: X(hover), x2: X(hover), y1: padTop, y2: padTop + innerH, stroke: 'var(--line-strong)', strokeWidth: 1 }),
        hover !== null && series.map((s, si) => React.createElement('circle', { key: si, cx: X(hover), cy: Y(s.data[hover].y), r: 3.5, fill: '#fff', stroke: s.color, strokeWidth: 2 })),
        series[0].data.map((p, i) => p.x && React.createElement('text', { key: 'x' + i, x: X(i), y: H - 8, textAnchor: 'middle', fontSize: 10, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }, p.x))
      ),
      hover !== null && React.createElement('div', { style: { position: 'absolute', top: 4, left: `${(X(hover) / W) * 100}%`, transform: `translateX(${hover > n/2 ? '-105%' : '5%'})`, pointerEvents: 'none' } },
        React.createElement('div', { className: 'chart-tip' },
          React.createElement('div', { style: { fontWeight: 700, marginBottom: 4 } }, series[0].data[hover].x || ('#' + hover)),
          series.map((s, si) => React.createElement('div', { key: si, className: 'ct-row' }, React.createElement('span', { className: 'ct-dot', style: { background: s.color } }), s.label + ' ', React.createElement('b', null, fmtV(s.data[hover].y)))))));
  }

  // ---------- Donut ----------
  function Donut({ data, size = 160, thickness = 22, gap = 2, center }) {
    const r = (size - thickness) / 2, c = size / 2;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let a0 = -90;
    const arc = (cx, cy, rad, start, end) => {
      const s = (start * Math.PI) / 180, e = (end * Math.PI) / 180;
      const x1 = cx + rad * Math.cos(s), y1 = cy + rad * Math.sin(s);
      const x2 = cx + rad * Math.cos(e), y2 = cy + rad * Math.sin(e);
      const large = end - start > 180 ? 1 : 0;
      return `M ${x1} ${y1} A ${rad} ${rad} 0 ${large} 1 ${x2} ${y2}`;
    };
    return React.createElement('div', { style: { position: 'relative', width: size, height: size, flex: 'none' } },
      React.createElement('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        data.map((d, i) => {
          const sweep = (d.value / total) * 360;
          const a1 = a0 + sweep - gap;
          const p = arc(c, c, r, a0, a1);
          a0 += sweep;
          return React.createElement('path', { key: i, d: p, fill: 'none', stroke: d.color, strokeWidth: thickness, strokeLinecap: 'round' });
        })),
      center && React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' } }, center));
  }

  // ---------- Progress ring ----------
  function Ring({ value, size = 86, thickness = 8, color = 'var(--acc)', track = 'var(--bg-sunken)', children }) {
    const r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r;
    return React.createElement('div', { style: { position: 'relative', width: size, height: size } },
      React.createElement('svg', { width: size, height: size, style: { transform: 'rotate(-90deg)' } },
        React.createElement('circle', { cx: c, cy: c, r, fill: 'none', stroke: track, strokeWidth: thickness }),
        React.createElement('circle', { cx: c, cy: c, r, fill: 'none', stroke: color, strokeWidth: thickness, strokeLinecap: 'round', strokeDasharray: circ, strokeDashoffset: circ * (1 - value / 100), style: { transition: 'stroke-dashoffset .7s cubic-bezier(.2,.7,.2,1)' } })),
      React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' } }, children));
  }

  // ---------- Sparkline ----------
  function Spark({ data, w = 76, h = 30, color = 'var(--acc)', fill = true }) {
    const lo = Math.min(...data), hi = Math.max(...data), rng = (hi - lo) || 1;
    const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - lo) / rng) * (h - 6)]);
    return React.createElement('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` },
      fill && React.createElement('path', { d: smoothPath(pts) + ` L ${w} ${h} L 0 ${h} Z`, fill: color, opacity: .12 }),
      React.createElement('path', { d: smoothPath(pts), fill: 'none', stroke: color, strokeWidth: 2 }));
  }

  // ---------- Mini bars ----------
  function MiniBars({ data, w = 80, h = 30, color = 'var(--acc)' }) {
    const hi = Math.max(...data) || 1, n = data.length, bw = w / n * 0.6;
    return React.createElement('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` },
      data.map((v, i) => {
        const bh = (v / hi) * (h - 4);
        return React.createElement('rect', { key: i, x: (w / n) * i + (w / n - bw) / 2, y: h - bh, width: bw, height: bh, rx: 1.5, fill: color, opacity: i === n - 1 ? 1 : .35 });
      }));
  }

  window.Charts = { FlowChart, LineChart, Donut, Ring, Spark, MiniBars };
})();
