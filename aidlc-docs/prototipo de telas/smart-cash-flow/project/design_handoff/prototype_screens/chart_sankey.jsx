/* SmartCashFlow — Sankey chart (puro SVG, sem libs)
   Receita → categorias (e opcionalmente subcategorias).
   API:
     buildSankeyData({ withSubs }) → { columns, links, totals }
     <Sankey columns={...} links={...} height={420} compact={false} />
*/
(function () {
  const { useState, useMemo } = React;
  const S = window.SCF;

  // ============================================================== DATA =====
  // Cores das fontes de receita (paleta verde-azul harmoniosa)
  const INCOME_PALETTE = ['#1f8a5b', '#2a9d8f', '#3d7d63', '#5a9d63', '#6cb286'];

  function buildSankeyData({ withSubs = false } = {}) {
    // 1. Fontes de renda (esquerda) — somam exatamente o total da renda
    const sources = S.incomeBreakdown.items.map((it, i) => ({
      id: 'src_' + i,
      label: it.sub,
      sub: it.note,
      value: it.value,
      color: INCOME_PALETTE[i % INCOME_PALETTE.length],
    }));
    const incomeTotal = S.exec.entrou;     // valor real do mês (18.420)

    // 2. Categorias de despesa — usa S.topCats (valores reais do mês, sem dupla contagem)
    //    Filtra a categoria 'renda' caso esteja presente.
    const expenseCats = S.topCats
      .filter(c => c.key !== 'renda')
      .map(c => ({
        id: c.key, label: S.CATS[c.key].label,
        value: c.value, color: S.CATS[c.key].color, kind: 'expense',
      }));
    const totalOut = expenseCats.reduce((s, c) => s + c.value, 0);
    const sobra = Math.max(0, incomeTotal - totalOut);    // 5.240 — bate com exec.sobrou

    const allRightNodes = [...expenseCats];
    if (sobra > 0) {
      allRightNodes.push({
        id: 'sobra', label: 'Sobrou', sub: 'fluxo positivo do mês',
        value: sobra, color: '#1f8a5b', kind: 'save',
      });
    }

    // 3. Subcategorias — pesos vêm das transações reais, mas SCALAMOS para que
    //    a soma de subs de cada categoria == valor da categoria em topCats.
    //    Categorias sem amostra de transação caem num único "Outros".
    const subBucket = {};                // {catKey: [{sub, weight, count}]}
    if (withSubs) {
      const weights = {};
      S.transactions.forEach(t => {
        if (t.dir !== 'out') return;
        if (!weights[t.cat]) weights[t.cat] = {};
        const sub = (t.sub || 'Não classificado').trim();
        if (!weights[t.cat][sub]) weights[t.cat][sub] = { value: 0, count: 0 };
        weights[t.cat][sub].value += Math.abs(t.value);
        weights[t.cat][sub].count += 1;
      });

      expenseCats.forEach(c => {
        const w = weights[c.id];
        if (!w || Object.keys(w).length === 0) {
          // sem amostra de transação — coloca tudo num bucket "Outros"
          subBucket[c.id] = [{ sub: 'Outros', value: c.value, count: 0, scaled: true }];
          return;
        }
        const sampleTotal = Object.values(w).reduce((s, x) => s + x.value, 0) || 1;
        const scale = c.value / sampleTotal;       // fator para casar com topCats
        subBucket[c.id] = Object.entries(w)
          .sort((a, b) => b[1].value - a[1].value)
          .map(([sub, x]) => ({ sub, value: x.value * scale, count: x.count, scaled: true }));
      });
    }

    const subNodes = [];
    if (withSubs) {
      expenseCats.forEach(c => {
        (subBucket[c.id] || []).forEach(s => {
          subNodes.push({
            id: c.id + '__' + s.sub, label: s.sub, sub: c.label,
            value: s.value, count: s.count, color: c.color, catId: c.id, kind: 'sub',
          });
        });
      });
    }

    // 4. Colunas
    const columns = [
      { id: 'sources', nodes: sources },
      { id: 'income', nodes: [{ id: 'total', label: 'Renda total', value: incomeTotal, color: '#3d7d63', kind: 'income' }] },
      { id: 'right', nodes: allRightNodes },
    ];
    if (withSubs) columns.push({ id: 'subs', nodes: subNodes });

    // 5. Links
    const links = [];
    sources.forEach(src => links.push({
      from: 'sources/' + src.id, to: 'income/total', value: src.value, color: src.color,
    }));
    allRightNodes.forEach(n => links.push({
      from: 'income/total', to: 'right/' + n.id, value: n.value, color: n.color,
    }));
    if (withSubs) {
      expenseCats.forEach(c => {
        (subBucket[c.id] || []).forEach(s => links.push({
          from: 'right/' + c.id, to: 'subs/' + c.id + '__' + s.sub,
          value: s.value, color: c.color,
        }));
      });
    }

    return {
      columns, links,
      totals: {
        income: incomeTotal, expense: totalOut, sobra,
        sources: sources.length, categories: expenseCats.length, subs: subNodes.length,
      },
    };
  }

  // ============================================================ LAYOUT =====
  function layoutSankey(columns, links, { width, height, nodeW, gap, padX, padTopBot }) {
    // index nodes
    const nodes = {};
    columns.forEach((col, ci) => col.nodes.forEach(n => {
      const key = col.id + '/' + n.id;
      nodes[key] = { ...n, _key: key, _col: ci, in_links: [], out_links: [] };
    }));
    links.forEach(l => {
      const from = nodes[l.from], to = nodes[l.to];
      if (!from || !to) return;
      from.out_links.push(l);
      to.in_links.push(l);
    });

    // valor de cada nó = max(in, out, predefinido)
    Object.values(nodes).forEach(n => {
      const out = n.out_links.reduce((s, l) => s + l.value, 0);
      const inc = n.in_links.reduce((s, l) => s + l.value, 0);
      n.flow = Math.max(out, inc, n.value || 0);
    });

    // total da coluna mais densa define a escala
    const colTotals = columns.map(c => c.nodes.reduce((s, n) => s + nodes[c.id + '/' + n.id].flow, 0));
    const maxTotal = Math.max(...colTotals) || 1;
    const maxNodes = Math.max(...columns.map(c => c.nodes.length));
    const availH = height - padTopBot * 2 - (maxNodes - 1) * gap;
    const scale = availH / maxTotal;

    // posição X de cada coluna
    const cols = columns.length;
    const colX = (i) => padX + (width - padX * 2 - nodeW) * (i / (cols - 1));

    // posição Y dos nós (centralizada verticalmente quando a coluna soma menos que o máximo)
    columns.forEach((col, ci) => {
      const total = colTotals[ci];
      const colH = total * scale + (col.nodes.length - 1) * gap;
      let cursor = padTopBot + (availH + (maxNodes - 1) * gap - colH) / 2;
      col.nodes.forEach(n => {
        const node = nodes[col.id + '/' + n.id];
        node.x = colX(ci);
        node.y0 = cursor;
        node.y1 = cursor + node.flow * scale;
        cursor = node.y1 + gap;
      });
    });

    // cursores de uso para flows
    Object.values(nodes).forEach(n => { n.used_out = n.y0; n.used_in = n.y0; });

    // ordena links de saída/entrada para sequência visual consistente
    columns.forEach(col => col.nodes.forEach(n => {
      const node = nodes[col.id + '/' + n.id];
      // saídas: ordenar pelo y do nó de destino
      node.out_links.sort((a, b) => (nodes[a.to]?.y0 || 0) - (nodes[b.to]?.y0 || 0));
      node.in_links.sort((a, b) => (nodes[a.from]?.y0 || 0) - (nodes[b.from]?.y0 || 0));
    }));

    // gera flows na ordem certa: por coluna esquerda, por nó, por out_links
    const flows = [];
    columns.forEach((col, ci) => {
      if (ci === columns.length - 1) return;
      col.nodes.forEach(n => {
        const node = nodes[col.id + '/' + n.id];
        node.out_links.forEach(l => {
          const a = node;
          const b = nodes[l.to];
          if (!b) return;
          const h = l.value * scale;
          // alinhar entrada do nó destino na ordem dos in_links
          // procurar a próxima posição livre em b
          const ay0 = a.used_out, ay1 = ay0 + h;
          const by0 = b.used_in, by1 = by0 + h;
          a.used_out = ay1;
          b.used_in = by1;
          flows.push({
            id: l.from + '→' + l.to,
            from: a, to: b,
            ay0, ay1, by0, by1, value: l.value, color: l.color || a.color || b.color,
          });
        });
      });
    });

    return { nodes, flows, nodeW, scale, maxTotal };
  }

  // ============================================================ COMPONENT =
  function Sankey({
    columns, links,
    height = 420,
    width = 1280,
    nodeW = 14,
    gap = 4,
    padX = 14,
    padTopBot = 18,
    compact = false,
    showLabels = true,
    minBandHeight = 1.4,
    onClickNode,
  }) {
    const [hoverFlow, setHoverFlow] = useState(null);
    const [hoverNode, setHoverNode] = useState(null);

    const { nodes, flows } = useMemo(
      () => layoutSankey(columns, links, { width, height, nodeW, gap, padX, padTopBot }),
      [columns, links, height, width, nodeW, gap, padX, padTopBot]
    );

    function flowPath(f) {
      const x0 = f.from.x + nodeW, x1 = f.to.x;
      const mx = (x0 + x1) / 2;
      // top curve a.y0 → b.y0
      // right vertical → b.y1
      // bottom curve b.y1 → a.y1
      // left vertical → a.y0
      const ay0 = f.ay0, ay1 = Math.max(f.ay1, f.ay0 + minBandHeight);
      const by0 = f.by0, by1 = Math.max(f.by1, f.by0 + minBandHeight);
      return `M ${x0} ${ay0} C ${mx} ${ay0} ${mx} ${by0} ${x1} ${by0} L ${x1} ${by1} C ${mx} ${by1} ${mx} ${ay1} ${x0} ${ay1} Z`;
    }

    const nodeList = Object.values(nodes);
    const lastColIdx = columns.length - 1;

    const isDim = (flowId) =>
      (hoverFlow && hoverFlow !== flowId) ||
      (hoverNode && !flowTouchesNode(flows.find(f => f.id === flowId), hoverNode));

    function flowTouchesNode(f, key) {
      if (!f) return false;
      if (f.from._key === key || f.to._key === key) return true;
      // transitivo: se passou pela coluna do meio, destacar caminhos completos por categoria
      return false;
    }

    return React.createElement('div', { style: { position: 'relative' } },
      React.createElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        style: { width: '100%', display: 'block', overflow: 'visible' },
        preserveAspectRatio: 'xMidYMid meet',
        onMouseLeave: () => { setHoverFlow(null); setHoverNode(null); },
      },
        // flows (atrás)
        flows.map(f => {
          const dim = isDim(f.id);
          return React.createElement('path', {
            key: f.id, d: flowPath(f), fill: f.color,
            opacity: dim ? 0.08 : (hoverFlow === f.id ? 0.7 : 0.42),
            onMouseEnter: () => setHoverFlow(f.id),
            onMouseLeave: () => setHoverFlow(null),
            style: { transition: 'opacity .12s', cursor: 'pointer' },
          });
        }),
        // nodes (frente)
        nodeList.map(n => React.createElement('rect', {
          key: n._key,
          x: n.x, y: n.y0, width: nodeW, height: Math.max(2, n.y1 - n.y0),
          rx: 2, fill: n.color,
          opacity: hoverNode && hoverNode !== n._key ? 0.45 : 1,
          onMouseEnter: () => setHoverNode(n._key),
          onMouseLeave: () => setHoverNode(null),
          onClick: () => onClickNode && onClickNode(n),
          style: { cursor: onClickNode ? 'pointer' : 'default', transition: 'opacity .12s' },
        })),
        // labels
        showLabels && nodeList.map(n => {
          const h = n.y1 - n.y0;
          if (h < (compact ? 8 : 10)) return null;
          const isLeft = n._col === 0;
          const isRight = n._col === lastColIdx;
          const isMid = !isLeft && !isRight;
          const x = isLeft ? n.x - 8 : isRight ? n.x + nodeW + 8 : n.x + nodeW + 8;
          const anchor = isLeft ? 'end' : 'start';
          const yMid = (n.y0 + n.y1) / 2;
          const fs = compact ? 10 : 11;
          const fsSub = compact ? 9 : 10;
          // valor em R$ K
          const vTxt = n.value >= 1000 ? 'R$ ' + (n.value / 1000).toFixed(1) + 'k' : 'R$ ' + n.value.toFixed(0);
          return React.createElement('g', { key: 'lbl-' + n._key, style: { pointerEvents: 'none' } },
            React.createElement('text', {
              x, y: yMid - 2, textAnchor: anchor,
              fontSize: fs, fill: 'var(--ink)', fontWeight: 600,
              fontFamily: 'var(--font-display)',
            }, n.label),
            !compact && React.createElement('text', {
              x, y: yMid + fs + 1, textAnchor: anchor,
              fontSize: fsSub, fill: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
            }, vTxt));
        })
      ),

      // tooltip
      hoverFlow && (() => {
        const f = flows.find(x => x.id === hoverFlow);
        if (!f) return null;
        const cx = (f.from.x + nodeW + f.to.x) / 2;
        const cy = ((f.ay0 + f.ay1) / 2 + (f.by0 + f.by1) / 2) / 2;
        const left = (cx / width) * 100, top = (cy / height) * 100;
        return React.createElement('div', {
          style: { position: 'absolute', left: left + '%', top: top + '%', transform: 'translate(-50%, -110%)', pointerEvents: 'none' }
        },
          React.createElement('div', { className: 'chart-tip' },
            React.createElement('div', { style: { fontWeight: 700, marginBottom: 3 } },
              f.from.label, ' → ', f.to.label),
            React.createElement('div', { className: 'ct-row' },
              React.createElement('span', { className: 'ct-dot', style: { background: f.color } }),
              React.createElement('b', null, S.BRL(f.value)))));
      })());
  }

  // ============================================================ EXPORT ===
  window.Charts = window.Charts || {};
  window.Charts.Sankey = Sankey;
  window.Charts.buildSankeyData = buildSankeyData;
})();
