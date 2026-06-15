import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, Sparkles, User } from "lucide-react";

import { copilotChat, getCopilotStatus } from "../lib/api";
import type { ApiSession, CopilotTurn } from "../lib/api";
import type { PeriodState } from "../types";

const SUGGESTIONS = [
  "Quais minhas 3 maiores categorias de gasto?",
  "Onde eu poderia economizar neste mês?",
  "Quanto gasto com custos fixos vs variáveis?",
  "Posso gastar R$ 1.000 com tranquilidade agora?",
];

export function CopilotChat({ session, period }: { session: ApiSession; period?: PeriodState }) {
  const [messages, setMessages] = useState<CopilotTurn[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const statusQ = useQuery({
    queryKey: ["copilot-status", session.token],
    queryFn: () => getCopilotStatus(session),
    staleTime: 5 * 60 * 1000,
  });

  const dateFrom = period && period.periodPreset !== "all" ? period.dateFrom : null;
  const dateTo = period && period.periodPreset !== "all" ? period.dateTo : null;

  const send = useMutation({
    mutationFn: (text: string) =>
      copilotChat(session, {
        message: text,
        history: messages.slice(-6),
        date_from: dateFrom,
        date_to: dateTo,
      }),
    onSuccess: (res) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply || "Não consegui responder agora. Tente novamente." },
      ]);
    },
    onError: () => {
      setMessages((m) => [...m, { role: "assistant", content: "Erro ao falar com o copiloto. Tente novamente." }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || send.isPending) return;
    setMessages((m) => [...m, { role: "user", content: t }]);
    setInput("");
    send.mutate(t);
  }

  if (statusQ.data && !statusQ.data.available) {
    return (
      <div className="card card-pad" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div className="state-ic" style={{ margin: "0 auto 14px", width: 52, height: 52 }}><Sparkles size={24} /></div>
        <h4 style={{ margin: "0 0 6px", fontSize: 16 }}>Copiloto de IA indisponível</h4>
        <p className="t-sub" style={{ maxWidth: 440, margin: "0 auto", lineHeight: 1.55 }}>
          Configure uma chave de LLM (Groq ou Gemini) no backend (.env) para ativar o chat. A análise de Insights determinística continua funcionando.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 230px)", minHeight: 420 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 460 }}>
            <div className="state-ic" style={{ margin: "0 auto 12px", width: 48, height: 48 }}><Sparkles size={22} /></div>
            <h4 style={{ margin: "0 0 6px", fontSize: 15.5 }}>Pergunte ao seu Copiloto Financeiro</h4>
            <p className="t-sub" style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 16 }}>
              Ele responde com base nas suas transações reais do período selecionado.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn btn-ghost btn-sm" onClick={() => submit(s)} type="button" style={{ fontSize: 12 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8, flex: "none", display: "grid", placeItems: "center",
              background: m.role === "user" ? "var(--acc-soft)" : "var(--info-soft)",
              color: m.role === "user" ? "var(--acc)" : "var(--info)",
            }}>
              {m.role === "user" ? <User size={15} /> : <Sparkles size={15} />}
            </span>
            <div style={{
              maxWidth: "78%", padding: "10px 13px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              background: m.role === "user" ? "var(--acc)" : "var(--card-2)",
              color: m.role === "user" ? "#fff" : "var(--ink)",
              border: m.role === "user" ? "none" : "1px solid var(--line)",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: "var(--info-soft)", color: "var(--info)" }}><Sparkles size={15} /></span>
            <span className="t-sub" style={{ fontSize: 12.5 }}>Pensando…</span>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        style={{ display: "flex", gap: 8, padding: "12px 14px", borderTop: "1px solid var(--line)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre seus gastos, metas, onde economizar…"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13.5, background: "var(--card-2)", color: "var(--ink)" }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={send.isPending || !input.trim()}>
          <Send size={15} /> Enviar
        </button>
      </form>
    </div>
  );
}
