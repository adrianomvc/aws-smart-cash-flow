# SmartCashFlow — Design Handoff

Este pacote documenta o wireframe/protótipo visual aprovado para implementação no repo `aws-smart-cash-flow`.

---

## Stack do repo
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + Supabase Auth
- **Backend**: FastAPI + Python + SQLAlchemy + Supabase + Mangum (AWS Lambda)
- **UI lib**: shadcn/ui (lucide-react para ícones)

---

## Sistema de Design

### Fontes
| Papel | Família | Pesos |
|---|---|---|
| Display / Headings | `Sora` | 600, 700, 800 |
| Body | `Sora` / `Inter` fallback | 400, 500, 600 |
| Mono / números | `JetBrains Mono` | 400, 500 |

Adicionar ao `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Paleta (Light Mode)
| Token | Valor | Uso |
|---|---|---|
| `bg` | `#f6f8fb` | Fundo geral |
| `card` | `#ffffff` | Cards |
| `line` | `#e6eaf0` | Bordas |
| `ink` | `#0f172a` | Texto principal |
| `ink-3` | `#5e6783` | Texto secundário |
| `acc` | `#00b86b` | Verde — CTA, brand, receitas |
| `neg` | `#ff4d6d` | Coral — despesas, negativo |
| `warn` | `#f5a623` | Âmbar — alertas |
| `info` | `#2563eb` | Azul — saldo, informativo |
| `ai` | `#7c3aed` | Roxo — insights, copilot |

### Paleta (Dark Mode)
| Token | Valor | Uso |
|---|---|---|
| `bg` | `#07111F` | Fundo geral |
| `card` | `#0D1729` | Cards |
| `line` | `rgba(255,255,255,.06)` | Bordas |
| `ink` | `#F2F5FB` | Texto principal |
| `acc` | `#22C55E` | Verde brand |
| `neg` | `#EF4444` | Vermelho despesas |
| `info` | `#316BFF` | Azul saldo |

### Sidebar (sempre dark navy)
| Token | Valor |
|---|---|
| `side-bg` | `#0b1020` |
| `side-text` | `#cdd5e3` |
| `side-text-dim` | `#7e8aa5` |
| Largura | `256px` |

### Raios de borda
| Nome | Valor | Uso |
|---|---|---|
| `r-xs` | `8px` | Badges, chips |
| `r-sm` | `10px` | Inputs, botões pequenos |
| `r-md` | `14px` | Cards internos |
| `r-lg` | `18px` | Cards principais |
| `r-xl` | `24px` | Modais, drawers |

### Sombras
```css
--sh-sm:  0 1px 2px rgba(15,23,42,.05);
--sh-md:  0 4px 12px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.04);
--sh-lg:  0 12px 32px rgba(15,23,42,.10), 0 4px 12px rgba(15,23,42,.05);
```

### Proveniência de dados
Todo indicador deve carregar um badge de origem:
| Badge | Cor | Significado |
|---|---|---|
| `real` | Verde | Dado importado e confirmado |
| `est` | Âmbar | Estimativa / projeção |
| `integ` | Azul | Requer integração bancária |
| `future` | Roxo | Dado futuro projetado |

---

## Categorias padrão (com cores)
| ID | Label | Cor hex |
|---|---|---|
| `moradia` | Moradia | `#3567b8` |
| `alimentacao` | Alimentação | `#1f8a5b` |
| `educacao` | Educação | `#6a52c9` |
| `transporte` | Transporte | `#c98a2b` |
| `saude` | Saúde | `#cf4d43` |
| `lazer` | Lazer | `#d98234` |
| `assinaturas` | Assinaturas | `#9a6b14` |
| `mercado` | Mercado | `#2a9d8f` |
| `servicos` | Serviços | `#7c8696` |
| `investido` | Investimentos | `#135737` |
| `renda` | Renda | `#1f8a5b` |
| `outros` | Outros | `#9aa3b0` |

---

## Rotas (19 telas)
| Rota | Tela | Status no repo |
|---|---|---|
| `dashboard` | Visão geral | ✅ implementado — melhorar |
| `cashflow` | Fluxo de caixa | ✅ implementado |
| `transactions` | Transações | ✅ implementado |
| `calendar` | Calendário financeiro | ✅ implementado |
| `cards` | Cartões | ✅ implementado |
| `budgets` | Orçamentos | ✅ implementado |
| `goals` | Metas | ✅ implementado |
| `planning` | Planejamento | ✅ implementado |
| `reports` | Relatórios | ✅ implementado |
| `imports` | Importações | ✅ implementado |
| `categories` | Categorias | ✅ implementado |
| `rules` | Regras | ✅ implementado |
| `review` | Revisão | ✅ implementado |
| `settings` | Configurações | ✅ implementado |
| `insights` | Insights IA | 🔜 futuro |
| `scenarios` | Cenários | 🔜 futuro |
| `invest` | Investimentos | 🔜 futuro |
| `wealth` | Patrimônio | 🔜 futuro |
| `family` | Família | 🔜 futuro |

---

## Próximos passos recomendados

1. **Atualizar `tailwind.config.ts`** com os tokens — ver `tokens.ts`
2. **Dashboard** — adicionar card Top Categorias expansível — ver `screens/01-dashboard.md`
3. **Fechar MVP 1** — importação TXT/CSV end-to-end real
4. **Settings mobile** — navegação iOS (lista → painel) — ver `screens/14-settings.md`

Ver `PROMPT_CLAUDE.md` para prompts prontos para usar no Claude Desktop.
