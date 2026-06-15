import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, MessageSquare, Plus, Send, Sparkles } from "lucide-react";

import { copilotChat, getCopilotStatus, getDashboardSummary } from "../lib/api";
import type { ApiSession, CopilotTurn } from "../lib/api";
import type { TransactionDrilldown } from "../types";
import { money } from "../lib/utils";

const SUGGESTIONS = [
  "Quais minhas 3 maiores categorias de gasto?",
  "Onde eu poderia economizar?",
  "Custos fixos vs variáveis?",
  "Posso gastar R$ 1.000 com tranquilidade?",
];
const GREETING: CopilotTurn = {
  role: "assistant",
  content:
    "Olá! Sou o Copiloto Financeiro do SmartCashFlow. Posso analisar seus gastos, "
    + "categorias, custos fixos, metas e projeções — sempre com base nos seus dados reais. "
    + "Use uma pergunta rápida ou escreva a sua.",
};

type Thread = { id: string; title: string; when: number; messages: CopilotTurn[] };

const newId = () => Math.random().toString(36).slice(2, 10);
const freshThread = (): Thread => ({ id: newId(), title: "Nova conversa", when: Date.now(), messages: [GREETING] });

function whenLabel(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function renderRich(text: string) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 7 }} />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") ? <b key={j}>{p.slice(2, -2)}</b> : <Fragment key={j}>{p}</Fragment>,
    );
    return <div key={i} style={{ marginBottom: 2 }}>{parts}</div>;
  });
}

function pct(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

export function CopilotChat({ session, onOpenTransactions }: {
  session: ApiSession;
  onOpenTransactions?: (drilldown?: TransactionDrilldown) => void;
}) {
  const threadsKey = `scf_copilot_threads_${session.token.slice(0, 16)}`;
  const [threads, setThreads] = useState<Thread[]>(() => {
    try {
      const raw = localStorage.getItem(threadsKey);
      const parsed = raw ? (JSON.parse(raw) as Thread[]) : [];
      return parsed.length ? parsed : [freshThread()];
    } catch {
      return [freshThread()];
    }
  });
  const [activeId, setActiveId] = useState(() => threads[0]?.id);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  const messages = active?.messages ?? [GREETING];

  useEffect(() => {
    try {
      localStorage.setItem(threadsKey, JSON.stringify(threads.slice(0, 20)));
    } catch { /* ignore */ }
  }, [threads, threadsKey]);

  const statusQ = useQuery({
    queryKey: ["copilot-status", session.token],
    queryFn: () => getCopilotStatus(session),
    staleTime: 5 * 60 * 1000,
  });

  // The copilot is NOT tied to the dashboard period: it gets a multi-period
  // snapshot and decides which period to use. The side panel shows all-time.
  const summaryQ = useQuery({
    queryKey: ["copilot-summary", session.token],
    queryFn: () => getDashboardSummary(session, ""),
    staleTime: 2 * 60 * 1000,
  });
  const s = summaryQ.data;

  function patchActive(fn: (t: Thread) => Thread) {
    setThreads((ts) => ts.map((t) => (t.id === active?.id ? fn(t) : t)));
  }

  const send = useMutation({
    mutationFn: (text: string) =>
      copilotChat(session, { message: text, history: messages.slice(-6) }),
    onSuccess: (res) =>
      patchActive((t) => ({
        ...t,
        messages: [...t.messages, { role: "assistant", content: res.reply || "Não consegui responder agora. Tente novamente." }],
      })),
    onError: () =>
      patchActive((t) => ({ ...t, messages: [...t.messages, { role: "assistant", content: "Erro ao falar com o copiloto. Tente novamente." }] })),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, send.isPending]);

  function ask(text: string) {
    const t = text.trim();
    if (!t || send.isPending) return;
    patchActive((th) => ({
      ...th,
      title: th.messages.some((m) => m.role === "user") ? th.title : t.slice(0, 40),
      when: Date.now(),
      messages: [...th.messages, { role: "user", content: t }],
    }));
    setInput("");
    send.mutate(t);
  }

  function newConversation() {
    const t = freshThread();
    setThreads((ts) => [t, ...ts]);
    setActiveId(t.id);
  }

  if (statusQ.data && !statusQ.data.available) {
    return (
      <div className="card card-pad" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div className="state-ic" style={{ margin: "0 auto 14px", width: 52, height: 52 }}><Sparkles size={24} /></div>
        <h4 style={{ margin: "0 0 6px", fontSize: 16 }}>Copiloto de IA indisponível</h4>
        <p className="t-sub" style={{ maxWidth: 440, margin: "0 auto", lineHeight: 1.55 }}>
          Configure uma chave de LLM (Groq ou Gemini) no backend (.env) para ativar o chat.
        </p>
      </div>
    );
  }

  return (
    <div className="copilot" style={{ height: "calc(100dvh - 250px)", minHeight: 480 }}>
      {/* Conversas */}
      <div className="card cp-threads">
        <div style={{ padding: "14px 14px 10px" }}>
          <button className="btn btn-primary btn-sm" style={{ width: "100%" }} onClick={newConversation} type="button">
            <Plus size={14} /> Nova conversa
          </button>
        </div>
        <div className="eyebrow" style={{ padding: "4px 16px 8px" }}>Conversas</div>
        <div style={{ padding: "0 8px", overflowY: "auto" }}>
          {threads.map((t) => (
            <button key={t.id} onClick={() => setActiveId(t.id)} className={"cp-thread" + (t.id === active?.id ? " on" : "")} type="button">
              <MessageSquare size={15} />
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                <div className="t-sub">{whenLabel(t.when)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="card cp-chat">
        <div ref={scrollRef} className="cp-scroll">
          {messages.map((m, i) => (
            m.role === "user" ? (
              <div key={i} className="cp-msg user"><div className="cp-bubble user">{m.content}</div></div>
            ) : (
              <div key={i} className="cp-msg assistant">
                <div className="cp-avatar"><Sparkles size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cp-bubble">{renderRich(m.content)}</div>
                  {i > 0 && (
                    <div className="cp-sources">
                      <span className="mono t-sub" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Database size={12} /> Fontes:
                      </span>
                      <span className="pill" style={{ fontSize: 10.5 }}>Seus dados</span>
                    </div>
                  )}
                </div>
              </div>
            )
          ))}
          {send.isPending && (
            <div className="cp-msg assistant">
              <div className="cp-avatar"><Sparkles size={15} /></div>
              <div className="cp-bubble" style={{ display: "flex", gap: 4, padding: "14px 16px" }}>
                <span className="cp-dot" /><span className="cp-dot" /><span className="cp-dot" />
              </div>
            </div>
          )}
        </div>
        <div className="cp-quick">
          {SUGGESTIONS.map((q) => (
            <button key={q} className="chip" onClick={() => ask(q)} type="button">{q}</button>
          ))}
        </div>
        <div className="cp-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
            placeholder="Pergunte sobre suas finanças…"
          />
          <button className="btn btn-primary" onClick={() => ask(input)} disabled={send.isPending || !input.trim()} type="button">
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className="card cp-side">
        <div style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Resumo financeiro</div>
          <div style={{ display: "grid", gap: 12 }}>
            <SideStat label="Saldo em conta" value={s ? money(s.current_balance) : "—"} />
            <SideStat label="Gasto seguro (30d)" value={s ? money(s.safe_spend) : "—"} />
            <SideStat label="Saúde financeira" value={s?.financial_health_score != null ? `${s.financial_health_score}/100` : "—"} />
            <SideStat label="Comprometimento" value={s ? pct(s.commitment_rate) : "—"} />
          </div>
          {onOpenTransactions && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: "100%", marginTop: 14 }}
              onClick={() => onOpenTransactions()}
              type="button"
            >
              <Database size={14} /> Ver transações
            </button>
          )}
        </div>
        <hr className="divider" />
        <div style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Como funciona</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Todo o seu histórico</div>
          <div className="t-sub">O copiloto escolhe o período conforme a sua pergunta.</div>
        </div>
        <hr className="divider" />
        <div style={{ padding: 16 }}>
          <div className="alert info">
            <div className="alert-ic"><Sparkles size={16} /></div>
            <div>
              <div className="a-ttl">Limites do Copiloto</div>
              <div className="a-txt">Não é consultoria financeira nem promete retornos. As respostas usam apenas seus dados.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SideStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-3)", flex: 1 }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{value}</span>
    </div>
  );
}
