/**
 * SmartCashFlow — Design Tokens para Tailwind CSS
 * Substitui o conteúdo de tailwind.config.ts no repo aws-smart-cash-flow/frontend/
 *
 * Uso: copiar este arquivo para frontend/tailwind.config.ts
 */

import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      // ── Fontes ──────────────────────────────────────────────────────────
      fontFamily: {
        display: ["Sora", "Inter", "system-ui", "-apple-system", "sans-serif"],
        body:    ["Sora", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "IBM Plex Mono", "monospace"],
      },

      // ── Cores ───────────────────────────────────────────────────────────
      colors: {
        // Superfícies (light)
        bg:           "var(--bg)",
        "bg-sunken":  "var(--bg-sunken)",
        card:         "var(--card)",
        "card-2":     "var(--card-2)",
        line:         "var(--line)",
        "line-strong":"var(--line-strong)",

        // Texto
        ink:          "var(--ink)",
        "ink-2":      "var(--ink-2)",
        "ink-3":      "var(--ink-3)",
        "ink-faint":  "var(--ink-faint)",

        // Brand / semântico
        acc:          "var(--acc)",
        "acc-strong": "var(--acc-strong)",
        "acc-soft":   "var(--acc-soft)",
        "acc-ink":    "var(--acc-ink)",
        pos:          "var(--pos)",
        "pos-soft":   "var(--pos-soft)",
        neg:          "var(--neg)",
        "neg-soft":   "var(--neg-soft)",
        warn:         "var(--warn)",
        "warn-soft":  "var(--warn-soft)",
        info:         "var(--info)",
        "info-soft":  "var(--info-soft)",
        ai:           "var(--ai)",
        "ai-soft":    "var(--ai-soft)",

        // Sidebar (always dark)
        "side-bg":         "#0b1020",
        "side-bg-2":       "#0f1428",
        "side-elev":       "#1a2138",
        "side-line":       "#232b45",
        "side-text":       "#cdd5e3",
        "side-text-dim":   "#7e8aa5",
        "side-text-bright":"#f5f7fb",

        // Categorias (cores estáveis — usar diretamente)
        cat: {
          moradia:     "#3567b8",
          alimentacao: "#1f8a5b",
          educacao:    "#6a52c9",
          transporte:  "#c98a2b",
          saude:       "#cf4d43",
          lazer:       "#d98234",
          assinaturas: "#9a6b14",
          mercado:     "#2a9d8f",
          servicos:    "#7c8696",
          investido:   "#135737",
          renda:       "#1f8a5b",
          outros:      "#9aa3b0",
        },
      },

      // ── Raios ───────────────────────────────────────────────────────────
      borderRadius: {
        xs:  "8px",
        sm:  "10px",
        md:  "14px",
        lg:  "18px",
        xl:  "24px",
        "2xl": "32px",
      },

      // ── Sombras ─────────────────────────────────────────────────────────
      boxShadow: {
        sm:   "0 1px 2px rgba(15,23,42,.05)",
        md:   "0 4px 12px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.04)",
        lg:   "0 12px 32px rgba(15,23,42,.10), 0 4px 12px rgba(15,23,42,.05)",
        pop:  "0 24px 64px rgba(15,23,42,.22)",
        glow: "0 0 0 1px rgba(0,184,107,.18), 0 8px 28px rgba(0,184,107,.15)",
      },

      // ── Espaçamentos customizados ────────────────────────────────────────
      spacing: {
        "sidebar": "256px",
        "header":  "68px",
        "4.5":     "18px",
        "13":      "52px",
        "15":      "60px",
        "18":      "72px",
        "22":      "88px",
      },

      // ── Gradientes ───────────────────────────────────────────────────────
      backgroundImage: {
        "brand":      "linear-gradient(135deg, #00d97b 0%, #00b8ff 50%, #7c3aed 100%)",
        "brand-soft": "linear-gradient(135deg, rgba(0,217,123,.12), rgba(0,184,255,.10), rgba(124,58,237,.10))",
      },
    },
  },
  plugins: [],
} satisfies Config;
