/* ============================================================
   SmartCashFlow — Camada de dados (mock coerente)
   Workspace: Família Andrade · Junho 2026
   Cada indicador carrega sua PROVENIÊNCIA: real | est | integ | future
   (nunca inventamos saldo bancário definitivo)
   ============================================================ */
(function () {
  const BRL = (n, opts = {}) => {
    const { sign = false, dec = 0 } = opts;
    const s = n < 0 ? '−' : (sign ? '+' : '');
    const v = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return s + 'R$ ' + v;
  };
  const num = (n, dec = 0) => Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  // ---- Categorias (cores estáveis) ----
  const CATS = {
    moradia:    { label: 'Moradia',        color: '#3567b8', subs: ['Aluguel/Financiamento', 'Condomínio', 'Energia', 'Água', 'Gás', 'Internet', 'Manutenção'] },
    alimentacao:{ label: 'Alimentação',    color: '#1f8a5b', subs: ['Restaurantes', 'Delivery', 'Cafés e padarias', 'Lanches'] },
    educacao:   { label: 'Educação',       color: '#6a52c9', subs: ['Mensalidade', 'Cursos', 'Material', 'Livros'] },
    transporte: { label: 'Transporte',     color: '#c98a2b', subs: ['Combustível', 'Apps (Uber/99)', 'Manutenção veicular', 'Estacionamento', 'Pedágio'] },
    saude:      { label: 'Saúde',          color: '#cf4d43', subs: ['Plano de saúde', 'Farmácia', 'Consultas', 'Exames', 'Academia'] },
    lazer:      { label: 'Lazer',          color: '#d98234', subs: ['Cinema/Teatro', 'Viagens', 'Bares', 'Hobbies', 'Presentes'] },
    assinaturas:{ label: 'Assinaturas',    color: '#9a6b14', subs: ['Streaming', 'Software', 'Apps', 'Clubes'] },
    mercado:    { label: 'Mercado',        color: '#2a9d8f', subs: ['Hipermercado', 'Hortifruti', 'Açougue', 'Padaria'] },
    servicos:   { label: 'Serviços',       color: '#7c8696', subs: ['Fatura cartão', 'Tarifas bancárias', 'Profissionais', 'Limpeza'] },
    investido:  { label: 'Investimentos',  color: '#135737', subs: ['Renda fixa', 'Renda variável', 'Reserva de emergência', 'Previdência'] },
    renda:      { label: 'Renda',          color: '#1f8a5b', subs: ['Salário', 'Aluguel recebido', 'Freelance', 'Dividendos', 'Reembolso', 'Bônus/13º', 'Outros'] },
    outros:     { label: 'Outros',         color: '#9aa3b0', subs: ['Diversos', 'Não classificado'] },
  };

  // ---- Executivo: a história do dinheiro (Junho/2026) ----
  const exec = {
    entrou:      18420,    // real
    saiu:        13180,    // real (sem dupla contagem de fatura)
    sobrou:       5240,    // real
    compromissos: 4980,    // est — vencem até fim do mês
    saldoPrev:   24640,    // est
  };

  // ---- KPIs ----
  const kpis = {
    saldoAtual:    { val: 24860, prov: 'integ', label: 'Saldo atual', hint: 'Depende de saldo bancário integrado. Valor estimado a partir do fluxo importado.' },
    receitas:      { val: 18420, prov: 'real', delta: +4.2, label: 'Receitas do mês' },
    despesas:      { val: 13180, prov: 'real', delta: +7.8, label: 'Despesas do mês' },
    fluxoLiquido:  { val: 5240,  prov: 'real', delta: -12.1, label: 'Fluxo líquido' },
    savingRate:    { val: 28.4,  prov: 'real', delta: +1.6, label: 'Saving rate', unit: '%' },
    burnRate:      { val: 13180, prov: 'est', label: 'Burn rate', hint: 'Média de saídas dos últimos 3 meses.' },
    runway:        { val: 5.4,   prov: 'est', label: 'Runway financeiro', unit: ' meses', hint: 'Reserva protegida ÷ burn rate.' },
    safeSpend:     { val: 1240,  prov: 'est', label: 'Gasto seguro hoje', hint: 'Quanto ainda pode gastar até o fim do mês mantendo compromissos e reserva.' },
    healthScore:   { val: 78,    prov: 'est', label: 'Saúde financeira', unit: '/100' },
    commitment:    { val: 41,    prov: 'real', label: 'Comprometimento', unit: '%', hint: 'Despesas fixas + dívidas ÷ receita.' },
    dataQuality:   { val: 86,    prov: 'real', label: 'Qualidade dos dados', unit: '%' },
  };

  // ---- Fluxo diário do mês (para gráfico principal) ----
  // 30 dias; entradas positivas, saídas negativas, saldo acumulado
  const daily = (() => {
    const seed = [
      [1,0,-180],[2,0,-92],[3,0,-240],[4,0,-60],[5,8200,-120],[6,0,-340],[7,0,-88],
      [8,0,-1900],[9,0,-210],[10,0,-2980],[11,0,-140],[12,0,-3420],[13,0,-76],[14,0,-260],
      [15,10220,-180],[16,0,-410],[17,0,-95],[18,0,-520],[19,0,-130],[20,0,-240],[21,0,-680],
      [22,0,-150],[23,0,-90],[24,0,-310],[25,0,-1200],[26,0,-200],[27,0,-140],[28,0,-360],
      [29,0,-110],[30,0,-260],
    ];
    let acc = 19620; // saldo inicial do mês (estimado)
    return seed.map(([d, inc, exp]) => {
      acc += inc + exp;
      return { d, inc, exp, acc, proj: d > 18 };
    });
  })();

  // ---- Fluxo mensal (12 meses) ----
  const monthly = [
    { m: 'Jul', inc: 17200, exp: 12400 }, { m: 'Ago', inc: 17600, exp: 13100 },
    { m: 'Set', inc: 17400, exp: 11900 }, { m: 'Out', inc: 18100, exp: 12800 },
    { m: 'Nov', inc: 18000, exp: 14600 }, { m: 'Dez', inc: 21300, exp: 16800 },
    { m: 'Jan', inc: 17800, exp: 13400 }, { m: 'Fev', inc: 17900, exp: 12600 },
    { m: 'Mar', inc: 18200, exp: 13900 }, { m: 'Abr', inc: 18300, exp: 12700 },
    { m: 'Mai', inc: 18250, exp: 12200 }, { m: 'Jun', inc: 18420, exp: 13180, current: true },
  ];

  // ---- Top categorias do mês ----
  const topCats = [
    { key: 'moradia',     value: 3980, pct: 30.2, delta: +0.4 },
    { key: 'alimentacao', value: 2640, pct: 20.0, delta: +12.5 },
    { key: 'educacao',    value: 1900, pct: 14.4, delta: 0 },
    { key: 'transporte',  value: 1180, pct: 9.0,  delta: -4.1 },
    { key: 'saude',       value: 920,  pct: 7.0,  delta: +2.2 },
    { key: 'mercado',     value: 880,  pct: 6.7,  delta: -1.0 },
    { key: 'lazer',       value: 640,  pct: 4.9,  delta: +18.0 },
    { key: 'assinaturas', value: 412,  pct: 3.1,  delta: +6.0 },
    { key: 'servicos',    value: 380,  pct: 2.9,  delta: 0 },
    { key: 'outros',      value: 248,  pct: 1.8,  delta: 0 },
  ];

  // ---- Próximos compromissos ----
  const upcoming = [
    { day: 10, month: 'jun', title: 'Financiamento do imóvel', cat: 'moradia', value: -2980, status: 'pred', kind: 'Parcela' },
    { day: 12, month: 'jun', title: 'Fatura Nubank', cat: 'servicos', value: -3420, status: 'pred', kind: 'Fatura' },
    { day: 15, month: 'jun', title: 'Mesada / aporte reserva', cat: 'investido', value: -1200, status: 'pred', kind: 'Meta' },
    { day: 18, month: 'jun', title: 'Energia elétrica', cat: 'moradia', value: -340, status: 'est', kind: 'Conta' },
    { day: 20, month: 'jun', title: 'Plano de saúde', cat: 'saude', value: -680, status: 'pred', kind: 'Conta' },
    { day: 22, month: 'jun', title: 'Internet + Streaming', cat: 'assinaturas', value: -212, status: 'pred', kind: 'Assinatura' },
    { day: 28, month: 'jun', title: 'Curso de inglês', cat: 'educacao', value: -360, status: 'pred', kind: 'Conta' },
  ];

  // ---- Cartões ----
  const cards = [
    { name: 'Nubank', last: '4821', brand: 'Mastercard', color: '#7b3fe4', limit: 14000, used: 8420, invoice: 3420, close: 4, due: 12, bestDay: 5, parcelado: 4980, util: 60 },
    { name: 'Itaú Click', last: '0712', brand: 'Visa', color: '#1f4fa3', limit: 9000, used: 2680, invoice: 1860, close: 28, due: 7, bestDay: 1, parcelado: 1240, util: 30 },
  ];
  const cardCats = [
    { key: 'mercado', value: 1240 }, { key: 'alimentacao', value: 980 },
    { key: 'lazer', value: 560 }, { key: 'transporte', value: 420 },
    { key: 'assinaturas', value: 220 },
  ];
  const cardTx = [
    { date: '04/06', desc: 'Carrefour Hiper', cat: 'mercado', value: -342.8, inst: null },
    { date: '03/06', desc: 'iFood', cat: 'alimentacao', value: -78.9, inst: null },
    { date: '02/06', desc: 'Posto Shell', cat: 'transporte', value: -210.0, inst: null },
    { date: '01/06', desc: 'Magalu — Geladeira', cat: 'outros', value: -415.0, inst: '3/10' },
    { date: '29/05', desc: 'Netflix', cat: 'assinaturas', value: -55.9, inst: null },
    { date: '28/05', desc: 'Decathlon', cat: 'lazer', value: -289.9, inst: '2/3' },
  ];

  // ---- Orçamentos ----
  const budgets = [
    { key: 'moradia',     planned: 4200, actual: 3980 },
    { key: 'alimentacao', planned: 2400, actual: 2640 },
    { key: 'educacao',    planned: 1900, actual: 1900 },
    { key: 'transporte',  planned: 1300, actual: 1180 },
    { key: 'saude',       planned: 1000, actual: 920 },
    { key: 'mercado',     planned: 1000, actual: 880 },
    { key: 'lazer',       planned: 500,  actual: 640 },
    { key: 'assinaturas', planned: 400,  actual: 412 },
  ];

  // ---- Metas ----
  const goals = [
    { title: 'Reserva de emergência', cat: 'saude', current: 71200, target: 90000, deadline: 'Dez 2026', monthly: 1200, status: 'ontrack', icon: 'shield' },
    { title: 'Viagem — Nordeste', cat: 'lazer', current: 8400, target: 16000, deadline: 'Set 2026', monthly: 1000, status: 'attention', icon: 'plane' },
    { title: 'Troca do carro', cat: 'transporte', current: 22000, target: 60000, deadline: 'Jun 2027', monthly: 1500, status: 'ontrack', icon: 'car' },
    { title: 'Faculdade — Beatriz', cat: 'educacao', current: 31000, target: 120000, deadline: '2031', monthly: 800, status: 'ontrack', icon: 'cap' },
    { title: 'Quitar financiamento', cat: 'moradia', current: 142000, target: 290000, deadline: '2034', monthly: 2980, status: 'late', icon: 'home' },
  ];

  // ---- Projeção / cenários ----
  const projection = {
    horizons: [
      { d: 30, end: 24640, min: 18120, minDay: '10/jun', risk: 'low', prov: 'real' },
      { d: 60, end: 27980, min: 16400, minDay: '12/jul', risk: 'low', prov: 'est' },
      { d: 90, end: 31200, min: 14900, minDay: '12/ago', risk: 'medium', prov: 'est' },
      { d: 365, end: 58400, min: 12200, minDay: 'dez/26', risk: 'medium', prov: 'est' },
    ],
    // séries para gráfico (saldo projetado: provável, melhor, pior)
    series: (() => {
      const pts = [];
      let base = 24860;
      for (let i = 0; i <= 12; i++) {
        const drift = 2200 * i;
        pts.push({
          m: i,
          prob: Math.round(base + drift + Math.sin(i / 2) * 1400),
          best: Math.round(base + drift * 1.35 + 2000),
          worst: Math.round(base + drift * 0.45 - i * 600 - 800),
        });
      }
      return pts;
    })(),
    assumptions: [
      { label: 'Receita média mensal', value: 'R$ 18.300', prov: 'real' },
      { label: 'Despesa fixa', value: 'R$ 8.100', prov: 'real' },
      { label: 'Despesa variável (média 3m)', value: 'R$ 4.900', prov: 'est' },
      { label: 'Aportes recorrentes', value: 'R$ 1.200/mês', prov: 'real' },
      { label: 'Reajuste de inflação', value: '0,4% a.m.', prov: 'est' },
      { label: 'Renda extra / 13º', value: 'não considerado', prov: 'est' },
    ],
  };

  // ---- Insights IA ----
  const insights = [
    { type: 'warn', title: 'Alimentação 12,5% acima da média', impact: -290, confidence: 'Alta', reason: 'Gastos com delivery cresceram nas últimas 3 semanas, puxando a categoria acima do orçamento planejado.', action: 'Revisar lançamentos de delivery', cat: 'alimentacao', data: '42 transações · jun/2026' },
    { type: 'info', title: 'Assinatura possivelmente esquecida', impact: -39.9, confidence: 'Média', reason: 'Cobrança recorrente de "GymPass" sem uso correspondente detectado há 2 meses.', action: 'Verificar assinatura', cat: 'assinaturas', data: '2 cobranças · R$ 39,90' },
    { type: 'neg', title: 'Risco de saldo baixo em 10/jun', impact: -2980, confidence: 'Alta', reason: 'A parcela do financiamento coincide com a fatura do cartão na mesma semana. Saldo previsto cai para R$ 18.120.', action: 'Ver no calendário', cat: 'moradia', data: 'Projeção 30 dias' },
    { type: 'pos', title: 'Saving rate acima da sua meta', impact: +1640, confidence: 'Alta', reason: 'Você economizou 28,4% da renda este mês, acima da meta de 25% definida nas preferências.', action: 'Direcionar para metas', cat: 'investido', data: 'jun/2026 vs. meta' },
  ];

  // ---- Transações (amostra) ----
  const transactions = [
    { id: 't1', date: '06/06', desc: 'Salário — Marcos Andrade', cat: 'renda', sub: 'Salário', acc: 'Itaú C/C', src: 'OFX', dir: 'in', value: 8200, review: 'ok' },
    { id: 't2', date: '05/06', desc: 'Mensalidade Colégio Adventus', cat: 'educacao', sub: 'Mensalidade', acc: 'Itaú C/C', src: 'Manual', dir: 'out', value: -1900, review: 'ok' },
    { id: 't3', date: '04/06', desc: 'Carrefour Hiper', cat: 'mercado', sub: 'Hipermercado', acc: 'Nubank •4821', src: 'CSV', dir: 'out', value: -342.8, review: 'ok' },
    { id: 't4', date: '04/06', desc: 'Transferência PIX — recebida', cat: 'renda', sub: 'Reembolso', acc: 'Itaú C/C', src: 'OFX', dir: 'in', value: 320, review: 'pending' },
    { id: 't5', date: '03/06', desc: 'iFood * Restaurante', cat: 'alimentacao', sub: 'Delivery', acc: 'Nubank •4821', src: 'CSV', dir: 'out', value: -78.9, review: 'ok' },
    { id: 't6', date: '03/06', desc: 'Uber * Trip', cat: 'transporte', sub: 'Apps (Uber/99)', acc: 'Nubank •4821', src: 'CSV', dir: 'out', value: -34.5, review: 'ok' },
    { id: 't7', date: '02/06', desc: 'Posto Shell Centro', cat: 'transporte', sub: 'Combustível', acc: 'Nubank •4821', src: 'CSV', dir: 'out', value: -210.0, review: 'ok' },
    { id: 't8', date: '02/06', desc: 'Farmácia São João', cat: 'saude', sub: 'Farmácia', acc: 'Itaú C/C', src: 'OFX', dir: 'out', value: -86.4, review: 'pending' },
    { id: 't9', date: '01/06', desc: 'Magazine Luiza — Geladeira (3/10)', cat: 'outros', sub: 'Diversos', acc: 'Nubank •4821', src: 'CSV', dir: 'out', value: -415.0, review: 'ok' },
    { id: 't10', date: '01/06', desc: 'Aporte Tesouro Selic', cat: 'investido', sub: 'Renda fixa', acc: 'Itaú C/C', src: 'Manual', dir: 'out', value: -1200, review: 'ok' },
    { id: 't11', date: '31/05', desc: 'Aluguel recebido — Kitnet', cat: 'renda', sub: 'Aluguel recebido', acc: 'Itaú C/C', src: 'OFX', dir: 'in', value: 1400, review: 'ok' },
    { id: 't12', date: '30/05', desc: 'Conta de energia — CPFL', cat: 'moradia', sub: 'Energia', acc: 'Itaú C/C', src: 'OFX', dir: 'out', value: -318.7, review: 'ok' },
    { id: 't13', date: '29/05', desc: 'Netflix', cat: 'assinaturas', sub: 'Streaming', acc: 'Nubank •4821', src: 'CSV', dir: 'out', value: -55.9, review: 'ok' },
    { id: 't14', date: '29/05', desc: 'Lançamento sem descrição', cat: 'outros', sub: 'Não classificado', acc: 'Itaú C/C', src: 'TXT', dir: 'out', value: -64.0, review: 'uncat' },
  ];

  // ---- Receitas do mês — onde o dinheiro entrou ----
  const incomeBreakdown = {
    total: 18420,
    delta: +4.2,
    items: [
      { cat: 'renda', sub: 'Salário',          value: 8200,  pct: 44.5, count: 1, note: 'Itaú · 06/jun', delta: 0 },
      { cat: 'renda', sub: 'Salário cônjuge',  value: 6500,  pct: 35.3, count: 1, note: 'Itaú · 05/jun', delta: 0 },
      { cat: 'renda', sub: 'Aluguel recebido', value: 1400,  pct: 7.6,  count: 1, note: 'Kitnet · 31/mai', delta: +3.7 },
      { cat: 'renda', sub: 'Freelance',        value: 1200,  pct: 6.5,  count: 2, note: 'Projeto Acme', delta: +28.0 },
      { cat: 'renda', sub: 'Dividendos',       value: 480,   pct: 2.6,  count: 4, note: 'Carteira B3', delta: +12.0 },
      { cat: 'renda', sub: 'Reembolso',        value: 320,   pct: 1.7,  count: 1, note: 'PIX recebido', delta: 0 },
      { cat: 'renda', sub: 'Bônus/13º',        value: 320,   pct: 1.8,  count: 1, note: 'Variável', delta: 0 },
    ],
  };

  // ---- Importações ----
  const imports = [
    { file: 'extrato-itau-mai2026.ofx', date: '06/06 09:12', status: 'done', rows: 148, news: 132, errors: 0, dup: 16, size: '84 KB' },
    { file: 'nubank-fatura-mai.csv', date: '06/06 09:10', status: 'warn', rows: 96, news: 88, errors: 4, dup: 4, size: '32 KB' },
    { file: 'planilha-gastos.xlsx', date: '04/06 21:40', status: 'done', rows: 64, news: 64, errors: 0, dup: 0, size: '21 KB' },
    { file: 'extrato-itau-abr2026.ofx', date: '02/06 08:30', status: 'dup', rows: 140, news: 0, errors: 0, dup: 140, size: '80 KB' },
    { file: 'recibos.txt', date: '01/06 19:02', status: 'failed', rows: 0, news: 0, errors: 12, dup: 0, size: '6 KB' },
    { file: 'cartao-itau-mai.csv', date: '06/06 09:14', status: 'processing', rows: 0, news: 0, errors: 0, dup: 0, size: '28 KB' },
  ];

  // ---- Investimentos ----
  // ---- Investimentos (visão de POSIÇÃO — sem trades, só patrimônio/alocação) ----
  const invest = {
    total: 487300, monthReturn: 1.24, yearReturn: 12.8, ytdReturn: 6.1,
    totalContrib: 412000, totalGain: 75300,

    // Classes de ativos — usadas no donut e nas linhas de rentabilidade
    classes: [
      { id: 'rf',     label: 'Renda Fixa',     color: '#3567b8', value: 197000, pct: 40.4, monthRet: +0.85, yearRet: +9.2  },
      { id: 'prev',   label: 'Previdência',    color: '#7c3aed', value: 124800, pct: 25.6, monthRet: +1.00, yearRet: +6.4  },
      { id: 'rv',     label: 'Ações & ETFs',   color: '#1f8a5b', value: 82000,  pct: 16.8, monthRet: +1.80, yearRet: +14.3 },
      { id: 'fii',    label: 'Fundos Imob.',   color: '#6a52c9', value: 47000,  pct:  9.7, monthRet: +0.50, yearRet: +4.2  },
      { id: 'crypto', label: 'Cripto',         color: '#c98a2b', value: 36500,  pct:  7.5, monthRet: +4.10, yearRet: +26.5 },
    ],
    // alias antigo (algumas telas ainda usam iv.alloc)
    get alloc() { return this.classes.map(c => ({ label: c.label, value: c.value, pct: c.pct, color: c.color })); },

    // Custódias — onde o patrimônio está guardado
    accounts: [
      { id: 'xp',         name: 'XP Investimentos',     kind: 'Corretora',         type: 'broker',   brand: 'XP', color: '#FFCC00', value: 215000, prev: 211900, contrib: 178000, classes: [{ id: 'rf', value: 96000 }, { id: 'rv', value: 72000 }, { id: 'fii', value: 47000 }], sync: 'API conectada',  updated: 'agora' },
      { id: 'cdb-itau',   name: 'Itaú — Reserva',       kind: 'CDB liquidez D+0',  type: 'reserve',  brand: 'IT', color: '#EC7000', value: 73000,  prev: 72700,  contrib: 71000,  classes: [{ id: 'rf', value: 73000 }], sync: 'OFX',           updated: 'há 6h' },
      { id: 'icatu',      name: 'Icatu Previdência',    kind: 'PGBL',              type: 'pension',  brand: 'IC', color: '#E04E2A', value: 78000,  prev: 77100,  contrib: 65000,  classes: [{ id: 'prev', value: 78000 }], sync: 'Manual',        updated: 'ontem' },
      { id: 'brasilprev', name: 'Brasilprev',           kind: 'VGBL',              type: 'pension',  brand: 'BP', color: '#F4C300', value: 46800,  prev: 46200,  contrib: 41000,  classes: [{ id: 'prev', value: 46800 }], sync: 'Manual',        updated: 'há 3d' },
      { id: 'nuinvest',   name: 'NuInvest',             kind: 'Corretora',         type: 'broker',   brand: 'NU', color: '#820AD1', value: 38000,  prev: 37610,  contrib: 36000,  classes: [{ id: 'rf', value: 28000 }, { id: 'rv', value: 10000 }], sync: 'API conectada', updated: 'há 1h' },
      { id: 'binance',    name: 'Binance',              kind: 'Exchange',          type: 'cex',      brand: 'BN', color: '#F0B90B', value: 21500,  prev: 20100,  contrib: 19500,  classes: [{ id: 'crypto', value: 21500 }], sync: 'API conectada', updated: 'agora' },
      { id: 'ledger',     name: 'Cold Wallet — Ledger', kind: 'Self-custody',      type: 'wallet',   brand: 'LG', color: '#1c1c1c', value: 15000,  prev: 14200,  contrib: 13200,  classes: [{ id: 'crypto', value: 15000 }], sync: 'Endereço público', updated: 'há 1 sem' },
    ],

    // Ativos detalhados (posição, não trades)
    assets: [
      // XP
      { name: 'Tesouro Selic 2029',       class: 'rf',     account: 'XP Investimentos', value: 56000, ret: +0.90, ytd: +5.9, risk: 'Baixo',     extra: 'Venc. Set/2029' },
      { name: 'CDB BTG 110% CDI',         class: 'rf',     account: 'XP Investimentos', value: 40000, ret: +0.92, ytd: +5.8, risk: 'Baixo',     extra: 'Venc. Mar/2027' },
      { name: 'IVVB11 — S&P 500',         class: 'rv',     account: 'XP Investimentos', value: 35000, ret: +2.40, ytd: +9.1, risk: 'Alto',      extra: 'ETF global' },
      { name: 'BOVA11 — Ibovespa',        class: 'rv',     account: 'XP Investimentos', value: 22000, ret: -0.80, ytd: +3.2, risk: 'Alto',      extra: 'ETF Brasil' },
      { name: 'WEGE3 — WEG SA',           class: 'rv',     account: 'XP Investimentos', value: 15000, ret: +1.60, ytd: +8.1, risk: 'Alto',      extra: '350 cotas' },
      { name: 'HGLG11 — Logística',       class: 'fii',    account: 'XP Investimentos', value: 28000, ret: +0.60, ytd: +4.4, risk: 'Médio',     extra: 'DY 9,2% a.a.' },
      { name: 'XPLG11 — Logística',       class: 'fii',    account: 'XP Investimentos', value: 19000, ret: +0.40, ytd: +3.9, risk: 'Médio',     extra: 'DY 8,8% a.a.' },
      // NuInvest
      { name: 'Tesouro IPCA+ 2035',       class: 'rf',     account: 'NuInvest',         value: 22000, ret: +0.70, ytd: +4.5, risk: 'Baixo',     extra: 'Venc. Mai/2035' },
      { name: 'LCI Itaú IPCA+',           class: 'rf',     account: 'NuInvest',         value:  6000, ret: +0.60, ytd: +3.9, risk: 'Baixo',     extra: 'Venc. Fev/2028' },
      { name: 'NUBR33 — Nu Holdings',     class: 'rv',     account: 'NuInvest',         value: 10000, ret: +1.20, ytd: +6.5, risk: 'Alto',      extra: '800 cotas' },
      // Reserva Itaú
      { name: 'CDB Itaú Liquidez Diária', class: 'rf',     account: 'Itaú — Reserva',   value: 73000, ret: +0.78, ytd: +5.1, risk: 'Baixo',     extra: 'Liquidez D+0' },
      // Previdência
      { name: 'PGBL Icatu Composto 49',   class: 'prev',   account: 'Icatu Previdência',value: 78000, ret: +1.05, ytd: +6.8, risk: 'Moderado',  extra: 'Tributação regressiva' },
      { name: 'VGBL Brasilprev RT FIX',   class: 'prev',   account: 'Brasilprev',       value: 46800, ret: +0.90, ytd: +5.4, risk: 'Conservador', extra: 'Tributação progressiva' },
      // Binance
      { name: 'Bitcoin (BTC)',            class: 'crypto', account: 'Binance',          value: 14000, ret: +4.20, ytd: +28.4, risk: 'Muito alto', extra: '0,082 BTC' },
      { name: 'Ethereum (ETH)',           class: 'crypto', account: 'Binance',          value:  5500, ret: +6.20, ytd: +18.1, risk: 'Muito alto', extra: '1,42 ETH' },
      { name: 'Solana (SOL)',             class: 'crypto', account: 'Binance',          value:  2000, ret: -2.10, ytd: +12.5, risk: 'Muito alto', extra: '12 SOL' },
      // Ledger
      { name: 'Bitcoin (BTC) — Cold',     class: 'crypto', account: 'Cold Wallet — Ledger', value: 12000, ret: +4.20, ytd: +28.4, risk: 'Muito alto', extra: '0,070 BTC' },
      { name: 'Ethereum (ETH) — Cold',    class: 'crypto', account: 'Cold Wallet — Ledger', value:  3000, ret: +6.20, ytd: +18.1, risk: 'Muito alto', extra: '0,78 ETH' },
    ],

    // Evolução do patrimônio investido (12 meses)
    history: [
      { m: 'jul/25', v: 415000 }, { m: 'ago/25', v: 422000 }, { m: 'set/25', v: 425000 },
      { m: 'out/25', v: 432000 }, { m: 'nov/25', v: 438000 }, { m: 'dez/25', v: 445000 },
      { m: 'jan/26', v: 451000 }, { m: 'fev/26', v: 458000 }, { m: 'mar/26', v: 465000 },
      { m: 'abr/26', v: 472000 }, { m: 'mai/26', v: 480000 }, { m: 'jun/26', v: 487300 },
    ],
  };

  // ---- Patrimônio ----
  const wealth = {
    net: 913100, prov: 'est',
    assets: [
      { label: 'Imóvel — Apartamento', value: 520000, prov: 'est', sub: 'Avaliação manual' },
      { label: 'Investimentos', value: 487300, prov: 'real', sub: 'Carteira consolidada' },
      { label: 'Veículo — SUV 2023', value: 98000, prov: 'est', sub: 'Tabela FIPE' },
      { label: 'Contas e reserva', value: 24860, prov: 'integ', sub: 'A integrar' },
    ],
    liabilities: [
      { label: 'Financiamento imóvel', value: 148000, prov: 'real', sub: '142 parcelas restantes' },
      { label: 'Fatura de cartões', value: 5280, prov: 'real', sub: 'Em aberto' },
      { label: 'Financiamento veículo', value: 63780, prov: 'real', sub: '34 parcelas restantes' },
    ],
    history: [820, 832, 845, 858, 870, 880, 887, 893, 900, 905, 909, 913].map((v, i) => ({ m: i, v: v * 1000 })),
  };

  // ---- Família / membros ----
  const members = [
    { name: 'Marcos Andrade', email: 'marcos@familia.com', role: 'owner', initials: 'MA', color: '#3d7d63', active: 'agora' },
    { name: 'Renata Andrade', email: 'renata@familia.com', role: 'admin', initials: 'RA', color: '#a35a7d', active: 'há 2h' },
    { name: 'Beatriz Andrade', email: 'beatriz@familia.com', role: 'member', initials: 'BA', color: '#7d6a3d', active: 'ontem' },
    { name: 'Contador (Externo)', email: 'jl.contabil@email.com', role: 'viewer', initials: 'JL', color: '#5a6d7d', active: 'há 5 dias' },
  ];

  // ---- Copilot — conversas e respostas pré-roteirizadas ----
  const copilot = {
    threads: [
      { id: 'c1', title: 'Posso comprar este mês?', when: 'Agora', active: true },
      { id: 'c2', title: 'Onde estou gastando mais', when: 'Ontem' },
      { id: 'c3', title: 'Revisar antes do dia 10', when: '2 dias' },
      { id: 'c4', title: 'Plano para a viagem', when: '1 semana' },
    ],
    quick: [
      'Posso fazer uma compra este mês?',
      'Onde estou gastando mais?',
      'O que devo revisar agora?',
      'Como melhorar minha saúde financeira?',
      'Quais contas vencem nos próximos dias?',
    ],
    answers: {
      'Posso fazer uma compra este mês?': {
        text: 'Com base no fluxo de junho, seu **gasto seguro** até o fim do mês é de **R$ 1.240**. Isso já reserva os compromissos previstos (financiamento dia 10 e fatura dia 12) e mantém sua reserva protegida intacta.\n\nUma compra de até R$ 800 mantém o saldo projetado positivo (menor saldo previsto: R$ 18.120 em 10/jun). Acima de R$ 1.240, recomendo aguardar o salário do dia 15.',
        verdict: 'seguro', verdictLabel: 'Compra de até R$ 1.240 é segura',
        sources: ['Gasto seguro (estimado)', 'Projeção 30 dias', 'Próximos compromissos'],
        quality: 86,
      },
      'Onde estou gastando mais?': {
        text: 'Suas três maiores categorias em junho são:\n\n1. **Moradia** — R$ 3.980 (30,2%)\n2. **Alimentação** — R$ 2.640 (20,0%) — *12,5% acima da média*\n3. **Educação** — R$ 1.900 (14,4%)\n\nO maior desvio está em Alimentação, puxado por delivery. Reduzir 15% nessa categoria liberaria cerca de R$ 396/mês.',
        verdict: 'attention', verdictLabel: 'Alimentação merece atenção',
        sources: ['Ranking de categorias (real)', 'Orçamento do mês'],
        quality: 86,
      },
      'O que devo revisar agora?': {
        text: 'Três itens pendentes afetam a precisão dos seus indicadores:\n\n• **3 transações** sem categoria (qualidade dos dados em 86%)\n• **1 assinatura** possivelmente esquecida (GymPass, R$ 39,90)\n• **Fatura Nubank** vence em 12/jun e ainda não está conciliada\n\nResolver as categorizações elevaria a qualidade dos dados para ~94%.',
        verdict: 'attention', verdictLabel: '3 itens para revisar',
        sources: ['Qualidade dos dados (real)', 'Insights IA', 'Cartões'],
        quality: 86,
      },
      'Como melhorar minha saúde financeira?': {
        text: 'Seu **Score de saúde financeira é 78/100** — bom, com espaço para evoluir. Os fatores que mais pesam:\n\n• Comprometimento da renda em 41% (ideal < 35%)\n• Runway de 5,4 meses (meta: 6 meses)\n\nDirecionar o excedente deste mês (R$ 1.640) para a reserva de emergência elevaria o runway e o score em ~4 pontos.',
        verdict: 'seguro', verdictLabel: 'Score 78 — bom',
        sources: ['Saúde financeira (estimado)', 'Comprometimento (real)', 'Runway (estimado)'],
        quality: 86,
      },
      'Quais contas vencem nos próximos dias?': {
        text: 'Próximos 7 dias:\n\n• **10/jun** — Financiamento do imóvel · R$ 2.980\n• **12/jun** — Fatura Nubank · R$ 3.420\n• **15/jun** — Aporte reserva · R$ 1.200\n\nTotal: **R$ 7.600**. Seu salário (R$ 10.220) cai no dia 15, então recomendo manter saldo para os dias 10 e 12.',
        verdict: 'attention', verdictLabel: 'Semana com 2 vencimentos grandes',
        sources: ['Calendário financeiro', 'Próximos compromissos'],
        quality: 86,
      },
    },
  };

  // ---- Navegação ----
  const NAV = [
    { group: 'Visão', items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'gauge' },
      { id: 'cashflow', label: 'Fluxo de Caixa', icon: 'flow' },
      { id: 'transactions', label: 'Transações', icon: 'list' },
      { id: 'categories', label: 'Categorias', icon: 'tag' },
      { id: 'calendar', label: 'Calendário', icon: 'calendar' },
    ]},
    { group: 'Planejamento', items: [
      { id: 'cards', label: 'Cartões', icon: 'card' },
      { id: 'budgets', label: 'Orçamentos', icon: 'target' },
      { id: 'goals', label: 'Metas', icon: 'flag' },
      { id: 'planning', label: 'Planejamento', icon: 'trend' },
      { id: 'scenarios', label: 'Cenários', icon: 'sliders' },
    ]},
    { group: 'Crescimento', items: [
      { id: 'invest', label: 'Investimentos', icon: 'coins' },
      { id: 'wealth', label: 'Patrimônio', icon: 'building' },
      { id: 'reports', label: 'Relatórios', icon: 'report' },
      { id: 'insights', label: 'Insights IA', icon: 'spark' },
      { id: 'copilot', label: 'Copilot', icon: 'chat' },
    ]},
    { group: 'Conta', items: [
      { id: 'family', label: 'Família', icon: 'users' },
      { id: 'billing', label: 'Assinatura', icon: 'receipt' },
      { id: 'settings', label: 'Configurações', icon: 'cog' },
    ]},
  ];

  const TITLES = {
    dashboard: ['Visão', 'Dashboard'], cashflow: ['Visão', 'Fluxo de Caixa'],
    transactions: ['Visão', 'Transações'], categories: ['Visão', 'Categorias e Subcategorias'], calendar: ['Visão', 'Calendário Financeiro'],
    imports: ['Visão', 'Importações'], cards: ['Planejamento', 'Cartões de Crédito'],
    budgets: ['Planejamento', 'Orçamentos'], goals: ['Planejamento', 'Metas'],
    planning: ['Planejamento', 'Planejamento / Projeção'], scenarios: ['Planejamento', 'Cenários / Simulador'],
    invest: ['Crescimento', 'Investimentos'], wealth: ['Crescimento', 'Patrimônio'],
    reports: ['Crescimento', 'Relatórios'], insights: ['Crescimento', 'Insights IA'],
    copilot: ['Crescimento', 'Copilot Financeiro'], family: ['Conta', 'Família / Membros'],
    billing: ['Conta', 'Assinatura'], settings: ['Conta', 'Configurações'],
  };

  window.SCF = {
    BRL, num, CATS, exec, kpis, daily, monthly, topCats, upcoming, cards, cardCats, cardTx,
    budgets, goals, projection, insights, transactions, incomeBreakdown, imports, invest, wealth, members,
    copilot, NAV, TITLES,
    workspace: { name: 'Família Andrade', plan: 'Plano Família', period: 'Junho 2026' },
  };
})();
