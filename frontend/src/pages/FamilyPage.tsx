import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, Loader2, Lock, Send, ShieldCheck, Star, Trash2, UserPlus, Users, X,
} from "lucide-react";

import {
  acceptInvite, cancelInvite, getInvites, getMembers, inviteMember, removeMember, updateMemberRole,
} from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { PageState } from "../components/ui";
import type { ApiSession, MemberRead } from "../lib/api";

const ROLE_META: Record<string, { label: string; desc: string; badge: string }> = {
  owner: { label: "Proprietário", desc: "Controle total", badge: "b-pos" },
  admin: { label: "Administrador", desc: "Gerencia dados e membros", badge: "b-info" },
  member: { label: "Membro", desc: "Adiciona e categoriza", badge: "b-neutral" },
  viewer: { label: "Visualizador", desc: "Apenas leitura", badge: "b-neutral" },
};
const ASSIGNABLE = ["admin", "member", "viewer"];
const AVATAR_COLORS = ["#3d7d63", "#a35a7d", "#7d6a3d", "#5a6d7d", "#6a4ba8", "#2a4d8f", "#c98a2b", "#1f8a5b"];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(m: MemberRead): string {
  if (m.is_self) return "EU";
  const base = m.name && !m.name.includes("-") ? m.name : m.email;
  const parts = base.replace(/@.*/, "").split(/[.\s_]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}
function displayName(m: MemberRead): string {
  if (m.is_self) return "Você";
  if (m.name && !m.name.includes("-")) return m.name;
  return m.email.replace(/@.*/, "");
}
function ago(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "hoje";
  if (d < 2) return "ontem";
  if (d < 30) return `há ${Math.round(d)} dias`;
  return `há ${Math.round(d / 30)} mês(es)`;
}

export function FamilyPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const membersQ = useQuery({ queryKey: ["members", session.token], queryFn: () => getMembers(session) });
  const invitesQ = useQuery({ queryKey: ["invites", session.token], queryFn: () => getInvites(session) });
  const [showInvite, setShowInvite] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["members"] });
    void queryClient.invalidateQueries({ queryKey: ["invites"] });
  }
  const setRole = useMutation({ mutationFn: (v: { id: string; role: string }) => updateMemberRole(session, v.id, v.role), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => removeMember(session, id), onSuccess: invalidate });
  const accept = useMutation({ mutationFn: (id: string) => acceptInvite(session, id), onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: (id: string) => cancelInvite(session, id), onSuccess: invalidate });

  if (membersQ.isLoading) {
    return <PageState icon={Loader2} title="Carregando família" description="Buscando membros do workspace." spin />;
  }
  const members = membersQ.data?.items ?? [];
  const invites = invitesQ.data?.items ?? [];

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Conta</div>
          <h2 className="section-title"><Users size={18} /> Família / Membros</h2>
          <p className="section-sub">Uso compartilhado por workspace. Cada membro tem um papel com permissões claras — os dados ficam isolados nesta família.</p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ flex: "none" }} onClick={() => setShowInvite(true)}><UserPlus size={15} /> Convidar membro</button>
      </div>

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi icon={<Users size={15} />} label="Membros ativos" value={String(members.length)} />
        <Kpi icon={<Send size={15} />} label="Convites pendentes" value={String(invites.length)} tone={invites.length > 0 ? "warn" : undefined} />
        <Kpi icon={<Star size={15} />} label="Plano" value="Família" sub="até 6 membros" />
        <Kpi icon={<ShieldCheck size={15} />} label="Isolamento de dados" value="Ativo" sub="por workspace" tone="pos" />
      </div>

      <div className="dash-main" style={{ alignItems: "start" }}>
        {/* Members */}
        <div className="card">
          <div className="card-head"><span className="kpi-ic"><Users size={15} /></span><div><span className="ttl">Membros</span></div></div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Membro</th><th>Papel</th><th>Desde</th><th /></tr></thead>
              <tbody>
                {members.map(m => {
                  const meta = ROLE_META[m.role] ?? ROLE_META.member;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 12, background: colorFor(m.email) }}>{initials(m)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="t-desc">{displayName(m)}{m.is_self && <span className="t-sub" style={{ fontWeight: 400 }}> · você</span>}</div>
                            <div className="t-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {m.role === "owner" ? (
                          <div><span className={"badge " + meta.badge}>{meta.label}</span><div className="t-sub" style={{ marginTop: 3 }}>{meta.desc}</div></div>
                        ) : (
                          <div>
                            <select className="fld-select" style={{ padding: "5px 8px", fontSize: 12.5 }} value={m.role} onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value })}>
                              {ASSIGNABLE.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                            </select>
                            <div className="t-sub" style={{ marginTop: 3 }}>{meta.desc}</div>
                          </div>
                        )}
                      </td>
                      <td className="t-sub">{ago(m.created_at)}</td>
                      <td className="num">
                        {m.role !== "owner" && (
                          <button className="icon-btn" style={{ width: 30, height: 30 }} title="Remover" onClick={() => { if (window.confirm(`Remover ${displayName(m)} do workspace?`)) remove.mutate(m.id); }}><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side */}
        <div className="vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><span className="kpi-ic"><Send size={15} /></span><div><span className="ttl">Convites pendentes</span></div></div>
            <div style={{ padding: "8px 14px 14px" }}>
              {invites.length === 0 && <div className="t-sub" style={{ padding: "8px 4px" }}>Nenhum convite pendente.</div>}
              {invites.map(inv => (
                <div key={inv.id} className="row-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--bg-sunken)", color: "var(--ink-faint)", fontWeight: 700 }}>?</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-desc" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                    <div className="t-sub">{ROLE_META[inv.role]?.label ?? inv.role} · enviado {ago(inv.created_at)}</div>
                  </div>
                  <button className="btn btn-quiet btn-sm" title="Aceitar (sem e-mail no ambiente local)" onClick={() => accept.mutate(inv.id)}><Check size={13} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} title="Cancelar" onClick={() => cancel.mutate(inv.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><Lock size={15} /></span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Privacidade & controle</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
              {["Dados isolados por workspace familiar", "Valores nunca expostos a terceiros", "Cada acesso é rastreável por membro", "Papéis controlam quem edita ou apenas vê"].map((t, i) => (
                <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
                  <Check size={15} style={{ color: "var(--acc)", flex: "none" }} />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {showInvite && <InviteModal session={session} onClose={() => setShowInvite(false)} onSaved={() => { setShowInvite(false); invalidate(); }} />}
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-top"><span className="kpi-ic" style={tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : undefined}>{icon}</span><span className="kpi-label">{label}</span></div>
      <div className="kpi-val" style={{ fontSize: 20 }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function InviteModal({ session, onClose, onSaved }: { session: ApiSession; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => inviteMember(session, { email: email.trim(), role }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e, "Falha ao convidar.")),
  });
  function submit() {
    if (!email.includes("@")) { setError("Informe um e-mail válido."); return; }
    setError(""); save.mutate();
  }

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><UserPlus size={17} /></span>
          <div style={{ minWidth: 0 }}><div className="mh-ttl">Convidar membro</div><div className="mh-sub">Adicione alguém à família com um papel.</div></div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="mdl-body">
          <label className="fld"><span className="fld-label">E-mail</span>
            <input className="fld-input" autoFocus type="email" placeholder="nome@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="fld"><span className="fld-label">Papel</span>
            <select className="fld-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNABLE.map(r => <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].desc}</option>)}
            </select></label>
          <div className="alert info" style={{ marginTop: 4 }}>
            <span className="alert-ic"><AlertTriangle size={16} /></span>
            <div><div className="a-txt">No ambiente local não há envio de e-mail: o convite fica pendente e você pode aceitá-lo manualmente para criar o membro.</div></div>
          </div>
        </div>
        <div className="mdl-foot">
          <span className="spacer" style={{ color: "var(--neg)", fontSize: 12 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={save.isPending}>Convidar</button>
        </div>
      </div>
    </div>
  );
}
