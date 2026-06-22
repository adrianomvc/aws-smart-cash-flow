# Tela 14 — Configurações (Settings)

**Arquivo no repo:** `frontend/src/pages/SettingsPage.tsx`  
**Rota:** `settings`

---

## Layout Desktop (> 880px)

```
┌────────────────────────────────────────────────┐
│ HEADER: Configurações                          │
├───────────────┬────────────────────────────────┤
│  Sidebar      │  Painel de conteúdo            │
│  240px sticky │                                │
│               │  (muda conforme aba ativa)     │
│  • Perfil     │                                │
│  • Segurança  │                                │
│  • Preferências│                               │
│  • Categorias │                                │
│  • Regras     │                                │
│  • Contas     │                                │
│  • Importação │                                │
│  • Notificações│                               │
│  • Backup     │                                │
│  • Assinatura │                                │
│  • Sobre      │                                │
└───────────────┴────────────────────────────────┘
```

---

## Layout Mobile (≤ 880px) — Navegação iOS

**Estado 1: Lista de itens**
```
┌────────────────────────────────┐
│ Configurações                  │
├────────────────────────────────┤
│ 👤 Perfil              [›]    │
│ 🔒 Segurança           [›]    │
│ ⚙️  Preferências        [›]    │
│ 🏷️  Categorias          [›]    │
│ 🔧 Regras              [›]    │
│ 🏦 Contas e Bancos     [›]    │
│ 📤 Importação          [›]    │
│ 🔔 Notificações        [›]    │
│ 💾 Backup              [›]    │
│ 🧾 Assinatura          [›]    │
│ ℹ️  Sobre               [›]    │
└────────────────────────────────┘
```

**Estado 2: Painel aberto**
```
┌────────────────────────────────┐
│ [← Configurações]              │  ← botão voltar
├────────────────────────────────┤
│                                │
│  [conteúdo do painel]          │
│                                │
└────────────────────────────────┘
```

---

## Implementação mobile

```tsx
function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>("prefs");
  const [showPanel, setShowPanel] = useState(false);
  const isMobile = useMediaQuery("(max-width: 880px)");

  const handleSelect = (id: string) => {
    if (id === "plan") { onNavigate("billing"); return; }
    setActiveTab(id);
    if (isMobile) setShowPanel(true);
  };

  // Mobile — painel aberto
  if (isMobile && showPanel) {
    return (
      <div className="p-4">
        <button onClick={() => setShowPanel(false)}
          className="flex items-center gap-2 text-acc font-bold mb-4">
          <ChevronLeft size={18} />
          Configurações
        </button>
        <SettingsPanel tab={activeTab} />
      </div>
    );
  }

  // Mobile — lista
  if (isMobile) {
    return (
      <div className="p-4">
        <h1>Configurações</h1>
        {items.map(item => (
          <button key={item.id} onClick={() => handleSelect(item.id)}
            className="flex items-center gap-3 w-full p-4 border-b border-line">
            <item.Icon size={18} />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={16} className="text-ink-faint" />
          </button>
        ))}
      </div>
    );
  }

  // Desktop — sidebar + painel
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "240px 1fr" }}>
      <aside className="sticky top-20">
        {items.map(item => (
          <button key={item.id}
            onClick={() => handleSelect(item.id)}
            className={`sidebar-item ${activeTab === item.id ? "active" : ""}`}>
            <item.Icon size={16} />
            {item.label}
          </button>
        ))}
      </aside>
      <SettingsPanel tab={activeTab} />
    </div>
  );
}
```

### Hook useMediaQuery
```tsx
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
```

---

## Abas de configurações

| ID | Label | Conteúdo |
|---|---|---|
| `profile` | Perfil | Nome, email, avatar, fuso horário |
| `security` | Segurança | Troca de senha, 2FA |
| `prefs` | Preferências | Moeda, dia início mês, formato data |
| `cats` | Categorias | Atalho para CategoriesPage |
| `rules` | Regras | Atalho para RulesPage |
| `accounts` | Contas e Bancos | Lista contas + sync status |
| `import` | Importação | Config de parsers, mapeamentos |
| `notif` | Notificações | Toggle de alertas |
| `backup` | Backup | Export JSON, histórico |
| `plan` | Assinatura | Redireciona para billing |
| `about` | Sobre | Versão, changelog |
