/* SmartCashFlow — Categorias e Subcategorias
   Visões: Cards · Árvore · Tabela. Cadastro via modal. */
(function () {
  const { useState, useMemo, useEffect } = React;
  const Icon = window.Icon, UI = window.UI, S = window.SCF;
  const BRL = S.BRL;

  // paleta para novas categorias (mesmas tonalidades do design system)
  const PALETTE = [
    '#3567b8', '#1f8a5b', '#6a52c9', '#c98a2b', '#cf4d43',
    '#d98234', '#2a9d8f', '#9a6b14', '#7c8696', '#a35a7d', '#3d7d63', '#5a7dc9',
  ];
  const ICONS = ['home', 'wallet', 'coins', 'car', 'cap', 'shield', 'plane', 'spark', 'flag', 'target', 'building', 'receipt', 'tag', 'star', 'zap', 'globe'];

  // valores ilustrativos por categoria (média do mês corrente)
  const VAL_FROM_TOP = Object.fromEntries(S.topCats.map(c => [c.key, c]));

  function buildModel(extra) {
    // monta lista a partir do dicionário CATS + extras criados em memória
    const base = Object.entries(S.CATS).map(([key, c]) => {
      const top = VAL_FROM_TOP[key];
      const isIncome = key === 'renda';
      return {
        key, label: c.label, color: c.color, subs: c.subs.slice(),
        value: top ? top.value : (isIncome ? S.incomeBreakdown.total : 0),
        pct: top ? top.pct : 0, delta: top ? top.delta : 0,
        kind: isIncome ? 'in' : 'out',
        txCount: S.transactions.filter(t => t.cat === key).length,
        last: lastUse(key),
        builtin: true, icon: defaultIcon(key),
      };
    });
    return [...base, ...extra];
  }
  function lastUse(key) {
    const list = S.transactions.filter(t => t.cat === key).map(t => t.date);
    return list[0] || '—';
  }
  function defaultIcon(key) {
    return { moradia: 'home', alimentacao: 'wallet', educacao: 'cap', transporte: 'car',
      saude: 'shield', lazer: 'plane', assinaturas: 'repeat', mercado: 'tag',
      servicos: 'receipt', investido: 'coins', renda: 'arrowDR', outros: 'folder' }[key] || 'tag';
  }

  // ------------------------------------------------------------------ Screen
  function Categorias({ onNav }) {
    const [extras, setExtras] = useState([]);     // categorias criadas
    const [extraSubs, setExtraSubs] = useState({}); // { key: [string,...] }
    const [view, setView] = useState('cards');    // cards | tree | table
    const [filter, setFilter] = useState('all');  // all | out | in
    const [q, setQ] = useState('');
    const [modal, setModal] = useState(null);     // { kind: 'cat'|'sub', parent?, prefillName? }

    const model = useMemo(() => {
      const m = buildModel(extras);
      return m.map(c => ({ ...c, subs: [...c.subs, ...(extraSubs[c.key] || [])] }));
    }, [extras, extraSubs]);

    const filtered = useMemo(() => model.filter(c => {
      if (filter === 'out' && c.kind !== 'out') return false;
      if (filter === 'in' && c.kind !== 'in') return false;
      if (q && !c.label.toLowerCase().includes(q.toLowerCase()) &&
          !c.subs.some(s => s.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    }), [model, filter, q]);

    const totalCats = model.length;
    const totalSubs = model.reduce((s, c) => s + c.subs.length, 0);
    const top = model.filter(c => c.kind === 'out').sort((a, b) => b.value - a.value)[0];
    const uncatTx = S.transactions.filter(t => t.review === 'uncat').length;

    const addCategory = (data) => {
      setExtras(es => [...es, {
        key: 'custom_' + Date.now(), label: data.name, color: data.color, subs: data.subs || [],
        value: 0, pct: 0, delta: 0, kind: data.kind, txCount: 0, last: '—', builtin: false, icon: data.icon || 'tag',
      }]);
      setModal(null);
    };
    const addSubcategory = (parentKey, name) => {
      setExtraSubs(prev => ({ ...prev, [parentKey]: [...(prev[parentKey] || []), name] }));
      setModal(null);
    };

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, {
        eyebrow: 'Visão', title: 'Categorias e Subcategorias', icon: 'tag',
        sub: 'Organize seus lançamentos para enxergar exatamente onde o dinheiro vai. Categoria principal + subcategoria.',
        right: React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('transactions') },
            React.createElement(Icon, { name: 'list', size: 14 }), 'Ver lançamentos'),
          React.createElement('button', { className: 'btn btn-primary btn-sm', onClick: () => setModal({ kind: 'cat' }) },
            React.createElement(Icon, { name: 'plus', size: 15 }), 'Nova categoria'))
      }),

      // KPIs --------------------------------------------------------
      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Categorias', value: totalCats, cur: null, icon: 'folder', sub: model.filter(c => !c.builtin).length + ' criadas por você' }),
        React.createElement(UI.Kpi, { label: 'Subcategorias', value: totalSubs, cur: null, icon: 'tag', sub: 'média de ' + (totalSubs / totalCats).toFixed(1) + ' por categoria' }),
        React.createElement(UI.Kpi, { label: 'Maior do mês', value: top ? S.num(top.value) : '0', cur: 'R$', icon: 'arrowUR',
          sub: top && React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5 } },
            React.createElement('span', { className: 'catdot', style: { background: top.color } }),
            top.label, ' · ', top.pct.toFixed(1), '%') }),
        React.createElement(UI.Kpi, { label: 'Sem categoria', value: uncatTx, cur: null, icon: 'alert',
          sub: uncatTx ? React.createElement('button', { className: 'btn btn-sm btn-quiet', style: { padding: '2px 0', color: 'var(--warn)' }, onClick: () => onNav('transactions') }, 'Revisar transações →') : 'Tudo classificado' })),

      // Toolbar -----------------------------------------------------
      React.createElement(UI.Card, { style: { marginBottom: 14 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', flexWrap: 'wrap' } },
          React.createElement(UI.Tabs, {
            value: view, onChange: setView,
            tabs: [
              { id: 'cards', label: 'Cartões' },
              { id: 'tree', label: 'Árvore' },
              { id: 'table', label: 'Tabela' }] }),
          React.createElement('div', { style: { width: 1, height: 22, background: 'var(--line)' } }),
          React.createElement(UI.Tabs, {
            value: filter, onChange: setFilter,
            tabs: [{ id: 'all', label: 'Todas' }, { id: 'out', label: 'Despesas' }, { id: 'in', label: 'Receitas' }] }),
          React.createElement('div', { style: { position: 'relative', marginLeft: 'auto', minWidth: 220 } },
            React.createElement(Icon, { name: 'search', size: 16, style: { position: 'absolute', left: 11, top: 9, color: 'var(--ink-faint)' } }),
            React.createElement('input', { value: q, onChange: e => setQ(e.target.value),
              placeholder: 'Buscar categoria ou subcategoria…',
              style: { width: '100%', padding: '8px 12px 8px 34px', borderRadius: 9, border: '1px solid var(--line)', fontSize: 13, background: 'var(--card-2)' } })))),

      // Views -------------------------------------------------------
      view === 'cards' && React.createElement(CardsView, { items: filtered, onAddSub: (k) => setModal({ kind: 'sub', parent: k }), onDrill: (k) => setView('tree') }),
      view === 'tree' && React.createElement(TreeView, { items: filtered, onAddSub: (k) => setModal({ kind: 'sub', parent: k }) }),
      view === 'table' && React.createElement(TableView, { items: filtered, onAddSub: (k) => setModal({ kind: 'sub', parent: k }) }),

      filtered.length === 0 && React.createElement(UI.Card, { style: { marginTop: 12 } },
        React.createElement(UI.State, { icon: 'search', title: 'Nenhuma categoria encontrada' }, 'Ajuste os filtros ou a busca, ou cadastre uma nova categoria.')),

      // Footer help -------------------------------------------------
      React.createElement('div', { style: { marginTop: 18 } },
        React.createElement(UI.Alert, { type: 'info', title: 'Como o SmartCashFlow usa categorias e subcategorias' },
          'Cada transação importada é classificada automaticamente quando o padrão de descrição já é conhecido. Você pode criar quantas categorias e subcategorias quiser — elas alimentam Orçamentos, Relatórios e o Copilot.')),

      // Modal -------------------------------------------------------
      modal && React.createElement(CadastroModal, {
        mode: modal.kind, parentKey: modal.parent, categories: model,
        onClose: () => setModal(null),
        onSaveCat: addCategory,
        onSaveSub: addSubcategory,
      }));
  }

  // ===================================================== CARDS view
  function CardsView({ items, onAddSub, onDrill }) {
    return React.createElement('div', { className: 'cat-grid' },
      items.map(c => React.createElement(CatCard, { key: c.key, c, onAddSub, onDrill })));
  }

  function CatCard({ c, onAddSub, onDrill }) {
    const visibleSubs = c.subs.slice(0, 4);
    const overflow = c.subs.length - visibleSubs.length;
    return React.createElement('div', { className: 'cat-card' },
      React.createElement('div', { className: 'cc-stripe', style: { background: c.color } }),
      React.createElement('div', { className: 'cc-body' },
        React.createElement('div', { className: 'cc-head' },
          React.createElement('div', { className: 'cc-mark', style: { background: c.color } },
            React.createElement(Icon, { name: c.icon, size: 16 })),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { className: 'cc-name' }, c.label),
            React.createElement('div', { className: 'cc-meta' },
              c.kind === 'in' ? 'Receita' : 'Despesa', ' · ', c.subs.length, ' subcategorias · ', c.txCount, ' lançamentos')),
          React.createElement('div', { className: 'row-act' },
            React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 14 })),
            !c.builtin && React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 14 })))),

        React.createElement('div', { className: 'cc-val' },
          React.createElement('span', { className: 'cur' }, 'R$ '), S.num(c.value),
          c.delta !== 0 && c.delta != null && React.createElement('span', { style: { marginLeft: 10, fontSize: 12 } },
            React.createElement(UI.Delta, { v: c.delta, invert: c.kind === 'out' }))),
        c.kind === 'out' && React.createElement(UI.Bar, { value: c.pct, max: 30, color: c.color }),

        React.createElement('div', { className: 'cc-subs' },
          visibleSubs.map((s, i) => React.createElement('span', { key: i, className: 'sub-chip' },
            React.createElement('span', { className: 'catdot', style: { background: c.color, width: 6, height: 6, borderRadius: '50%' } }), s)),
          overflow > 0 && React.createElement('button', { className: 'sub-chip more', onClick: () => onDrill(c.key) }, '+', overflow, ' mais'),
          React.createElement('button', { className: 'sub-chip add', onClick: () => onAddSub(c.key) },
            React.createElement(Icon, { name: 'plus', size: 11 }), 'subcategoria'))),

      React.createElement('div', { className: 'cc-foot' },
        React.createElement('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-faint)' } }, 'último uso · ', c.last),
        React.createElement('button', { className: 'btn btn-quiet btn-sm', style: { marginLeft: 'auto' }, onClick: () => onDrill(c.key) }, 'Detalhar')));
  }

  // ===================================================== TREE view
  function TreeView({ items, onAddSub }) {
    const [open, setOpen] = useState({});
    const maxVal = Math.max(1, ...items.map(c => c.value));
    return React.createElement('div', null,
      items.map(c => {
        const isOpen = !!open[c.key];
        return React.createElement('div', { key: c.key, className: 'tree-group' },
          React.createElement('div', { className: 'tree-head' + (isOpen ? ' open' : ''), onClick: () => setOpen(o => ({ ...o, [c.key]: !o[c.key] })) },
            React.createElement('span', { className: 'tree-chev' }, React.createElement(Icon, { name: 'chevR', size: 14 })),
            React.createElement('span', { className: 'cc-mark', style: { background: c.color, width: 28, height: 28, borderRadius: 8 } },
              React.createElement(Icon, { name: c.icon, size: 14 })),
            React.createElement('div', { style: { minWidth: 0, flex: 'none' } },
              React.createElement('div', { className: 'tree-name' }, c.label),
              React.createElement('div', { className: 'tree-meta' }, c.subs.length, ' subcategorias · ', c.txCount, ' lançamentos')),
            React.createElement('div', { className: 'tree-bar-wrap' },
              React.createElement(UI.Bar, { value: c.value, max: maxVal, color: c.color })),
            React.createElement('div', { className: 'tree-val' }, 'R$ ', S.num(c.value)),
            React.createElement('div', { className: 'row-act', onClick: (e) => e.stopPropagation() },
              React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 14 })),
              React.createElement('button', { title: 'Mais' }, React.createElement(Icon, { name: 'dots', size: 14 })))),

          isOpen && React.createElement('div', { className: 'tree-body' },
            c.subs.length === 0
              ? React.createElement('div', { style: { padding: '18px 16px 18px 50px', color: 'var(--ink-3)', fontSize: 12.5 } }, 'Nenhuma subcategoria cadastrada ainda.')
              : c.subs.map((s, i) => {
                const used = Math.max(1, c.txCount - i * 2);
                const sval = Math.round(c.value * (1 - i * 0.16) / Math.max(1, c.subs.length / 2));
                return React.createElement('div', { key: i, className: 'tree-sub' },
                  React.createElement('span', { className: 'catdot', style: { background: c.color, width: 8, height: 8 } }),
                  React.createElement('span', { className: 'ts-name' }, s),
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('div', { style: { flex: 1 } }, React.createElement(UI.Bar, { value: Math.max(1, sval), max: Math.max(1, c.value), color: c.color }))),
                  React.createElement('span', { className: 'ts-count' }, used, ' lanç.'),
                  React.createElement('span', { className: 'ts-val' }, 'R$ ', S.num(sval)),
                  React.createElement('span', { className: 'row-act' },
                    React.createElement('button', { title: 'Renomear' }, React.createElement(Icon, { name: 'edit', size: 13 })),
                    React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 13 }))));
              }),
            React.createElement('button', { className: 'tree-add', onClick: () => onAddSub(c.key) },
              React.createElement(Icon, { name: 'plus', size: 14 }), 'Adicionar subcategoria em ', c.label)));
      }));
  }

  // ===================================================== TABLE view
  function TableView({ items, onAddSub }) {
    // achata categoria + subcategoria
    const rows = items.flatMap(c => c.subs.length
      ? c.subs.map((s, i) => ({ cat: c, sub: s, i }))
      : [{ cat: c, sub: null, i: 0 }]);
    return React.createElement(UI.Card, null,
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { className: 'tbl' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, 'Categoria'),
            React.createElement('th', null, 'Subcategoria'),
            React.createElement('th', null, 'Tipo'),
            React.createElement('th', { className: 'num' }, 'Lançamentos'),
            React.createElement('th', { className: 'num' }, 'Valor no mês'),
            React.createElement('th', null, 'Último uso'),
            React.createElement('th', null, ''))),
          React.createElement('tbody', null,
            rows.map((r, idx) => {
              const c = r.cat;
              const sval = r.sub ? Math.round(c.value * (1 - r.i * 0.16) / Math.max(1, c.subs.length / 2)) : c.value;
              const used = r.sub ? Math.max(1, c.txCount - r.i * 2) : c.txCount;
              return React.createElement('tr', { key: idx },
                React.createElement('td', null, React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 8 } },
                  React.createElement('span', { className: 'catdot', style: { background: c.color, width: 10, height: 10 } }),
                  React.createElement('span', { className: 't-desc' }, c.label))),
                React.createElement('td', null, r.sub
                  ? React.createElement('span', { style: { color: 'var(--ink-2)' } }, r.sub)
                  : React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => onAddSub(c.key) },
                    React.createElement(Icon, { name: 'plus', size: 12 }), 'Adicionar')),
                React.createElement('td', null, React.createElement(UI.Badge, { kind: c.kind === 'in' ? 'pos' : 'neutral' }, c.kind === 'in' ? 'Receita' : 'Despesa')),
                React.createElement('td', { className: 'num' }, used),
                React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, 'R$ ', S.num(sval)),
                React.createElement('td', { className: 't-sub mono' }, c.last),
                React.createElement('td', null, React.createElement('span', { className: 'row-act' },
                  React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 13 })),
                  React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 13 })))));
            })))));
  }

  // ===================================================== MODAL Cadastro
  function CadastroModal({ mode, parentKey, categories, onClose, onSaveCat, onSaveSub }) {
    const [kind, setKind] = useState(mode);                 // 'cat' | 'sub'
    const [name, setName] = useState('');
    const [type, setType] = useState('out');                 // despesa/receita
    const [color, setColor] = useState(PALETTE[1]);
    const [iconName, setIconName] = useState('tag');
    const [subsText, setSubsText] = useState('');
    const [parent, setParent] = useState(parentKey || (categories.find(c => c.kind === 'out')?.key || ''));
    const [err, setErr] = useState('');

    // ESC close
    useEffect(() => {
      const h = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const submit = () => {
      const n = name.trim();
      if (!n) { setErr('Informe um nome.'); return; }
      if (kind === 'cat') {
        const dup = categories.some(c => c.label.toLowerCase() === n.toLowerCase());
        if (dup) { setErr('Já existe uma categoria com esse nome.'); return; }
        const subs = subsText.split(',').map(s => s.trim()).filter(Boolean);
        onSaveCat({ name: n, color, icon: iconName, kind: type, subs });
      } else {
        const pcat = categories.find(c => c.key === parent);
        if (pcat && pcat.subs.some(s => s.toLowerCase() === n.toLowerCase())) {
          setErr('Já existe uma subcategoria com esse nome.'); return;
        }
        onSaveSub(parent, n);
      }
    };

    const parentCat = categories.find(c => c.key === parent);

    return React.createElement('div', { className: 'mdl-backdrop', onClick: onClose },
      React.createElement('div', { className: 'mdl', onClick: (e) => e.stopPropagation(), role: 'dialog' },
        React.createElement('div', { className: 'mdl-head' },
          React.createElement('span', { className: 'mh-ic' },
            React.createElement(Icon, { name: kind === 'cat' ? 'folder' : 'tag', size: 17 })),
          React.createElement('div', { style: { minWidth: 0 } },
            React.createElement('div', { className: 'mh-ttl' }, kind === 'cat' ? 'Nova categoria' : 'Nova subcategoria'),
            React.createElement('div', { className: 'mh-sub' },
              kind === 'cat'
                ? 'Defina nome, tipo e visual. Você pode já cadastrar subcategorias.'
                : 'Subcategorias detalham onde o dinheiro vai dentro de uma categoria.')),
          React.createElement('button', { className: 'icon-btn mh-close', onClick: onClose },
            React.createElement(Icon, { name: 'x', size: 18 }))),

        React.createElement('div', { className: 'mdl-body' },
          // segmented switch
          React.createElement('div', { className: 'kind-toggle' },
            React.createElement('button', { className: kind === 'cat' ? 'on' : '', onClick: () => setKind('cat') },
              React.createElement(Icon, { name: 'folder', size: 14 }), 'Categoria'),
            React.createElement('button', { className: kind === 'sub' ? 'on' : '', onClick: () => setKind('sub') },
              React.createElement(Icon, { name: 'tag', size: 14 }), 'Subcategoria')),

          // SUBCATEGORIA — escolhe categoria pai
          kind === 'sub' && React.createElement('label', { className: 'fld' },
            React.createElement('span', { className: 'fld-label' }, 'Categoria principal'),
            React.createElement('select', { className: 'fld-select', value: parent, onChange: e => setParent(e.target.value) },
              categories.map(c => React.createElement('option', { key: c.key, value: c.key }, c.label))),
            parentCat && React.createElement('span', { className: 'fld-help' },
              parentCat.subs.length, ' subcategorias atuais · ', parentCat.kind === 'in' ? 'Receita' : 'Despesa')),

          // Nome
          React.createElement('label', { className: 'fld' },
            React.createElement('span', { className: 'fld-label' }, 'Nome'),
            React.createElement('input', { className: 'fld-input', autoFocus: true, value: name, onChange: e => { setName(e.target.value); setErr(''); },
              placeholder: kind === 'cat' ? 'Ex.: Pets, Filhos, Trabalho remoto…' : 'Ex.: Ração, Veterinário…' })),

          // CATEGORIA: tipo, cor, ícone, subs iniciais
          kind === 'cat' && React.createElement(React.Fragment, null,
            React.createElement('label', { className: 'fld' },
              React.createElement('span', { className: 'fld-label' }, 'Tipo'),
              React.createElement('div', { className: 'kind-toggle', style: { marginBottom: 0 } },
                React.createElement('button', { className: type === 'out' ? 'on' : '', onClick: () => setType('out') },
                  React.createElement(Icon, { name: 'arrowUR', size: 13 }), 'Despesa'),
                React.createElement('button', { className: type === 'in' ? 'on' : '', onClick: () => setType('in') },
                  React.createElement(Icon, { name: 'arrowDR', size: 13 }), 'Receita'))),

            React.createElement('label', { className: 'fld' },
              React.createElement('span', { className: 'fld-label' }, 'Cor'),
              React.createElement('div', { className: 'swatch-row' },
                PALETTE.map(p => React.createElement('button', {
                  key: p, className: 'swatch' + (color === p ? ' on' : ''),
                  style: { background: p }, onClick: () => setColor(p), 'aria-label': p })))),

            React.createElement('label', { className: 'fld' },
              React.createElement('span', { className: 'fld-label' }, 'Ícone'),
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                ICONS.map(ic => React.createElement('button', {
                  key: ic, onClick: () => setIconName(ic),
                  style: {
                    width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
                    border: '1px solid ' + (iconName === ic ? color : 'var(--line)'),
                    background: iconName === ic ? color : 'var(--card-2)',
                    color: iconName === ic ? '#fff' : 'var(--ink-2)',
                    transition: 'all .12s',
                  }
                }, React.createElement(Icon, { name: ic, size: 16 }))))),

            React.createElement('label', { className: 'fld' },
              React.createElement('span', { className: 'fld-label' }, 'Subcategorias iniciais (opcional)'),
              React.createElement('input', { className: 'fld-input', value: subsText, onChange: e => setSubsText(e.target.value),
                placeholder: 'Separe por vírgula. Ex.: Ração, Veterinário, Banho' }),
              React.createElement('span', { className: 'fld-help' }, 'Você pode adicionar mais depois — sem limite.')),

            // preview
            React.createElement('div', { style: { marginTop: 4, padding: 12, borderRadius: 10, border: '1px dashed var(--line-strong)', display: 'flex', alignItems: 'center', gap: 12 } },
              React.createElement('span', { className: 'cc-mark', style: { background: color, width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', color: '#fff' } },
                React.createElement(Icon, { name: iconName, size: 15 })),
              React.createElement('div', { style: { minWidth: 0 } },
                React.createElement('div', { style: { fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 14 } }, name || 'Pré-visualização'),
                React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)' } },
                  type === 'in' ? 'Receita' : 'Despesa', ' · ',
                  (subsText.split(',').map(s => s.trim()).filter(Boolean).length || 0), ' subcategorias')))),

          err && React.createElement('div', { className: 'fld-error' }, err)),

        React.createElement('div', { className: 'mdl-foot' },
          React.createElement('span', { style: { fontSize: 11.5, color: 'var(--ink-faint)' } },
            'Atalho: ',
            React.createElement('span', { className: 'mono', style: { background: 'var(--bg-sunken)', padding: '1px 6px', borderRadius: 5 } }, 'Esc'),
            ' para fechar'),
          React.createElement('div', { className: 'spacer' }),
          React.createElement('button', { className: 'btn btn-quiet', onClick: onClose }, 'Cancelar'),
          React.createElement('button', { className: 'btn btn-primary', onClick: submit },
            React.createElement(Icon, { name: 'check', size: 14 }),
            kind === 'cat' ? 'Cadastrar categoria' : 'Cadastrar subcategoria'))));
  }

  window.Screens = window.Screens || {};
  window.Screens.categories = Categorias;
})();
