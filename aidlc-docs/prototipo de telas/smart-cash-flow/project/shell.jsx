/* SmartCashFlow — App shell: sidebar, header, period, workspace, theme, mobile nav */
(function () {
  const { useState, useEffect } = React;
  const Icon = window.Icon;

  // -------- Brand logo (S em gradient blue/green/purple) --------
  function BrandLogo() {
    return React.createElement('svg', {
      viewBox: '0 0 32 32', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
    },
      React.createElement('defs', null,
        React.createElement('linearGradient', { id: 'scfg', x1: '0', y1: '0', x2: '32', y2: '32', gradientUnits: 'userSpaceOnUse' },
          React.createElement('stop', { offset: '0%', stopColor: '#00e676' }),
          React.createElement('stop', { offset: '50%', stopColor: '#00b8ff' }),
          React.createElement('stop', { offset: '100%', stopColor: '#7c3aed' }))),
      // letter S — bold cursive, drawn as a path
      React.createElement('path', {
        d: 'M22.5 9.2c-1.6-1.6-4-2.4-7-2.4-3.8 0-6.5 1.8-6.5 4.9 0 2.7 1.8 3.9 5.8 4.9l2.5.6c2.8.7 4 1.4 4 3 0 1.9-1.9 3-4.8 3-2.4 0-4.3-.7-5.8-2.2L8 23.4c1.8 1.7 4.3 2.6 7.4 2.6 4.3 0 7.1-2 7.1-5.1 0-2.8-2-4-6-5l-2.5-.6c-2.6-.6-3.7-1.3-3.7-2.7 0-1.6 1.8-2.7 4.4-2.7 2.1 0 3.9.7 5.2 2l2.6-2.7z',
        fill: '#fff',
      })
    );
  }

  function Sidebar({ route, onNav }) {
    const { NAV, workspace } = window.SCF;
    return React.createElement('aside', { className: 'side' },
      React.createElement('div', { className: 'side-brand' },
        React.createElement('img', { className: 'brand-logo', src: 'assets/logo-smartcash-flow-main.png', alt: 'SmartCash Flow' })),
      React.createElement('nav', { className: 'side-scroll' },
        NAV.map(g => React.createElement('div', { className: 'nav-group', key: g.group },
          React.createElement('div', { className: 'nav-label' }, g.group),
          g.items.map(it => React.createElement('button', {
            key: it.id, className: 'nav-item' + (route === it.id ? ' active' : ''), onClick: () => onNav(it.id),
          },
            React.createElement(Icon, { name: it.icon, size: 18 }),
            React.createElement('span', null, it.label),
            it.badge === 'soon' && React.createElement('span', { className: 'nav-badge soon' }, 'em breve'),
            it.id === 'transactions' && React.createElement('span', { className: 'nav-badge count' }, '3'),
            it.id === 'insights' && React.createElement('span', { className: 'nav-badge dot' })))))),
      React.createElement('div', { className: 'side-foot' },
        React.createElement('button', { className: 'ws-switch', onClick: () => onNav('family') },
          React.createElement('div', { className: 'ws-avatar' }, 'A'),
          React.createElement('div', { className: 'ws-meta' },
            React.createElement('div', { className: 'ws-name' }, workspace.name),
            React.createElement('div', { className: 'ws-role' }, workspace.plan)),
          React.createElement(Icon, { name: 'chevD', size: 15, style: { color: 'var(--side-text-dim)' } }))));
  }

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function PeriodFilter() {
    const [mi, setMi] = useState(5); // Junho
    return React.createElement('div', { className: 'period' },
      React.createElement('button', { className: 'period-arrow', onClick: () => setMi(m => Math.max(0, m - 1)) }, React.createElement(Icon, { name: 'chevL', size: 16 })),
      React.createElement('div', { className: 'period-current' },
        React.createElement(Icon, { name: 'calendar', size: 15 }),
        MONTHS[mi] + ' 2026'),
      React.createElement('button', { className: 'period-arrow', onClick: () => setMi(m => Math.min(11, m + 1)) }, React.createElement(Icon, { name: 'chevR', size: 16 })));
  }

  // -------- Theme toggle (persiste no localStorage) --------
  function useTheme() {
    const [theme, setTheme] = useState(() => {
      try { return localStorage.getItem('scf-theme') || 'light'; } catch (e) { return 'light'; }
    });
    useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('scf-theme', theme); } catch (e) {}
    }, [theme]);
    return [theme, () => setTheme(t => t === 'dark' ? 'light' : 'dark')];
  }

  function ThemeToggle() {
    const [theme, toggle] = useTheme();
    return React.createElement('button', {
      className: 'theme-toggle', onClick: toggle,
      title: theme === 'dark' ? 'Modo claro' : 'Modo escuro',
    }, React.createElement(Icon, { name: theme === 'dark' ? 'sun' : 'moon', size: 17 }));
  }

  function Header({ route, onNav }) {
    const [t0, t1] = window.SCF.TITLES[route] || ['', route];
    const showPeriod = !['settings', 'family', 'billing', 'copilot'].includes(route);
    return React.createElement('header', { className: 'header' },
      React.createElement('div', { className: 'h-title' },
        React.createElement('div', { className: 'h-crumb' }, t0 + ' / ' + t1),
        React.createElement('div', { className: 'h-name' }, t1)),
      React.createElement('div', { className: 'h-spacer' }),
      React.createElement('div', { className: 'h-tools' },
        showPeriod && React.createElement(PeriodFilter, null),
        React.createElement('button', { className: 'icon-btn', title: 'Buscar' }, React.createElement(Icon, { name: 'search', size: 18 })),
        React.createElement('button', { className: 'icon-btn', title: 'Alertas', onClick: () => onNav('insights') },
          React.createElement(Icon, { name: 'bell', size: 18 }), React.createElement('span', { className: 'dot' })),
        React.createElement(ThemeToggle, null),
        React.createElement('button', { className: 'btn btn-primary btn-sm', style: { marginLeft: 4 }, onClick: () => onNav('imports') },
          React.createElement(Icon, { name: 'upload', size: 15 }), 'Importar')));
  }

  // -------- Bottom nav (mobile <= 880px) --------
  function BottomNav({ route, onNav }) {
    const items = [
      { id: 'dashboard', label: 'Início', icon: 'gauge' },
      { id: 'cashflow', label: 'Fluxo', icon: 'flow' },
      { id: 'transactions', label: 'Nova', icon: 'plus', fab: true },
      { id: 'categories', label: 'Categorias', icon: 'tag' },
      { id: 'settings', label: 'Mais', icon: 'cog' },
    ];
    return React.createElement('nav', { className: 'bottom-nav' },
      items.map(it => React.createElement('button', {
        key: it.id,
        className: (it.fab ? 'fab' : '') + (!it.fab && route === it.id ? ' active' : ''),
        onClick: () => onNav(it.id),
      },
        React.createElement(Icon, { name: it.icon, size: it.fab ? 24 : 21 }),
        !it.fab && React.createElement('span', null, it.label))));
  }

  window.Shell = { Sidebar, Header, BottomNav };
})();
