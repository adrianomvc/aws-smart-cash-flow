/* SmartCashFlow — Transações + Importações (prioridade 5) */
(function () {
  const { useState, useMemo } = React;
  const Icon = window.Icon, UI = window.UI, S = window.SCF;
  const BRL = S.BRL;

  function Transactions({ onNav }) {
    const [q, setQ] = useState('');
    const [tab, setTab] = useState('all');
    const [acc, setAcc] = useState('all');
    const [rows, setRows] = useState(S.transactions);
    const [sel, setSel] = useState({});

    const accounts = ['all', ...Array.from(new Set(S.transactions.map(t => t.acc)))];
    const filtered = useMemo(() => rows.filter(t => {
      if (tab === 'in' && t.dir !== 'in') return false;
      if (tab === 'out' && t.dir !== 'out') return false;
      if (tab === 'pending' && t.review === 'ok') return false;
      if (acc !== 'all' && t.acc !== acc) return false;
      if (q && !t.desc.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }), [rows, tab, acc, q]);

    const sumIn = filtered.filter(t => t.dir === 'in').reduce((s, t) => s + t.value, 0);
    const sumOut = filtered.filter(t => t.dir === 'out').reduce((s, t) => s + t.value, 0);
    const selCount = Object.values(sel).filter(Boolean).length;
    const setCat = (id, cat) => setRows(rs => rs.map(r => r.id === id ? { ...r, cat, sub: (S.CATS[cat]?.subs || []).includes(r.sub) ? r.sub : '', review: r.review === 'uncat' ? 'ok' : r.review } : r));
    const setSub = (id, sub) => setRows(rs => rs.map(r => r.id === id ? { ...r, sub } : r));
    const pendingCount = rows.filter(t => t.review !== 'ok').length;

    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Visão', title: 'Transações', icon: 'list',
        sub: 'Consulte, filtre, revise e categorize. ' + (pendingCount ? pendingCount + ' transações precisam de revisão.' : 'Tudo revisado.'),
        right: React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => onNav('imports') }, React.createElement(Icon, { name: 'upload', size: 14 }), 'Importar'),
          React.createElement('button', { className: 'btn btn-ghost btn-sm' }, React.createElement(Icon, { name: 'download', size: 14 }), 'Exportar')) }),

      React.createElement('div', { className: 'grid cols-3', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Entradas (filtro)', value: S.num(sumIn), cur: 'R$', icon: 'arrowDR', sparkColor: 'var(--acc)' }),
        React.createElement(UI.Kpi, { label: 'Saídas (filtro)', value: S.num(Math.abs(sumOut)), cur: 'R$', icon: 'arrowUR' }),
        React.createElement(UI.Kpi, { label: 'Resultado (filtro)', value: S.num(sumIn + sumOut), cur: 'R$', icon: 'flow' })),

      React.createElement(UI.Card, null,
        // toolbar
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' } },
          React.createElement('div', { style: { position: 'relative', flex: 1, minWidth: 200 } },
            React.createElement(Icon, { name: 'search', size: 16, style: { position: 'absolute', left: 11, top: 9, color: 'var(--ink-faint)' } }),
            React.createElement('input', { value: q, onChange: e => setQ(e.target.value), placeholder: 'Buscar por descrição…', style: { width: '100%', padding: '8px 12px 8px 34px', borderRadius: 9, border: '1px solid var(--line)', fontSize: 13, background: 'var(--card-2)' } })),
          React.createElement(UI.Tabs, { value: tab, onChange: setTab, tabs: [{ id: 'all', label: 'Todas' }, { id: 'in', label: 'Entradas' }, { id: 'out', label: 'Saídas' }, { id: 'pending', label: 'A revisar', count: pendingCount }] }),
          React.createElement('select', { value: acc, onChange: e => setAcc(e.target.value), className: 'cat-select', style: { padding: '7px 10px' } },
            accounts.map(a => React.createElement('option', { key: a, value: a }, a === 'all' ? 'Todas as contas' : a)))),

        selCount > 0 && React.createElement('div', { className: 'selbar' },
          React.createElement('span', { className: 'selbar-count' }, selCount + ' selecionada' + (selCount > 1 ? 's' : '')),
          React.createElement('button', { className: 'btn btn-sm btn-ghost' }, React.createElement(Icon, { name: 'tag', size: 13 }), 'Categorizar em lote'),
          React.createElement('button', { className: 'btn btn-sm btn-ghost' }, React.createElement(Icon, { name: 'check', size: 13 }), 'Marcar revisadas'),
          React.createElement('button', { className: 'btn btn-sm btn-quiet', style: { marginLeft: 'auto' }, onClick: () => setSel({}) }, 'Limpar')),

        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', { style: { width: 32 } }),
              React.createElement('th', null, 'Data'),
              React.createElement('th', null, 'Descrição'),
              React.createElement('th', null, 'Categoria'),
              React.createElement('th', null, 'Subcategoria'),
              React.createElement('th', null, 'Conta'),
              React.createElement('th', null, 'Origem'),
              React.createElement('th', { className: 'num' }, 'Valor'),
              React.createElement('th', null, 'Status'))),
            React.createElement('tbody', null,
              filtered.map(t => React.createElement('tr', { key: t.id },
                React.createElement('td', null, React.createElement('input', { type: 'checkbox', checked: !!sel[t.id], onChange: e => setSel(s => ({ ...s, [t.id]: e.target.checked })) })),
                React.createElement('td', { className: 'mono', style: { color: 'var(--ink-3)', whiteSpace: 'nowrap' } }, t.date),
                React.createElement('td', null, React.createElement('span', { className: 't-desc' }, t.desc)),
                React.createElement('td', null, React.createElement('select', { className: 'cat-select', value: t.cat, onChange: e => setCat(t.id, e.target.value) },
                  Object.keys(S.CATS).map(k => React.createElement('option', { key: k, value: k }, S.CATS[k].label)))),
                React.createElement('td', null, React.createElement('select', { className: 'cat-select', value: t.sub || '', onChange: e => setSub(t.id, e.target.value), style: { color: t.sub ? 'var(--ink)' : 'var(--ink-faint)' } },
                  React.createElement('option', { value: '' }, '—'),
                  (S.CATS[t.cat]?.subs || []).map(s => React.createElement('option', { key: s, value: s }, s)))),
                React.createElement('td', { style: { whiteSpace: 'nowrap' } }, React.createElement('span', { className: 't-sub' }, t.acc)),
                React.createElement('td', null, React.createElement('span', { className: 'pill', style: { fontFamily: 'var(--font-mono)', fontSize: 10.5 } }, t.src)),
                React.createElement('td', { className: 'num', style: { fontWeight: 700, color: t.dir === 'in' ? 'var(--acc)' : 'var(--ink)' } }, BRL(t.value, { sign: t.dir === 'in' })),
                React.createElement('td', null, t.review === 'ok'
                  ? React.createElement(UI.Badge, { kind: 'real', icon: 'check' }, 'Revisada')
                  : t.review === 'uncat'
                    ? React.createElement(UI.Badge, { kind: 'warn', icon: 'alert' }, 'Sem categoria')
                    : React.createElement(UI.Badge, { kind: 'low', icon: 'clock' }, 'Pendente'))))))),

        filtered.length === 0 && React.createElement(UI.State, { icon: 'search', title: 'Nenhuma transação encontrada' }, 'Ajuste os filtros ou o termo de busca.'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', padding: '11px 14px', borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-3)' } },
          'Mostrando ', React.createElement('b', { style: { margin: '0 4px', color: 'var(--ink-2)' } }, filtered.length), ' de ' + rows.length + ' transações',
          React.createElement('span', { style: { marginLeft: 'auto' } }, 'Página 1 de 1'))));
  }

  // ---------- Importações ----------
  function Imports({ onNav }) {
    const statusMap = {
      done: { k: 'real', ic: 'checkCircle', label: 'Concluída' },
      warn: { k: 'warn', ic: 'alert', label: 'Concluída com erros' },
      dup: { k: 'info', ic: 'refresh', label: 'Duplicada' },
      failed: { k: 'neg', ic: 'xCircle', label: 'Falhou' },
      processing: { k: 'integ', ic: 'clock', label: 'Processando' },
    };
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Visão', title: 'Importações', icon: 'upload',
        sub: 'Traga seus extratos e faturas. Suportamos OFX, CSV, TXT e Excel. Preservamos o arquivo original e cada linha bruta.' }),

      React.createElement('div', { className: 'dash-main', style: { marginBottom: 16 } },
        React.createElement(UI.Card, { className: 'card-pad' },
          React.createElement('div', { className: 'dropzone' },
            React.createElement('div', { className: 'state-ic', style: { margin: '0 auto 10px', background: 'var(--acc-soft)', color: 'var(--acc)' } }, React.createElement(Icon, { name: 'upload', size: 24 })),
            React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, 'Arraste arquivos aqui'),
            React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '4px 0 12px' } }, 'ou clique para selecionar · OFX, CSV, TXT, XLSX'),
            React.createElement('button', { className: 'btn btn-primary btn-sm', style: { margin: '0 auto' } }, React.createElement(Icon, { name: 'folder', size: 14 }), 'Selecionar arquivos')),
          React.createElement(UI.Alert, { type: 'info', title: 'Lotes grandes', }, 'Para arquivos com mais de 5.000 linhas, o processamento é assíncrono. Você pode sair desta tela — avisaremos quando concluir.')),

        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 12 } }, 'Resumo de hoje'),
            React.createElement('div', { style: { display: 'grid', gap: 10 } },
              React.createElement(ImpStat, { label: 'Linhas novas', value: 284, color: 'var(--acc)' }),
              React.createElement(ImpStat, { label: 'Duplicadas (ignoradas)', value: 160, color: 'var(--info)' }),
              React.createElement(ImpStat, { label: 'Com erro', value: 16, color: 'var(--neg)' }),
              React.createElement(ImpStat, { label: 'Arquivos processados', value: 6, color: 'var(--ink-3)' }))),
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, 'Categorização automática'),
            React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
              React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 } }, '78%'),
              React.createElement('span', { className: 'muted', style: { fontSize: 12 } }, 'das novas linhas')),
            React.createElement('p', { style: { fontSize: 12, color: 'var(--ink-3)', margin: '6px 0 0', lineHeight: 1.5 } }, 'Regras determinísticas aplicadas. O restante aguarda revisão manual em Transações.'))) ),

      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Histórico de importações', sub: 'Arquivos enviados e seu processamento', icon: 'clock' }),
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Arquivo'), React.createElement('th', null, 'Enviado'),
              React.createElement('th', { className: 'num' }, 'Linhas'), React.createElement('th', { className: 'num' }, 'Novas'),
              React.createElement('th', { className: 'num' }, 'Erros'), React.createElement('th', { className: 'num' }, 'Dup.'),
              React.createElement('th', null, 'Status'), React.createElement('th', null, ''))),
            React.createElement('tbody', null,
              S.imports.map((im, i) => {
                const st = statusMap[im.status];
                return React.createElement('tr', { key: i },
                  React.createElement('td', null, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
                    React.createElement('span', { className: 'goal-ic', style: { background: 'var(--bg-sunken)', color: 'var(--ink-3)' } }, React.createElement(Icon, { name: 'file', size: 14 })),
                    React.createElement('div', null, React.createElement('div', { className: 't-desc mono', style: { fontSize: 12.5 } }, im.file), React.createElement('div', { className: 't-sub' }, im.size)))),
                  React.createElement('td', { className: 'mono t-sub', style: { whiteSpace: 'nowrap' } }, im.date),
                  React.createElement('td', { className: 'num' }, im.status === 'processing' ? '—' : im.rows),
                  React.createElement('td', { className: 'num', style: { color: im.news ? 'var(--acc)' : 'var(--ink-faint)', fontWeight: im.news ? 700 : 400 } }, im.news || '—'),
                  React.createElement('td', { className: 'num', style: { color: im.errors ? 'var(--neg)' : 'var(--ink-faint)', fontWeight: im.errors ? 700 : 400 } }, im.errors || '—'),
                  React.createElement('td', { className: 'num t-sub' }, im.dup || '—'),
                  React.createElement('td', null, React.createElement(UI.Badge, { kind: st.k, icon: st.ic }, st.label)),
                  React.createElement('td', null, React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: () => im.status !== 'processing' && onNav('transactions') },
                    im.status === 'failed' ? 'Ver erros' : im.status === 'processing' ? '…' : 'Ver linhas'))); })))),
        React.createElement('div', { style: { padding: 14 } },
          React.createElement(UI.Alert, { type: 'warn', title: 'recibos.txt falhou na importação' }, 'O arquivo não segue um formato reconhecido (12 linhas inválidas). Verifique se é um extrato bancário em TXT delimitado, ou converta para CSV.'))));
  }

  function ImpStat({ label, value, color }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('span', { className: 'sdot', style: { background: color, width: 8, height: 8 } }),
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', flex: 1 } }, label),
      React.createElement('span', { className: 'mono', style: { fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' } }, value));
  }

  window.Screens = window.Screens || {};
  window.Screens.transactions = Transactions;
  window.Screens.imports = Imports;
})();
