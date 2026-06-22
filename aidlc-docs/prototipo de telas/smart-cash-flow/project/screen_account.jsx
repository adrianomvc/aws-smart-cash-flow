/* SmartCashFlow — Família, Assinatura, Configurações */
(function () {
  const { useState } = React;
  const Icon = window.Icon, UI = window.UI, S = window.SCF;
  const BRL = S.BRL;

  // ============ FAMÍLIA ============
  function Family({ onNav }) {
    const roleMeta = {
      owner: { k: 'pos', label: 'Proprietário', desc: 'Controle total' },
      admin: { k: 'info', label: 'Administrador', desc: 'Gerencia dados e membros' },
      member: { k: 'neutral', label: 'Membro', desc: 'Adiciona e categoriza' },
      viewer: { k: 'low', label: 'Visualizador', desc: 'Apenas leitura' },
    };
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Conta', title: 'Família / Membros', icon: 'users',
        sub: 'Uso compartilhado por workspace. Cada membro tem um papel com permissões claras — os dados ficam isolados nesta família.',
        right: React.createElement('button', { className: 'btn btn-primary btn-sm' }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Convidar membro') }),

      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Membros ativos', value: '4', icon: 'users', cur: null }),
        React.createElement(UI.Kpi, { label: 'Convites pendentes', value: '1', icon: 'send', cur: null }),
        React.createElement(UI.Kpi, { label: 'Plano', value: 'Família', cur: null, icon: 'star', sub: 'até 6 membros' }),
        React.createElement(UI.Kpi, { label: 'Isolamento de dados', value: 'Ativo', cur: null, icon: 'shield', prov: 'real' })),

      React.createElement('div', { className: 'dash-main' },
        React.createElement(UI.Card, null,
          React.createElement(UI.CardHead, { title: 'Membros', sub: 'Família Andrade', icon: 'users' }),
          React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
            React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Membro'), React.createElement('th', null, 'Papel'), React.createElement('th', null, 'Atividade'), React.createElement('th', null, ''))),
            React.createElement('tbody', null, S.members.map((m, i) => {
              const r = roleMeta[m.role];
              return React.createElement('tr', { key: i },
                React.createElement('td', null, React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                  React.createElement('span', { className: 'avatar', style: { background: m.color } }, m.initials),
                  React.createElement('div', null, React.createElement('div', { className: 't-desc' }, m.name), React.createElement('div', { className: 't-sub' }, m.email)))),
                React.createElement('td', null, React.createElement('div', null, React.createElement(UI.Badge, { kind: r.k }, r.label), React.createElement('div', { className: 't-sub', style: { marginTop: 3 } }, r.desc))),
                React.createElement('td', { className: 't-sub' }, m.active),
                React.createElement('td', null, m.role !== 'owner' && React.createElement('button', { className: 'icon-btn', style: { width: 30, height: 30 } }, React.createElement(Icon, { name: 'dots', size: 16 }))));
            })))),

        React.createElement('div', { className: 'vstack', style: { gap: 16 } },
          React.createElement(UI.Card, null,
            React.createElement(UI.CardHead, { title: 'Convites pendentes', icon: 'send' }),
            React.createElement('div', { style: { padding: '8px 14px 14px' } },
              React.createElement('div', { className: 'row-item', style: { padding: '8px 4px' } },
                React.createElement('span', { className: 'avatar', style: { background: 'var(--ink-faint)' } }, '?'),
                React.createElement('div', { style: { flex: 1 } }, React.createElement('div', { className: 't-desc', style: { fontSize: 13 } }, 'tio.carlos@email.com'), React.createElement('div', { className: 't-sub' }, 'Visualizador · enviado há 2 dias')),
                React.createElement('button', { className: 'btn btn-quiet btn-sm' }, 'Reenviar')))),
          React.createElement(UI.Card, { className: 'card-pad' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
              React.createElement('span', { className: 'goal-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)' } }, React.createElement(Icon, { name: 'lock', size: 15 })),
              React.createElement('span', { style: { fontWeight: 700, fontSize: 14 } }, 'Privacidade & controle')),
            React.createElement('ul', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 } },
              ['Dados isolados por workspace familiar', 'Valores nunca expostos a terceiros', 'Cada acesso é rastreável por membro', 'Papéis controlam quem edita ou apenas vê'].map((t, i) =>
                React.createElement('li', { key: i, style: { display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 } },
                  React.createElement(Icon, { name: 'check', size: 15, style: { color: 'var(--acc)', flex: 'none' } }), t))))))));
  }

  // ============ ASSINATURA ============
  function Billing({ onNav }) {
    const plans = [
      { name: 'Pessoal', price: 0, period: 'grátis', feats: ['1 workspace', 'Importação manual', 'Dashboard e fluxo', '3 metas'], current: false },
      { name: 'Família', price: 29, period: '/mês', feats: ['Até 6 membros', 'Cartões e orçamentos', 'Projeção 90 dias', 'Metas ilimitadas', 'Insights IA'], current: true },
      { name: 'Patrimônio', price: 59, period: '/mês', feats: ['Tudo do Família', 'Investimentos e patrimônio', 'Projeção 12 meses', 'Copilot avançado', 'Relatórios PDF'], current: false },
    ];
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Conta', title: 'Assinatura', icon: 'receipt',
        sub: 'Gerencie seu plano, cobrança e limites.' }),

      React.createElement('div', { className: 'grid cols-3', style: { marginBottom: 16 } },
        React.createElement('div', { className: 'kpi', style: { background: 'linear-gradient(135deg,var(--acc-soft),var(--card))' } },
          React.createElement('div', { className: 'kpi-top' }, React.createElement('div', { className: 'kpi-ic', style: { background: 'var(--acc-soft)', color: 'var(--acc)', border: '1px solid var(--acc-soft-2)' } }, React.createElement(Icon, { name: 'star', size: 15 })), React.createElement('span', { className: 'kpi-label' }, 'Plano atual')),
          React.createElement('div', { className: 'kpi-val' }, 'Família'),
          React.createElement('div', { className: 'kpi-sub' }, React.createElement(UI.Badge, { kind: 'pos', icon: 'checkCircle' }, 'Ativo'), 'renova 01/jul')),
        React.createElement(UI.Kpi, { label: 'Cobrança mensal', value: '29,00', cur: 'R$', icon: 'receipt', sub: 'próxima em 01/jul' }),
        React.createElement(UI.Kpi, { label: 'Membros usados', value: '4 / 6', cur: null, icon: 'users' })),

      React.createElement('div', { className: 'grid cols-3', style: { marginBottom: 16 } },
        plans.map((p, i) => React.createElement(UI.Card, { key: i, className: 'card-pad', style: p.current ? { borderColor: 'var(--acc)', boxShadow: 'var(--sh-md)' } : null },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
            React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 } }, p.name),
            p.current && React.createElement('span', { className: 'badge b-pos' }, 'Atual')),
          React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 14 } },
            React.createElement('span', { style: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 } }, p.price === 0 ? 'Grátis' : 'R$ ' + p.price),
            p.price > 0 && React.createElement('span', { className: 'muted', style: { fontSize: 13 } }, p.period)),
          React.createElement('ul', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, marginBottom: 16 } },
            p.feats.map((f, j) => React.createElement('li', { key: j, style: { display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' } }, React.createElement(Icon, { name: 'check', size: 15, style: { color: 'var(--acc)', flex: 'none' } }), f))),
          p.current ? React.createElement('button', { className: 'btn btn-ghost btn-sm', style: { width: '100%' } }, 'Plano atual')
            : React.createElement('button', { className: 'btn btn-primary btn-sm', style: { width: '100%' } }, p.price === 0 ? 'Fazer downgrade' : 'Fazer upgrade')))),

      React.createElement(UI.Card, null,
        React.createElement(UI.CardHead, { title: 'Histórico de pagamentos', icon: 'clock' }),
        React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { className: 'tbl' },
          React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Data'), React.createElement('th', null, 'Descrição'), React.createElement('th', null, 'Método'), React.createElement('th', { className: 'num' }, 'Valor'), React.createElement('th', null, 'Status'))),
          React.createElement('tbody', null, [['01/06/2026','Plano Família · junho','•••• 4821'],['01/05/2026','Plano Família · maio','•••• 4821'],['01/04/2026','Plano Família · abril','•••• 4821']].map((r, i) =>
            React.createElement('tr', { key: i },
              React.createElement('td', { className: 'mono t-sub' }, r[0]),
              React.createElement('td', { className: 't-desc' }, r[1]),
              React.createElement('td', { className: 'mono t-sub' }, r[2]),
              React.createElement('td', { className: 'num', style: { fontWeight: 700 } }, 'R$ 29,00'),
              React.createElement('td', null, React.createElement(UI.Badge, { kind: 'pos', icon: 'check' }, 'Pago')))))))));
  }

  // ============ CONFIGURAÇÕES ============
  function Settings({ onNav }) {
    const { useEffect } = React;
    const [tab, setTab] = useState('prefs');
    const [showPanel, setShowPanel] = useState(false);
    const [mobile, setMobile] = useState(window.innerWidth <= 880);

    useEffect(() => {
      const check = () => {
        const m = window.innerWidth <= 880;
        setMobile(m);
        if (!m) setShowPanel(false);
      };
      window.addEventListener('resize', check);
      return () => window.removeEventListener('resize', check);
    }, []);

    const sub = [
      { id: 'profile', label: 'Perfil', icon: 'users' },
      { id: 'security', label: 'Segurança', icon: 'lock' },
      { id: 'prefs', label: 'Preferências Financeiras', icon: 'sliders' },
      { id: 'cats', label: 'Categorias', icon: 'tag' },
      { id: 'rules', label: 'Regras e Normalização', icon: 'filter' },
      { id: 'accounts', label: 'Contas e Bancos', icon: 'building' },
      { id: 'import', label: 'Importação de Dados', icon: 'upload' },
      { id: 'notif', label: 'Notificações', icon: 'bell' },
      { id: 'backup', label: 'Backup e Sincronização', icon: 'refresh' },
      { id: 'plan', label: 'Assinatura e Plano', icon: 'receipt' },
      { id: 'about', label: 'Sobre o App', icon: 'info' },
    ];

    const handleSelect = (id) => {
      if (id === 'plan') { onNav('billing'); return; }
      setTab(id);
      if (mobile) setShowPanel(true);
    };

    // ── Mobile: painel aberto ──────────────────────────────────────────────
    if (mobile && showPanel) {
      const item = sub.find(s => s.id === tab);
      return React.createElement('div', { className: 'canvas stg' },
        React.createElement('button', { className: 'stg-back', onClick: () => setShowPanel(false) },
          React.createElement(Icon, { name: 'chevL', size: 18 }),
          item ? item.label : 'Configurações'),
        React.createElement(SettingsBody, { tab, onNav }));
    }

    // ── Mobile: lista ──────────────────────────────────────────────────────
    if (mobile) {
      return React.createElement('div', { className: 'canvas stg' },
        React.createElement(UI.Section, { eyebrow: 'Conta', title: 'Configurações', icon: 'cog',
          sub: 'Preferências do workspace.' }),
        React.createElement(UI.Card, { className: 'card-pad' },
          React.createElement('div', { className: 'list-select' },
            sub.map(s2 => React.createElement('button', { key: s2.id, onClick: () => handleSelect(s2.id) },
              React.createElement(Icon, { name: s2.icon, size: 16 }),
              React.createElement('span', { style: { flex: 1 } }, s2.label),
              React.createElement(Icon, { name: 'chevR', size: 14, style: { color: 'var(--ink-faint)', flex: 'none' } }))))));
    }

    // ── Desktop: sidebar + painel ──────────────────────────────────────────
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Conta', title: 'Configurações', icon: 'cog',
        sub: 'Central administrativa e de preferências do workspace.' }),
      React.createElement('div', { className: 'grid', style: { gridTemplateColumns: '240px 1fr', alignItems: 'start' } },
        React.createElement(UI.Card, { className: 'card-pad stg-sidebar', style: { position: 'sticky', top: 80 } },
          React.createElement('div', { className: 'list-select' },
            sub.map(s2 => React.createElement('button', { key: s2.id, className: tab === s2.id ? 'on' : '', onClick: () => handleSelect(s2.id) },
              React.createElement(Icon, { name: s2.icon, size: 16 }), React.createElement('span', { style: { flex: 1 } }, s2.label))))),
        React.createElement(SettingsBody, { tab, onNav })));
  }

  function SettingsBody({ tab, onNav }) {
    const P = window.SettingsPanels || {};
    if (tab === 'prefs') return React.createElement(FinPrefs, null);
    if (tab === 'cats') return React.createElement(CatSettings, { onNav });
    if (tab === 'about') return React.createElement(About, null);
    if (tab === 'notif') return React.createElement(NotifSettings, null);
    if (tab === 'profile' && P.Profile) return React.createElement(P.Profile, null);
    if (tab === 'security' && P.Security) return React.createElement(P.Security, null);
    if (tab === 'rules' && P.Rules) return React.createElement(P.Rules, null);
    if (tab === 'accounts' && P.Accounts) return React.createElement(P.Accounts, null);
    if (tab === 'import' && P.ImportData) return React.createElement(P.ImportData, null);
    const titles = { backup: 'Backup e Sincronização' };
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement(UI.State, { icon: 'cog', title: titles[tab] || 'Configurações' }, 'Em breve.'));
  }

  function FinPrefs() {
    const Row = ({ label, hint, children }) => React.createElement('div', { className: 'pref-row' },
      React.createElement('div', { style: { flex: 1 } }, React.createElement('div', { style: { fontSize: 13.5, fontWeight: 600 } }, label), hint && React.createElement('div', { className: 't-sub', style: { marginTop: 2 } }, hint)),
      React.createElement('div', { style: { flex: 'none' } }, children));
    const Sel = ({ opts, val }) => React.createElement('select', { className: 'cat-select', defaultValue: val, style: { minWidth: 130 } }, opts.map(o => React.createElement('option', { key: o }, o)));
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Preferências Financeiras', sub: 'Estes valores alimentam seus indicadores e projeções', icon: 'sliders' }),
      React.createElement('div', { style: { padding: '4px 18px 16px' } },
        React.createElement(Row, { label: 'Moeda', hint: 'Exibição de valores' }, React.createElement(Sel, { opts: ['Real (R$)', 'Dólar (US$)', 'Euro (€)'], val: 'Real (R$)' })),
        React.createElement(Row, { label: 'Idioma e região' }, React.createElement(Sel, { opts: ['Português (Brasil)', 'English (US)'], val: 'Português (Brasil)' })),
        React.createElement(Row, { label: 'Meta de poupança', hint: 'Percentual da renda que você quer guardar' }, React.createElement(Sel, { opts: ['20%', '25%', '30%', '35%'], val: '25%' })),
        React.createElement(Row, { label: 'Limite de comprometimento', hint: 'Alerta quando dívidas + fixas ultrapassam' }, React.createElement(Sel, { opts: ['30%', '35%', '40%', '50%'], val: '35%' })),
        React.createElement(Row, { label: 'Perfil de risco', hint: 'Influencia sugestões de investimento (futuro)' }, React.createElement(Sel, { opts: ['Conservador', 'Moderado', 'Arrojado'], val: 'Moderado' })),
        React.createElement(Row, { label: 'Janela de burn rate', hint: 'Período para média de saídas' }, React.createElement(Sel, { opts: ['1 mês', '3 meses', '6 meses'], val: '3 meses' })),
        React.createElement(Row, { label: 'Método de runway', hint: 'Como calcular meses de reserva' }, React.createElement(Sel, { opts: ['Reserva ÷ burn rate', 'Saldo ÷ despesa fixa'], val: 'Reserva ÷ burn rate' })),
        React.createElement(Row, { label: 'Reserva protegida', hint: 'Valor que o gasto seguro nunca consome' }, React.createElement(Sel, { opts: ['R$ 5.000', 'R$ 10.000', 'R$ 15.000'], val: 'R$ 10.000' })),
        React.createElement(Row, { label: 'Política de gasto seguro', hint: 'Quão conservador é o cálculo' }, React.createElement(Sel, { opts: ['Conservador', 'Equilibrado', 'Flexível'], val: 'Equilibrado' }))),
      React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 18px', borderTop: '1px solid var(--line)' } },
        React.createElement('button', { className: 'btn btn-quiet btn-sm' }, 'Cancelar'),
        React.createElement('button', { className: 'btn btn-primary btn-sm' }, 'Salvar preferências')));
  }

  function CatSettings({ onNav }) {
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Categorias e Subcategorias', sub: 'O cadastro completo é feito na tela dedicada.', icon: 'tag', right: React.createElement('button', { className: 'btn btn-primary btn-sm', onClick: () => onNav && onNav('categories') }, React.createElement(Icon, { name: 'arrowUR', size: 14 }), 'Abrir tela completa') }),
      React.createElement('div', { className: 'card-body', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        Object.keys(S.CATS).filter(k => k !== 'outros').map((k, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10 } },
          React.createElement('span', { className: 'catdot', style: { background: S.CATS[k].color, width: 12, height: 12 } }),
          React.createElement('span', { style: { flex: 1, fontWeight: 600, fontSize: 13 } }, S.CATS[k].label),
          i < 3 && React.createElement('span', { className: 'badge b-pos', style: { fontSize: 10 } }, 'prioritária'),
          React.createElement('button', { className: 'icon-btn', style: { width: 28, height: 28 }, onClick: () => onNav && onNav('categories'), title: 'Editar na tela completa' }, React.createElement(Icon, { name: 'edit', size: 14 }))))));
  }

  function NotifSettings() {
    const Item = ({ label, hint, on }) => { const [v, setV] = useState(on); return React.createElement('div', { className: 'pref-row' },
      React.createElement('div', { style: { flex: 1 } }, React.createElement('div', { style: { fontSize: 13.5, fontWeight: 600 } }, label), React.createElement('div', { className: 't-sub', style: { marginTop: 2 } }, hint)),
      React.createElement(UI.Toggle, { on: v, onChange: setV })); };
    return React.createElement(UI.Card, null,
      React.createElement(UI.CardHead, { title: 'Notificações', sub: 'Quando e como avisamos você', icon: 'bell' }),
      React.createElement('div', { style: { padding: '4px 18px 16px' } },
        React.createElement(Item, { label: 'Risco de saldo negativo', hint: 'Alerta quando a projeção indicar saldo baixo', on: true }),
        React.createElement(Item, { label: 'Vencimentos próximos', hint: 'Lembrete 2 dias antes de contas e faturas', on: true }),
        React.createElement(Item, { label: 'Orçamento perto do limite', hint: 'Quando uma categoria passar de 90%', on: true }),
        React.createElement(Item, { label: 'Resumo semanal', hint: 'Toda segunda, um panorama da semana', on: false }),
        React.createElement(Item, { label: 'Insights da IA', hint: 'Novas recomendações acionáveis', on: true })),
      React.createElement('div', { style: { padding: '0 18px 16px' } },
        React.createElement('div', { className: 'eyebrow', style: { marginBottom: 8 } }, 'Canais'),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('span', { className: 'chip on' }, React.createElement(Icon, { name: 'bell', size: 13 }), 'No app'),
          React.createElement('span', { className: 'chip on' }, 'E-mail'),
          React.createElement('span', { className: 'chip on' }, React.createElement(Icon, { name: 'phone', size: 13 }), 'Push'))));
  }

  function About() {
    return React.createElement(UI.Card, { className: 'card-pad' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } },
        React.createElement('img', { src: 'assets/icon-smartcash-flow.png', alt: 'SmartCashFlow', style: { width: 48, height: 48, display: 'block', objectFit: 'contain' } }),
        React.createElement('div', null, React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 } }, 'SmartCashFlow'), React.createElement('div', { className: 't-sub mono' }, 'versão 1.0 · cockpit financeiro familiar'))),
      React.createElement('p', { style: { fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 16px' } },
        'Plataforma de controle financeiro familiar focada em fluxo de caixa, previsibilidade e saúde financeira. Construída para responder, de forma simples: quanto entrou, quanto saiu, quanto sobrou e o que vem pela frente.'),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        ['Privacidade', 'Termos de uso', 'Segurança dos dados', 'Suporte', 'Novidades'].map((t, i) =>
          React.createElement('button', { key: i, className: 'chip' }, t))));
  }

  window.Screens = window.Screens || {};
  window.Screens.family = Family;
  window.Screens.billing = Billing;
  window.Screens.settings = Settings;
})();
