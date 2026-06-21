/* SmartCashFlow — App root + router */
(function () {
  const { useState, useEffect } = React;
  const Icon = window.Icon, UI = window.UI;

  function Placeholder({ route }) {
    const [t0, t1] = window.SCF.TITLES[route] || ['', route];
    return React.createElement('div', { className: 'canvas' },
      React.createElement(UI.Card, { className: 'card-pad', style: { maxWidth: 520, margin: '40px auto' } },
        React.createElement(UI.State, { icon: 'sparkles', title: t1, action: null }, 'Esta tela faz parte do protótipo e será renderizada aqui.')));
  }

  function App() {
    const [route, setRoute] = useState(() => (location.hash || '#dashboard').slice(1));
    const [t, setTweak] = window.useTweaks ? window.useTweaks({
      accent: '#00b86b', density: 'regular', display: "'Sora'", radius: 14,
    }) : [{}, () => {}];
    const onNav = (id) => { setRoute(id); location.hash = id; const m = document.querySelector('.main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); };
    useEffect(() => {
      const h = () => setRoute((location.hash || '#dashboard').slice(1));
      window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
    }, []);

    // apply tweaks → CSS vars
    useEffect(() => {
      const r = document.documentElement.style;
      if (t.accent) {
        r.setProperty('--acc', t.accent);
        const c = shadeHex(t.accent, -22); r.setProperty('--acc-strong', c);
        r.setProperty('--acc-ink', shadeHex(t.accent, -46));
        r.setProperty('--acc-soft', tintHex(t.accent, 0.88));
        r.setProperty('--acc-soft-2', tintHex(t.accent, 0.78));
        r.setProperty('--pos', t.accent); r.setProperty('--pos-soft', tintHex(t.accent, 0.88));
        r.setProperty('--st-real', t.accent); r.setProperty('--st-real-soft', tintHex(t.accent, 0.88));
      }
      if (t.display) r.setProperty('--font-display', t.display + ", system-ui, sans-serif");
      if (t.radius != null) { r.setProperty('--r-md', t.radius + 'px'); r.setProperty('--r-sm', (t.radius - 4) + 'px'); r.setProperty('--r-lg', (t.radius + 5) + 'px'); }
      const dens = { compact: ['12px 14px', '.92'], regular: ['16px 18px', '1'], comfy: ['20px 24px', '1.06'] }[t.density || 'regular'];
      r.setProperty('--card-pad-y', dens[0]);
    }, [t.accent, t.display, t.radius, t.density]);

    const densCls = 'dens-' + (t.density || 'regular');
    const Screen = (window.Screens && window.Screens[route]) || Placeholder;
    return React.createElement('div', { className: 'app ' + densCls },
      React.createElement(window.Shell.Sidebar, { route, onNav }),
      React.createElement('div', { className: 'main' },
        React.createElement(window.Shell.Header, { route, onNav }),
        React.createElement('div', { key: route, className: 'fade-up' },
          React.createElement(Screen, { onNav, route }))),
      window.Shell.BottomNav && React.createElement(window.Shell.BottomNav, { route, onNav }),
      window.TweaksPanel && React.createElement(window.TweaksPanel, { title: 'Tweaks' },
        React.createElement(window.TweakSection, { label: 'Identidade visual' }),
        React.createElement(window.TweakColor, { label: 'Cor de acento', value: t.accent,
          options: ['#00b86b', '#2563eb', '#7c3aed', '#f5a623', '#ff4d6d'], onChange: (v) => setTweak('accent', v) }),
        React.createElement(window.TweakSelect, { label: 'Fonte de destaque', value: t.display,
          options: [{ value: "'Sora'", label: 'Sora' }, { value: "'Inter'", label: 'Inter' }, { value: "'Space Grotesk'", label: 'Space Grotesk' }, { value: "'Hanken Grotesk'", label: 'Hanken Grotesk' }], onChange: (v) => setTweak('display', v) }),
        React.createElement(window.TweakSlider, { label: 'Arredondamento', value: t.radius, min: 4, max: 22, unit: 'px', onChange: (v) => setTweak('radius', v) }),
        React.createElement(window.TweakSection, { label: 'Layout' }),
        React.createElement(window.TweakRadio, { label: 'Densidade', value: t.density,
          options: ['compact', 'regular', 'comfy'], onChange: (v) => setTweak('density', v) })));
  }

  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = ((n >> 16) & 255) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function tintHex(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255), g = ((n >> 8) & 255), b = (n & 255);
    const mix = (c) => Math.round(c + (255 - c) * t);
    return '#' + ((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1);
  }

  window.__mountApp = () => ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();
