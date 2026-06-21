/* SmartCashFlow — Painéis de Configurações detalhados
   Perfil · Segurança · Regras e Normalização · Contas e Bancos · Importação */
(function () {
  const { useState, useMemo } = React;
  const Icon = window.Icon, UI = window.UI, S = window.SCF;

  // ---------- helpers --------------------------------------------------------
  const Row = ({ label, hint, children }) => React.createElement('div', { className: 'pref-row' },
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { style: { fontSize: 13.5, fontWeight: 600 } }, label),
      hint && React.createElement('div', { className: 't-sub', style: { marginTop: 2, lineHeight: 1.45 } }, hint)),
    React.createElement('div', { style: { flex: 'none' } }, children));

  const Field = ({ label, hint, children }) =>
    React.createElement('label', { className: 'fld', style: { marginBottom: 12 } },
      React.createElement('span', { className: 'fld-label' }, label),
      children,
      hint && React.createElement('span', { className: 'fld-help' }, hint));

  const Footer = ({ onSave, onCancel, info }) => React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--line)', background: 'var(--card-2)' }
  },
    info && React.createElement('span', { style: { fontSize: 12, color: 'var(--ink-3)' } }, info),
    React.createElement('div', { style: { flex: 1 } }),
    React.createElement('button', { className: 'btn btn-quiet btn-sm', onClick: onCancel }, 'Descartar'),
    React.createElement('button', { className: 'btn btn-primary btn-sm', onClick: onSave },
      React.createElement(Icon, { name: 'check', size: 14 }), 'Salvar alterações'));

  // ============================================================== PERFIL =====
  function Profile() {
    const me = S.members[0];
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Perfil', sub: 'Suas informações pessoais e visuais.', icon: 'users' }),

      // Hero avatar
      React.createElement('div', { style: { display: 'flex', gap: 18, alignItems: 'center', padding: '18px 20px 6px' } },
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('span', { className: 'avatar', style: { background: me.color, width: 72, height: 72, fontSize: 22, borderRadius: 18 } }, me.initials),
          React.createElement('button', {
            className: 'btn btn-primary btn-sm',
            style: { position: 'absolute', bottom: -6, right: -6, width: 30, height: 30, padding: 0, borderRadius: '50%' },
            title: 'Trocar foto'
          }, React.createElement(Icon, { name: 'edit', size: 13 }))),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 } }, me.name),
          React.createElement('div', { className: 't-sub', style: { marginTop: 2 } }, me.email, ' · Proprietário do workspace ', S.workspace.name),
          React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 10 } },
            React.createElement('button', { className: 'btn btn-quiet btn-sm' }, React.createElement(Icon, { name: 'upload', size: 13 }), 'Carregar imagem'),
            React.createElement('button', { className: 'btn btn-quiet btn-sm' }, 'Remover')))),

      React.createElement('div', { style: { padding: '14px 20px 4px' } },
        React.createElement('div', { className: 'fld-grid' },
          React.createElement(Field, { label: 'Nome completo' },
            React.createElement('input', { className: 'fld-input', defaultValue: me.name })),
          React.createElement(Field, { label: 'Como prefere ser chamado' },
            React.createElement('input', { className: 'fld-input', defaultValue: 'Marcos' })),
          React.createElement(Field, { label: 'E-mail principal', hint: 'Usado para login e notificações.' },
            React.createElement('input', { className: 'fld-input', defaultValue: me.email, type: 'email' })),
          React.createElement(Field, { label: 'Telefone celular', hint: 'Para SMS e autenticação em 2 fatores.' },
            React.createElement('input', { className: 'fld-input', defaultValue: '+55 (11) 9 9123-4567' })),
          React.createElement(Field, { label: 'Data de nascimento' },
            React.createElement('input', { className: 'fld-input', defaultValue: '1984-03-12', type: 'date' })),
          React.createElement(Field, { label: 'CPF (opcional)', hint: 'Usado só para futuras integrações fiscais.' },
            React.createElement('input', { className: 'fld-input', defaultValue: '•••.•••.123-•', type: 'text' })),
          React.createElement(Field, { label: 'Profissão / fonte de renda' },
            React.createElement('input', { className: 'fld-input', defaultValue: 'Engenheiro de software' })),
          React.createElement(Field, { label: 'Cidade / fuso' },
            React.createElement('select', { className: 'fld-select', defaultValue: 'sp' },
              React.createElement('option', { value: 'sp' }, 'São Paulo · BRT (UTC-3)'),
              React.createElement('option', { value: 'rj' }, 'Rio de Janeiro · BRT (UTC-3)'),
              React.createElement('option', { value: 'mn' }, 'Manaus · AMT (UTC-4)')))),

        React.createElement('div', { className: 'eyebrow', style: { marginTop: 8, marginBottom: 10 } }, 'Preferências de exibição'),
        React.createElement(Row, { label: 'Tema', hint: 'Modo escuro disponível em breve.' },
          React.createElement('div', { className: 'kind-toggle', style: { marginBottom: 0, width: 240 } },
            React.createElement('button', { className: 'on' }, 'Claro'),
            React.createElement('button', null, 'Escuro'),
            React.createElement('button', null, 'Sistema'))),
        React.createElement(Row, { label: 'Ocultar valores na tela', hint: 'Substitui números por •••• ao abrir o app.' },
          React.createElement(UI.Toggle, { on: false, onChange: () => { } })),
        React.createElement(Row, { label: 'Densidade visual', hint: 'Compacto reduz alturas e paddings.' },
          React.createElement('select', { className: 'fld-select', defaultValue: 'confortavel', style: { width: 160 } },
            React.createElement('option', { value: 'confortavel' }, 'Confortável'),
            React.createElement('option', { value: 'compacto' }, 'Compacto')))),

      React.createElement(Footer, { info: 'Suas alterações afetam apenas seu perfil — outros membros têm os próprios.' }));
  }

  // ============================================================== SEGURANÇA ==
  function Security() {
    const [pwOpen, setPwOpen] = useState(false);
    const sessions = [
      { dev: 'MacBook Pro · Chrome', loc: 'São Paulo, BR · 192.168.0.12', when: 'Agora', current: true, ic: 'flow' },
      { dev: 'iPhone 15 · Safari', loc: 'São Paulo, BR · LTE', when: 'há 4 min', current: false, ic: 'phone' },
      { dev: 'iPad · App SmartCashFlow', loc: 'Campos do Jordão, BR · Wi-Fi', when: 'há 3 dias', current: false, ic: 'phone' },
      { dev: 'Chrome · Windows', loc: 'Curitiba, BR · 200.198.•.•', when: 'há 2 semanas', current: false, ic: 'flow' },
    ];
    const log = [
      { when: 'Hoje · 09:18', what: 'Login bem-sucedido', meta: 'Chrome · São Paulo, BR', kind: 'pos', ic: 'check' },
      { when: 'Ontem · 21:04', what: 'Senha alterada', meta: 'iPhone · App', kind: 'info', ic: 'lock' },
      { when: '02/jun · 14:22', what: 'Membro convidado: tio.carlos@email.com', meta: 'Papel: visualizador', kind: 'info', ic: 'send' },
      { when: '31/mai · 03:11', what: 'Tentativa de login bloqueada', meta: 'IP suspeito · Manaus, BR', kind: 'warn', ic: 'alert' },
      { when: '28/mai · 10:55', what: 'Exportação de dados (CSV)', meta: 'Transações · mai/2026', kind: 'info', ic: 'download' },
    ];

    return React.createElement('div', { className: 'vstack', style: { gap: 16 } },
      // Senha & 2FA
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Acesso à conta', sub: 'Senha, autenticação em duas etapas e bloqueio.', icon: 'lock' }),
        React.createElement('div', { style: { padding: '4px 18px 14px' } },
          React.createElement(Row, { label: 'Senha', hint: 'Última troca há 21 dias · força forte.' },
            React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => setPwOpen(v => !v) }, 'Alterar senha')),
          pwOpen && React.createElement('div', { className: 'fld-grid', style: { padding: '8px 0 12px' } },
            React.createElement(Field, { label: 'Senha atual' }, React.createElement('input', { className: 'fld-input', type: 'password', placeholder: '•••••••' })),
            React.createElement(Field, { label: 'Nova senha' }, React.createElement('input', { className: 'fld-input', type: 'password', placeholder: 'mín. 10 caracteres' })),
            React.createElement(Field, { label: 'Confirmar' }, React.createElement('input', { className: 'fld-input', type: 'password' }))),
          React.createElement(Row, { label: 'Autenticação em 2 etapas (2FA)', hint: 'Usando app autenticador · Google Authenticator.' },
            React.createElement(UI.Badge, { kind: 'pos', icon: 'check' }, 'Ativa')),
          React.createElement(Row, { label: 'Códigos de recuperação', hint: 'Imprima ou guarde em local seguro. 8 códigos válidos.' },
            React.createElement('button', { className: 'btn btn-quiet btn-sm' }, React.createElement(Icon, { name: 'download', size: 13 }), 'Baixar códigos')),
          React.createElement(Row, { label: 'Bloqueio biométrico no app', hint: 'Pede Face ID / digital ao abrir o app móvel.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Sessão expira após inatividade', hint: 'Faz logout automático.' },
            React.createElement('select', { className: 'fld-select', defaultValue: '30', style: { width: 150 } },
              ['15 min', '30 min', '1 hora', '4 horas', 'Nunca'].map(o => React.createElement('option', { key: o }, o)))))),

      // Sessões ativas
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, {
          title: 'Sessões ativas', sub: 'Dispositivos conectados à sua conta agora.', icon: 'shield',
          right: React.createElement('button', { className: 'btn btn-quiet btn-sm' }, React.createElement(Icon, { name: 'x', size: 13 }), 'Encerrar outras sessões')
        }),
        React.createElement('div', { style: { padding: '0 4px 6px' } },
          sessions.map((s, i) => React.createElement('div', { key: i, className: 'row-item', style: { padding: '12px 16px' } },
            React.createElement('span', {
              style: {
                width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
                background: s.current ? 'var(--acc-soft)' : 'var(--bg-sunken)',
                color: s.current ? 'var(--acc)' : 'var(--ink-3)', flex: 'none'
              }
            }, React.createElement(Icon, { name: s.ic, size: 16 })),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement('span', { className: 't-desc' }, s.dev),
                s.current && React.createElement(UI.Badge, { kind: 'pos' }, 'Esta sessão')),
              React.createElement('div', { className: 't-sub' }, s.loc)),
            React.createElement('span', { className: 't-sub mono', style: { marginRight: 10 } }, s.when),
            !s.current && React.createElement('button', { className: 'btn btn-quiet btn-sm' }, 'Encerrar'))))),

      // Histórico de segurança
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Histórico de segurança', sub: 'Últimos 30 dias.', icon: 'clock' }),
        React.createElement('div', { style: { padding: '4px 4px 12px' } },
          log.map((e, i) => React.createElement('div', { key: i, className: 'row-item', style: { padding: '11px 16px' } },
            React.createElement('span', { className: 'goal-ic', style: { width: 30, height: 30, background: 'var(--bg-sunken)', color: 'var(--ink-2)', flex: 'none' } },
              React.createElement(Icon, { name: e.ic, size: 14 })),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { className: 't-desc' }, e.what),
              React.createElement('div', { className: 't-sub' }, e.meta)),
            React.createElement(UI.Badge, { kind: e.kind }, e.when))))),

      // Zona de risco
      React.createElement(UI.Card, { style: { borderColor: 'var(--neg-soft)' } },
        React.createElement('div', { style: { padding: '16px 18px' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } },
            React.createElement('span', { className: 'goal-ic', style: { background: 'var(--neg-soft)', color: 'var(--neg)' } },
              React.createElement(Icon, { name: 'alert', size: 15 })),
            React.createElement('span', { style: { fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 15 } }, 'Zona de risco')),
          React.createElement('div', { className: 'pref-row', style: { borderTop: '1px solid var(--line)', borderBottom: 'none' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontWeight: 600, fontSize: 13.5 } }, 'Exportar todos os meus dados'),
              React.createElement('div', { className: 't-sub' }, 'Pacote ZIP com transações, regras, categorias e configurações.')),
            React.createElement('button', { className: 'btn btn-quiet btn-sm' }, React.createElement(Icon, { name: 'download', size: 13 }), 'Solicitar')),
          React.createElement('div', { className: 'pref-row', style: { borderBottom: 'none' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontWeight: 600, fontSize: 13.5 } }, 'Excluir minha conta'),
              React.createElement('div', { className: 't-sub' }, 'Remove permanentemente todos os dados. Esta ação é irreversível.')),
            React.createElement('button', { className: 'btn btn-sm', style: { background: 'var(--neg-soft)', color: 'var(--neg)' } }, 'Excluir conta')))));
  }

  // ============================================================== REGRAS ====
  function Rules() {
    const [tab, setTab] = useState('rules'); // rules | merchants | aliases
    const rules = [
      { name: 'iFood / Restaurantes', match: 'descrição contém "iFood *"', cat: 'alimentacao', sub: 'Delivery', hits: 48, last: 'há 2h', on: true, prio: 1 },
      { name: 'Combustível', match: 'descrição contém "Posto" OU "Shell" OU "Petrobras"', cat: 'transporte', sub: 'Combustível', hits: 12, last: 'ontem', on: true, prio: 2 },
      { name: 'Streaming', match: 'descrição contém "Netflix" OU "Spotify" OU "HBO Max"', cat: 'assinaturas', sub: 'Streaming', hits: 6, last: 'há 4 dias', on: true, prio: 3 },
      { name: 'Salário Marcos', match: 'descrição = "Salário — Marcos" E valor > 5.000', cat: 'renda', sub: 'Salário', hits: 6, last: '06/jun', on: true, prio: 4 },
      { name: 'Mercados grandes', match: 'descrição contém "Carrefour" OU "Pão de Açúcar" OU "Atacadão"', cat: 'mercado', sub: 'Hipermercado', hits: 22, last: 'há 3 dias', on: true, prio: 5 },
      { name: 'Uber/99', match: 'descrição contém "Uber *" OU "99App"', cat: 'transporte', sub: 'Apps (Uber/99)', hits: 31, last: 'há 1h', on: true, prio: 6 },
      { name: 'Mensalidade escola', match: 'descrição contém "Adventus" E valor entre 1.800 e 2.100', cat: 'educacao', sub: 'Mensalidade', hits: 1, last: '05/jun', on: true, prio: 7 },
      { name: 'Farmácia', match: 'descrição contém "Drogaria" OU "Drogasil" OU "Farmácia"', cat: 'saude', sub: 'Farmácia', hits: 9, last: 'há 2 dias', on: false, prio: 8 },
    ];

    const merchants = [
      { raw: 'IFOOD *PIZZARIA NAPOLI', clean: 'iFood — Pizzaria Napoli', cat: 'alimentacao', sub: 'Delivery', cnt: 14 },
      { raw: 'PG*UBER TRIP HELP UB', clean: 'Uber', cat: 'transporte', sub: 'Apps (Uber/99)', cnt: 28 },
      { raw: 'NUBANK*ASS NETFLIX BR', clean: 'Netflix', cat: 'assinaturas', sub: 'Streaming', cnt: 6 },
      { raw: 'POSTO SHELL AV PAULISTA', clean: 'Posto Shell — Av. Paulista', cat: 'transporte', sub: 'Combustível', cnt: 4 },
      { raw: 'CARREFOUR HIP 1234SP', clean: 'Carrefour Hiper', cat: 'mercado', sub: 'Hipermercado', cnt: 9 },
      { raw: 'AMZN*MKTPLACE BR', clean: 'Amazon', cat: 'outros', sub: 'Compras online', cnt: 11 },
    ];

    const aliases = [
      { from: 'BANCO ITAU SA', to: 'Itaú', kind: 'Instituição' },
      { from: 'PG*UBER', to: 'Uber', kind: 'Estabelecimento' },
      { from: 'IFOOD *', to: 'iFood', kind: 'Estabelecimento' },
      { from: 'SAL — Marcos', to: 'Salário', kind: 'Subcategoria' },
      { from: 'PIX REC TRANS', to: 'PIX recebido', kind: 'Origem' },
    ];

    return React.createElement('div', { className: 'vstack', style: { gap: 16 } },
      // KPIs do motor de regras
      React.createElement(UI.Card, { className: 'card-pad' },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 } },
          React.createElement(UI.Kpi, { label: 'Regras ativas', value: rules.filter(r => r.on).length, cur: null, icon: 'filter' }),
          React.createElement(UI.Kpi, { label: 'Auto-classificados', value: '92%', cur: null, icon: 'sparkles', sub: 'últimos 30 dias' }),
          React.createElement(UI.Kpi, { label: 'Padrões aprendidos', value: 'Auto', cur: null, icon: 'spark', sub: 'merchants normalizados' }),
          React.createElement(UI.Kpi, { label: 'Sem regra', value: '3 lanç.', cur: null, icon: 'alert', sub: 'aguardam revisão' }))),

      // Tabs
      React.createElement(UI.Card, null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12, borderBottom: '1px solid var(--line)' } },
          React.createElement(UI.Tabs, {
            value: tab, onChange: setTab,
            tabs: [{ id: 'rules', label: 'Regras' }, { id: 'merchants', label: 'Normalização de Merchants' }, { id: 'aliases', label: 'Apelidos / Alias' }]
          }),
          React.createElement('div', { style: { flex: 1 } }),
          React.createElement('button', { className: 'btn btn-primary btn-sm' },
            React.createElement(Icon, { name: 'plus', size: 14 }),
            tab === 'rules' ? 'Nova regra' : tab === 'merchants' ? 'Novo padrão' : 'Novo apelido')),

        tab === 'rules' && React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', { style: { width: 50 } }, 'Prio'),
              React.createElement('th', null, 'Regra'),
              React.createElement('th', null, 'Condição'),
              React.createElement('th', null, 'Aplica'),
              React.createElement('th', { className: 'num' }, 'Acertos'),
              React.createElement('th', null, 'Última'),
              React.createElement('th', null, 'Status'),
              React.createElement('th', null, ''))),
            React.createElement('tbody', null, rules.map((r, i) => {
              const c = S.CATS[r.cat];
              return React.createElement('tr', { key: i },
                React.createElement('td', { className: 'mono t-sub' }, String(r.prio).padStart(2, '0')),
                React.createElement('td', { className: 't-desc' }, r.name),
                React.createElement('td', { className: 't-sub mono', style: { fontSize: 11.5 } }, r.match),
                React.createElement('td', null,
                  React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { className: 'catdot', style: { background: c.color, width: 8, height: 8 } }),
                    React.createElement('span', null, c.label, ' › ', r.sub))),
                React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, r.hits),
                React.createElement('td', { className: 't-sub mono' }, r.last),
                React.createElement('td', null, React.createElement(UI.Toggle, { on: r.on, onChange: () => { } })),
                React.createElement('td', null, React.createElement('span', { className: 'row-act' },
                  React.createElement('button', { title: 'Subir' }, React.createElement(Icon, { name: 'arrowUR', size: 13 })),
                  React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 13 })),
                  React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 13 })))));
            }))),

        tab === 'merchants' && React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Descrição original'),
              React.createElement('th', null, 'Após normalização'),
              React.createElement('th', null, 'Categoria sugerida'),
              React.createElement('th', { className: 'num' }, 'Ocorrências'),
              React.createElement('th', null, ''))),
            React.createElement('tbody', null, merchants.map((m, i) => {
              const c = S.CATS[m.cat];
              return React.createElement('tr', { key: i },
                React.createElement('td', { className: 'mono t-sub', style: { fontSize: 11.5 } }, m.raw),
                React.createElement('td', { className: 't-desc' }, '→ ', m.clean),
                React.createElement('td', null, React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
                  React.createElement('span', { className: 'catdot', style: { background: c.color, width: 8, height: 8 } }),
                  React.createElement('span', null, c.label, ' › ', m.sub))),
                React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, m.cnt),
                React.createElement('td', null, React.createElement('span', { className: 'row-act' },
                  React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 13 })),
                  React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 13 })))));
            }))),

        tab === 'aliases' && React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'De'),
              React.createElement('th', null, 'Para'),
              React.createElement('th', null, 'Tipo'),
              React.createElement('th', null, ''))),
            React.createElement('tbody', null, aliases.map((a, i) =>
              React.createElement('tr', { key: i },
                React.createElement('td', { className: 'mono t-sub' }, a.from),
                React.createElement('td', { className: 't-desc' }, a.to),
                React.createElement('td', null, React.createElement(UI.Badge, { kind: 'neutral' }, a.kind)),
                React.createElement('td', null, React.createElement('span', { className: 'row-act' },
                  React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 13 })),
                  React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 13 }))))))))),

      // Preferências
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Como aplicamos as regras', icon: 'sliders' }),
        React.createElement('div', { style: { padding: '4px 18px 14px' } },
          React.createElement(Row, { label: 'Aplicar regras em importações', hint: 'Classifica automaticamente arquivos novos.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Reprocessar transações antigas', hint: 'Reaplica regras quando você criar ou editar uma.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Sugerir regras a partir de padrões', hint: 'IA propõe regras quando vê 3+ lançamentos parecidos.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Confiança mínima para auto-aplicar', hint: 'Abaixo disso, fica como sugestão.' },
            React.createElement('select', { className: 'fld-select', defaultValue: '85', style: { width: 120 } },
              ['70%', '80%', '85%', '90%', '95%'].map(o => React.createElement('option', { key: o }, o))))))))));
  }

  // ============================================================== CONTAS ====
  function Accounts() {
    const accs = [
      { name: 'Itaú · Conta Corrente', kind: 'Conta corrente', last: '9871', brand: 'Itaú', color: '#ec7000', balance: 24380, sync: 'OFX manual', conn: 'manual', updated: 'há 2h', tx: 268, primary: true },
      { name: 'Nubank · Cartão', kind: 'Cartão de crédito', last: '4821', brand: 'Nubank', color: '#7b3fe4', balance: -3420, sync: 'CSV / fatura', conn: 'csv', updated: 'há 4h', tx: 96, primary: false },
      { name: 'Itaú Click · Cartão', kind: 'Cartão de crédito', last: '0712', brand: 'Itaú', color: '#1f4fa3', balance: -1860, sync: 'OFX manual', conn: 'manual', updated: 'há 1d', tx: 42, primary: false },
      { name: 'XP Investimentos · Conta', kind: 'Corretora', last: '0042', brand: 'XP', color: '#000000', balance: 86420, sync: 'API conectada', conn: 'api', updated: 'agora', tx: 12, primary: false },
      { name: 'Caixa · Poupança', kind: 'Poupança', last: '5530', brand: 'Caixa', color: '#0072ce', balance: 18900, sync: 'Manual', conn: 'manual', updated: 'há 3d', tx: 8, primary: false },
    ];

    const total = accs.reduce((s, a) => s + a.balance, 0);

    const Mark = ({ a }) => React.createElement('span', {
      style: {
        width: 38, height: 38, borderRadius: 10, background: a.color, color: '#fff',
        display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, flex: 'none', letterSpacing: '-.5px'
      }
    }, a.brand.slice(0, 2).toUpperCase());

    const ConnBadge = ({ c }) => {
      const m = {
        api: { k: 'pos', l: 'API conectada' },
        ofx: { k: 'info', l: 'OFX automático' },
        csv: { k: 'neutral', l: 'CSV / fatura' },
        manual: { k: 'low', l: 'Manual / OFX' },
      }[c];
      return React.createElement(UI.Badge, { kind: m.k }, m.l);
    };

    return React.createElement('div', { className: 'vstack', style: { gap: 16 } },
      // Resumo
      React.createElement('div', { className: 'grid cols-4' },
        React.createElement(UI.Kpi, { label: 'Contas e cartões', value: accs.length, cur: null, icon: 'building' }),
        React.createElement(UI.Kpi, { label: 'Saldo consolidado', value: S.num(total), cur: 'R$', icon: 'wallet' }),
        React.createElement(UI.Kpi, { label: 'Conectadas via API', value: accs.filter(a => a.conn === 'api').length, cur: null, icon: 'link', sub: 'sincronização automática' }),
        React.createElement(UI.Kpi, { label: 'Última atualização', value: 'agora', cur: null, icon: 'refresh', sub: 'XP Investimentos' })),

      // Lista
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, {
          title: 'Contas e bancos', sub: 'Cada conta vira uma origem de transações. Cartões e investimentos também entram aqui.', icon: 'building',
          right: React.createElement('div', { style: { display: 'flex', gap: 6 } },
            React.createElement('button', { className: 'btn btn-ghost btn-sm' }, React.createElement(Icon, { name: 'refresh', size: 13 }), 'Sincronizar tudo'),
            React.createElement('button', { className: 'btn btn-primary btn-sm' }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Conectar conta'))
        }),
        React.createElement('div', null,
          accs.map((a, i) => React.createElement('div', {
            key: i,
            className: 'stg-acc-row',
            style: { borderTop: i ? '1px solid var(--line)' : 'none' }
          },
            React.createElement(Mark, { a }),
            React.createElement('div', { className: 'stg-ar-info', style: { minWidth: 0 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement('span', { className: 't-desc', style: { fontSize: 14 } }, a.name),
                a.primary && React.createElement(UI.Badge, { kind: 'pos' }, 'Principal')),
              React.createElement('div', { className: 't-sub' }, a.kind, ' · final ', React.createElement('span', { className: 'mono' }, '••', a.last), ' · ', a.tx, ' lançamentos')),
            React.createElement('div', { className: 'stg-ar-conn', style: { minWidth: 0 } },
              React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 } },
                React.createElement(ConnBadge, { c: a.conn }),
                React.createElement('span', { className: 't-sub mono' }, 'atualizado ', a.updated)),
              React.createElement('div', { className: 't-sub' }, 'origem: ', a.sync)),
            React.createElement('div', { className: 'stg-ar-bal', style: { textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 15, color: a.balance < 0 ? 'var(--neg)' : 'var(--ink)' } },
              (a.balance < 0 ? '−R$ ' : 'R$ '), S.num(Math.abs(a.balance))),
            React.createElement('div', { className: 'row-act stg-ar-act' },
              React.createElement('button', { title: 'Sincronizar' }, React.createElement(Icon, { name: 'refresh', size: 14 })),
              React.createElement('button', { title: 'Editar' }, React.createElement(Icon, { name: 'edit', size: 14 })),
              React.createElement('button', { title: 'Mais' }, React.createElement(Icon, { name: 'dots', size: 14 })))))),

      // Conectar via Open Finance
      React.createElement('div', { className: 'grid cols-2', style: { gap: 14 } },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Conectar via Open Finance', sub: 'Instituições suportadas pela integração regulada.', icon: 'link' }),
          React.createElement('div', { style: { padding: '6px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 } },
            [['Itaú', '#ec7000'], ['Nubank', '#7b3fe4'], ['Bradesco', '#cc092f'], ['Santander', '#cf0a2c'],
              ['Banco do Brasil', '#fff200'], ['Caixa', '#0072ce'], ['Inter', '#ff7a00'], ['BTG Pactual', '#0b1c2c'],
              ['XP', '#000000'], ['C6 Bank', '#1c1c1c'], ['Sicredi', '#3d8b40'], ['Mais bancos', '#8a96aa']]
              .map(([n, col], i) => React.createElement('button', {
                key: i,
                style: {
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card-2)',
                  fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                }
              },
                React.createElement('span', { style: { width: 22, height: 22, borderRadius: 7, background: col, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 } }, n.slice(0, 2).toUpperCase()),
                React.createElement('span', { style: { flex: 1, textAlign: 'left' } }, n))))),

        React.createElement(UI.Card, { className: 'card-pad' },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
            React.createElement('span', { className: 'goal-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)' } },
              React.createElement(Icon, { name: 'shield', size: 15 })),
            React.createElement('span', { style: { fontWeight: 700, fontSize: 14 } }, 'Conexões seguras')),
          React.createElement('ul', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 } },
            ['Open Finance regulado pelo Banco Central',
              'SmartCashFlow só vê transações — nunca move dinheiro',
              'Você pode revogar o acesso a qualquer momento',
              'Dados criptografados em repouso e em trânsito'].map((t, i) =>
                React.createElement('li', { key: i, style: { display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 } },
                  React.createElement(Icon, { name: 'check', size: 15, style: { color: 'var(--acc)', flex: 'none' } }), t)))))));
  }

  // ============================================================== IMPORT ====
  function ImportData() {
    const [drag, setDrag] = useState(false);
    const fmts = [
      { ext: 'OFX', color: '#3567b8', desc: 'Extrato bancário padrão', big: true },
      { ext: 'CSV', color: '#1f8a5b', desc: 'Cartão / planilha exportada', big: true },
      { ext: 'XLSX', color: '#6a52c9', desc: 'Excel / Google Sheets' },
      { ext: 'PDF', color: '#cf4d43', desc: 'Fatura com leitura OCR (beta)' },
      { ext: 'QIF', color: '#7c8696', desc: 'Software legado' },
      { ext: 'API', color: '#2a9d8f', desc: 'Open Finance' },
    ];

    const status = {
      done: { k: 'pos', l: 'Importado' },
      warn: { k: 'warn', l: 'Avisos' },
      dup: { k: 'neutral', l: 'Duplicado' },
      err: { k: 'neg', l: 'Erro' },
    };

    return React.createElement('div', { className: 'vstack', style: { gap: 16 } },
      // Drop area
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Importar arquivos', sub: 'Arraste OFX, CSV, XLSX ou PDF aqui. Suas regras serão aplicadas automaticamente.', icon: 'upload' }),
        React.createElement('div', { style: { padding: '0 18px 18px' } },
          React.createElement('div', {
            onDragOver: (e) => { e.preventDefault(); setDrag(true); },
            onDragLeave: () => setDrag(false),
            onDrop: (e) => { e.preventDefault(); setDrag(false); },
            style: {
              border: '2px dashed ' + (drag ? 'var(--acc)' : 'var(--line-strong)'),
              borderRadius: 'var(--r-md)', padding: '38px 24px',
              textAlign: 'center', background: drag ? 'var(--acc-soft)' : 'var(--card-2)',
              transition: 'all .15s',
            }
          },
            React.createElement('div', { style: { width: 52, height: 52, borderRadius: 14, background: 'var(--acc-soft)', color: 'var(--acc)', display: 'inline-grid', placeItems: 'center', marginBottom: 12 } },
              React.createElement(Icon, { name: 'upload', size: 22 })),
            React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 4 } },
              drag ? 'Solte os arquivos para importar' : 'Arraste arquivos ou clique para selecionar'),
            React.createElement('div', { className: 't-sub', style: { marginBottom: 14 } }, 'Múltiplos arquivos suportados · Até 25 MB por arquivo'),
            React.createElement('div', { style: { display: 'inline-flex', gap: 8 } },
              React.createElement('button', { className: 'btn btn-primary btn-sm' }, React.createElement(Icon, { name: 'upload', size: 14 }), 'Selecionar arquivos'),
              React.createElement('button', { className: 'btn btn-ghost btn-sm' }, React.createElement(Icon, { name: 'link', size: 14 }), 'Conectar via Open Finance'))),

          // Formatos
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 14 } },
            fmts.map((f, i) => React.createElement('div', {
              key: i,
              style: {
                border: '1px solid var(--line)', borderRadius: 10, padding: '12px 12px',
                background: 'var(--card-2)', display: 'flex', alignItems: 'center', gap: 10
              }
            },
              React.createElement('span', { style: { width: 32, height: 32, borderRadius: 8, background: f.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, flex: 'none' } }, f.ext),
              React.createElement('div', { style: { minWidth: 0 } },
                React.createElement('div', { style: { fontWeight: 600, fontSize: 12.5 } }, f.ext),
                React.createElement('div', { className: 't-sub', style: { fontSize: 11, lineHeight: 1.35 } }, f.desc))))))),

      // Preferências
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Preferências de importação', icon: 'sliders' }),
        React.createElement('div', { style: { padding: '4px 18px 14px' } },
          React.createElement(Row, { label: 'Detectar duplicatas', hint: 'Compara data + valor + descrição para evitar registros repetidos.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Aplicar regras automaticamente', hint: 'Classifica usando suas regras e padrões aprendidos.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Normalizar descrição (merchants)', hint: 'Substitui "PG*UBER TRIP HELP" por "Uber".' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Conciliar com previsões', hint: 'Casa lançamentos importados com compromissos previstos.' },
            React.createElement(UI.Toggle, { on: true, onChange: () => { } })),
          React.createElement(Row, { label: 'Conta padrão para arquivos novos', hint: 'Usada quando o arquivo não identifica a conta.' },
            React.createElement('select', { className: 'fld-select', defaultValue: 'itau', style: { width: 200 } },
              ['Itaú · C/C 9871', 'Nubank · 4821', 'Caixa · Poupança', 'XP Investimentos'].map(o => React.createElement('option', { key: o }, o)))),
          React.createElement(Row, { label: 'Codificação padrão', hint: 'UTF-8 padrão · Windows-1252 para arquivos antigos.' },
            React.createElement('select', { className: 'fld-select', defaultValue: 'utf8', style: { width: 200 } },
              ['UTF-8', 'ISO-8859-1', 'Windows-1252'].map(o => React.createElement('option', { key: o }, o)))))),

      // Histórico
      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, {
          title: 'Histórico de importações', sub: S.imports.length + ' arquivos processados', icon: 'clock',
          right: React.createElement('button', { className: 'btn btn-quiet btn-sm' }, React.createElement(Icon, { name: 'download', size: 13 }), 'Exportar log')
        }),
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null,
              React.createElement('th', null, 'Arquivo'),
              React.createElement('th', null, 'Importado em'),
              React.createElement('th', { className: 'num' }, 'Linhas'),
              React.createElement('th', { className: 'num' }, 'Novos'),
              React.createElement('th', { className: 'num' }, 'Duplicados'),
              React.createElement('th', { className: 'num' }, 'Erros'),
              React.createElement('th', null, 'Status'),
              React.createElement('th', null, ''))),
            React.createElement('tbody', null, S.imports.map((im, i) => {
              const st = status[im.status] || status.done;
              const ext = (im.file.split('.').pop() || 'csv').toUpperCase();
              const extColor = { OFX: '#3567b8', CSV: '#1f8a5b', XLSX: '#6a52c9', PDF: '#cf4d43' }[ext] || '#7c8696';
              return React.createElement('tr', { key: i },
                React.createElement('td', null, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                  React.createElement('span', { style: { width: 28, height: 28, borderRadius: 7, background: extColor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, flex: 'none' } }, ext),
                  React.createElement('div', null,
                    React.createElement('div', { className: 't-desc', style: { fontSize: 13 } }, im.file),
                    React.createElement('div', { className: 't-sub mono' }, im.size)))),
                React.createElement('td', { className: 't-sub mono' }, im.date),
                React.createElement('td', { className: 'num' }, im.rows),
                React.createElement('td', { className: 'num', style: { fontWeight: 700, color: 'var(--pos)' } }, im.news),
                React.createElement('td', { className: 'num t-sub' }, im.dup),
                React.createElement('td', { className: 'num', style: { color: im.errors > 0 ? 'var(--neg)' : 'var(--ink-3)' } }, im.errors),
                React.createElement('td', null, React.createElement(UI.Badge, { kind: st.k }, st.l)),
                React.createElement('td', null, React.createElement('span', { className: 'row-act' },
                  React.createElement('button', { title: 'Ver detalhes' }, React.createElement(Icon, { name: 'eye', size: 13 })),
                  React.createElement('button', { title: 'Reimportar' }, React.createElement(Icon, { name: 'refresh', size: 13 })),
                  React.createElement('button', { className: 'danger', title: 'Excluir' }, React.createElement(Icon, { name: 'x', size: 13 })))));
            })))),

      // Como funciona
      React.createElement(UI.Alert, { type: 'info', title: 'Como o SmartCashFlow processa seus arquivos' },
        '1) Detecta o formato e a instituição · 2) Normaliza descrição (merchants) · 3) Aplica regras + padrões aprendidos · 4) Checa duplicatas pela combinação data+valor+descrição · 5) Concilia com compromissos previstos.')));
  }

  // ---------- expose --------------------------------------------------------
  window.SettingsPanels = { Profile, Security, Rules, Accounts, ImportData };
})();
