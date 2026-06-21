/* SmartCashFlow — Insights IA + Copilot Financeiro */
(function () {
  const { useState, useRef, useEffect } = React;
  const Icon = window.Icon, UI = window.UI, S = window.SCF;
  const BRL = S.BRL;

  // ============ INSIGHTS IA ============
  function Insights({ onNav }) {
    const conf = { 'Alta': { k: 'real' }, 'Média': { k: 'est' }, 'Baixa': { k: 'low' } };
    return React.createElement('div', { className: 'canvas stg' },
      React.createElement(UI.Section, { eyebrow: 'Crescimento', title: 'Insights IA', icon: 'spark',
        sub: 'Recomendações acionáveis e explicáveis, baseadas nos dados do seu workspace. Nada de mágica — sempre mostramos o porquê e os dados usados.' }),

      React.createElement('div', { className: 'grid cols-4', style: { marginBottom: 16 } },
        React.createElement(UI.Kpi, { label: 'Insights ativos', value: '4', icon: 'spark', cur: null }),
        React.createElement(UI.Kpi, { label: 'Economia potencial', value: S.num(396), cur: 'R$', icon: 'check', prov: 'est', sub: '/mês identificados' }),
        React.createElement(UI.Kpi, { label: 'Alertas de risco', value: '1', icon: 'alert', cur: null, sub: 'saldo baixo em 10/jun' }),
        React.createElement(UI.Kpi, { label: 'Qualidade dos dados', value: '86', unit: '%', cur: null, icon: 'db', prov: 'real' })),

      React.createElement('div', { className: 'grid cols-2' },
        S.insights.map((ins, i) => {
          const tone = ins.type, c = conf[ins.confidence];
          return React.createElement(UI.Card, { key: i, className: 'card-pad' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12 } },
              React.createElement('span', { className: 'goal-ic', style: { width: 36, height: 36, flex: 'none', background: { warn: 'var(--warn-soft)', neg: 'var(--neg-soft)', info: 'var(--info-soft)', pos: 'var(--pos-soft)' }[tone], color: { warn: 'var(--warn)', neg: 'var(--neg)', info: 'var(--info)', pos: 'var(--acc)' }[tone] } },
                React.createElement(Icon, { name: { warn: 'alert', neg: 'alert', info: 'info', pos: 'checkCircle' }[tone], size: 18 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                  React.createElement('span', { style: { fontWeight: 700, fontSize: 14 } }, ins.title)),
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
                  React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: ins.impact >= 0 ? 'var(--acc)' : 'var(--neg)' } }, 'Impacto: ' + BRL(ins.impact, { sign: ins.impact >= 0 })),
                  React.createElement('span', { className: 'badge b-' + c.k }, 'Confiança: ' + ins.confidence)))),
            React.createElement('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '12px 0' } }, ins.reason),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' } },
              React.createElement('span', { className: 'mono t-sub', style: { display: 'inline-flex', alignItems: 'center', gap: 5 } }, React.createElement(Icon, { name: 'db', size: 13 }), 'Dados: ' + ins.data),
              React.createElement('button', { className: 'btn btn-ghost btn-sm', style: { marginLeft: 'auto' }, onClick: () => onNav(tone === 'neg' ? 'calendar' : 'transactions') }, ins.action, React.createElement(Icon, { name: 'chevR', size: 13 }))));
        })),

      React.createElement('div', { style: { height: 16 } }),
      React.createElement(UI.Alert, { type: 'info', title: 'Como a IA funciona aqui' }, 'Os insights são gerados a partir das suas transações reais e regras explicáveis. Quando os dados são insuficientes, dizemos claramente — e nunca inventamos números ou prometemos retorno financeiro.'));
  }

  // ============ COPILOT ============
  function Copilot({ onNav }) {
    const cp = S.copilot;
    const [activeThread, setActiveThread] = useState('c1');
    const [messages, setMessages] = useState([
      { role: 'assistant', text: 'Olá, Marcos! Sou o Copilot financeiro da Família Andrade. Posso analisar seu fluxo, projeções e metas. Use uma pergunta rápida ou escreva a sua.' },
    ]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, typing]);

    const ask = (text) => {
      if (!text.trim()) return;
      setMessages(m => [...m, { role: 'user', text }]);
      setInput('');
      setTyping(true);
      setTimeout(() => {
        const ans = cp.answers[text] || { text: 'Posso responder com base nos seus dados de fluxo de caixa, projeção e metas. Tente uma das perguntas rápidas para ver uma análise completa com fontes.', sources: ['Dashboard'], quality: 86, verdict: 'attention', verdictLabel: 'Pergunte algo financeiro' };
        setMessages(m => [...m, { role: 'assistant', ...ans }]);
        setTyping(false);
      }, 850);
    };

    return React.createElement('div', { className: 'canvas cp-canvas' },
      React.createElement('div', { className: 'copilot' },
        // threads
        React.createElement(UI.Card, { className: 'cp-threads' },
          React.createElement('div', { style: { padding: '14px 14px 10px' } },
            React.createElement('button', { className: 'btn btn-primary btn-sm', style: { width: '100%' }, onClick: () => setMessages([messages[0]]) }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Nova conversa')),
          React.createElement('div', { className: 'eyebrow', style: { padding: '4px 16px 8px' } }, 'Conversas'),
          React.createElement('div', { style: { padding: '0 8px', overflowY: 'auto' } },
            cp.threads.map(t => React.createElement('button', { key: t.id, onClick: () => setActiveThread(t.id), className: 'cp-thread' + (activeThread === t.id ? ' on' : '') },
              React.createElement(Icon, { name: 'chat', size: 15 }),
              React.createElement('div', { style: { flex: 1, minWidth: 0, textAlign: 'left' } },
                React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
                React.createElement('div', { className: 't-sub' }, t.when)))))),

        // chat
        React.createElement(UI.Card, { className: 'cp-chat' },
          React.createElement('div', { ref: scrollRef, className: 'cp-scroll' },
            messages.map((m, i) => React.createElement(Msg, { key: i, m })),
            typing && React.createElement('div', { className: 'cp-msg assistant' },
              React.createElement('div', { className: 'cp-avatar' }, React.createElement(Icon, { name: 'sparkles', size: 15 })),
              React.createElement('div', { className: 'cp-bubble', style: { display: 'flex', gap: 4, padding: '14px 16px' } },
                React.createElement('span', { className: 'cp-dot' }), React.createElement('span', { className: 'cp-dot' }), React.createElement('span', { className: 'cp-dot' })))),
          React.createElement('div', { className: 'cp-quick' },
            cp.quick.map((q, i) => React.createElement('button', { key: i, className: 'chip', onClick: () => ask(q) }, q))),
          React.createElement('div', { className: 'cp-input' },
            React.createElement('input', { value: input, onChange: e => setInput(e.target.value), onKeyDown: e => e.key === 'Enter' && ask(input), placeholder: 'Pergunte sobre suas finanças…' }),
            React.createElement('button', { className: 'btn btn-primary', onClick: () => ask(input) }, React.createElement(Icon, { name: 'send', size: 15 })))),

        // side summary
        React.createElement(UI.Card, { className: 'cp-side' },
          React.createElement('div', { style: { padding: 16 } },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 12 } }, 'Resumo financeiro'),
            React.createElement('div', { style: { display: 'grid', gap: 12 } },
              React.createElement(SideStat, { label: 'Saldo previsto', value: BRL(24640), prov: 'est' }),
              React.createElement(SideStat, { label: 'Gasto seguro', value: BRL(1240), prov: 'est' }),
              React.createElement(SideStat, { label: 'Saúde financeira', value: '78/100', prov: 'est' }),
              React.createElement(SideStat, { label: 'Próximo vencimento', value: '10/jun', prov: 'real' }))),
          React.createElement('hr', { className: 'divider' }),
          React.createElement('div', { style: { padding: 16 } },
            React.createElement('div', { className: 'eyebrow', style: { marginBottom: 10 } }, 'Período analisado'),
            React.createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, 'Junho 2026'),
            React.createElement('div', { className: 't-sub', style: { marginBottom: 14 } }, '01/06 a 30/06 · workspace Família Andrade'),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement(UI.Prov, { k: 'real', withLabel: false }),
              React.createElement('span', { style: { fontSize: 12, color: 'var(--ink-3)' } }, 'Qualidade dos dados: 86%'))),
          React.createElement('hr', { className: 'divider' }),
          React.createElement('div', { style: { padding: 16 } },
            React.createElement(UI.Alert, { type: 'info', title: 'Limites do Copilot' }, 'Não oferecemos consultoria financeira profissional nem prometemos retornos. As respostas usam apenas seus dados e sempre mostram as fontes.'))))
    );
  }

  function Msg({ m }) {
    if (m.role === 'user') return React.createElement('div', { className: 'cp-msg user' }, React.createElement('div', { className: 'cp-bubble user' }, m.text));
    return React.createElement('div', { className: 'cp-msg assistant' },
      React.createElement('div', { className: 'cp-avatar' }, React.createElement(Icon, { name: 'sparkles', size: 15 })),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        m.verdictLabel && React.createElement('div', { style: { marginBottom: 8 } }, React.createElement('span', { className: 'badge b-' + (m.verdict === 'seguro' ? 'pos' : m.verdict === 'nao' ? 'neg' : 'warn') }, React.createElement(Icon, { name: m.verdict === 'seguro' ? 'checkCircle' : 'alert', size: 12 }), m.verdictLabel)),
        React.createElement('div', { className: 'cp-bubble' }, renderRich(m.text)),
        m.sources && React.createElement('div', { className: 'cp-sources' },
          React.createElement('span', { className: 'mono t-sub', style: { display: 'inline-flex', alignItems: 'center', gap: 5 } }, React.createElement(Icon, { name: 'db', size: 12 }), 'Fontes:'),
          m.sources.map((s, i) => React.createElement('span', { key: i, className: 'pill', style: { fontSize: 10.5 } }, s)))));
  }

  function renderRich(text) {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return React.createElement('div', { key: i, style: { height: 8 } });
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, j) => {
        if (p.startsWith('**')) return React.createElement('b', { key: j }, p.slice(2, -2));
        if (p.startsWith('*')) return React.createElement('em', { key: j, style: { color: 'var(--ink-3)' } }, p.slice(1, -1));
        return p;
      });
      return React.createElement('div', { key: i, style: { marginBottom: 2 } }, parts);
    });
  }

  function SideStat({ label, value, prov }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', flex: 1 } }, label),
      React.createElement('span', { style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13 } }, value),
      React.createElement(UI.Prov, { k: prov, withLabel: false }));
  }

  window.Screens = window.Screens || {};
  window.Screens.insights = Insights;
  window.Screens.copilot = Copilot;
})();
