import { CheckCircle2, Clock, PauseCircle, PlayCircle, UserMinus, UserPlus, XCircle, type LucideIcon } from "lucide-react";
import type { MembershipEvent, Resident } from "./api";
import type { StatusTone } from "@/components/app/StatusPill";

export type ResidentFilter = "all" | "active" | "pending" | "suspended";

/** Situação de uma pessoa do condomínio, como aparece para a administração. */
export function residentStatus(r: Pick<Resident, "active" | "membership_status">): { key: ResidentFilter | "disabled"; label: string; tone: StatusTone } {
  if (!r.active) return { key: "disabled", label: "Conta desativada", tone: "neutral" };
  switch (r.membership_status) {
    case "pending":
      return { key: "pending", label: "Aguardando", tone: "warning" };
    case "suspended":
      return { key: "suspended", label: "Acesso suspenso", tone: "danger" };
    default:
      return { key: "active", label: "Ativo", tone: "success" };
  }
}

export function matchesResidentFilter(r: Pick<Resident, "active" | "membership_status">, f: ResidentFilter) {
  if (f === "all") return true;
  return residentStatus(r).key === f;
}

export const unitLabel = (r: Pick<Resident, "unit" | "block">) =>
  [r.unit && `Unidade ${r.unit}`, r.block && `Bloco ${r.block}`].filter(Boolean).join(" · ");

export const roleLabel = (role: string) => (role === "admin" ? "Síndico" : "Morador");

const EVENTS: Record<string, { title: string; icon: LucideIcon; tone: StatusTone; pill: string }> = {
  "membership.requested": { title: "Solicitação recebida", icon: Clock, tone: "warning", pill: "Pedido" },
  "membership.cancelled": { title: "Solicitação cancelada pelo morador", icon: XCircle, tone: "neutral", pill: "Cancelado" },
  "membership.approved": { title: "Vínculo aprovado", icon: CheckCircle2, tone: "success", pill: "Aprovado" },
  "membership.rejected": { title: "Solicitação recusada", icon: XCircle, tone: "danger", pill: "Recusado" },
  "membership.suspended": { title: "Acesso suspenso", icon: PauseCircle, tone: "danger", pill: "Suspenso" },
  "membership.reactivated": { title: "Acesso reativado", icon: PlayCircle, tone: "success", pill: "Reativado" },
  "membership.removed": { title: "Removido do condomínio", icon: UserMinus, tone: "neutral", pill: "Removido" },
  "membership.added": { title: "Cadastrado pela administração", icon: UserPlus, tone: "success", pill: "Cadastro" },
};

export function describeEvent(e: MembershipEvent) {
  const base = EVENTS[e.type] ?? { title: e.type, icon: Clock, tone: "neutral" as StatusTone, pill: "Evento" };
  const who = e.by_self ? "pelo próprio morador" : e.actor_name ? `por ${e.actor_name}` : null;
  const unit = e.type === "membership.requested" && e.payload.unit ? unitLabel({ unit: e.payload.unit, block: e.payload.block ?? null }) : null;
  return { ...base, who, unit, reason: e.payload.reason ?? null };
}
