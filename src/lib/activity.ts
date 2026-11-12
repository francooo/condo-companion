import {
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  FileX,
  Palette,
  PauseCircle,
  PlayCircle,
  UserMinus,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent } from "./api";
import type { StatusTone } from "@/components/app/StatusPill";

interface Described {
  title: string;
  detail: string;
  icon: LucideIcon;
  tone: StatusTone;
  pill: string;
}

/** Texto, ícone e pílula de um evento da atividade recente. */
export function describeActivity(e: ActivityEvent, showCondo: boolean): Described {
  const person = e.subject_name || e.subject_email || "Morador";
  const by = e.actor_name ? `por ${e.actor_name}` : null;
  const condo = showCondo ? e.condo_name : null;
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
  const file = e.payload.filename ?? "documento";

  switch (e.type) {
    case "membership.requested":
      return { title: "Novo morador aguardando vínculo", detail: join(condo, person), icon: Clock, tone: "warning", pill: "Pendente" };
    case "membership.cancelled":
      return { title: "Solicitação cancelada", detail: join(condo, person), icon: XCircle, tone: "neutral", pill: "Cancelado" };
    case "membership.approved":
      return { title: "Vínculo aprovado", detail: join(condo, person, by), icon: CheckCircle2, tone: "success", pill: "Aprovado" };
    case "membership.rejected":
      return { title: "Solicitação recusada", detail: join(condo, person, by), icon: XCircle, tone: "danger", pill: "Recusado" };
    case "membership.suspended":
      return { title: "Acesso suspenso", detail: join(condo, person, by), icon: PauseCircle, tone: "danger", pill: "Suspenso" };
    case "membership.reactivated":
      return { title: "Acesso reativado", detail: join(condo, person, by), icon: PlayCircle, tone: "success", pill: "Reativado" };
    case "membership.removed":
      return { title: "Morador removido", detail: join(condo, person, by), icon: UserMinus, tone: "neutral", pill: "Removido" };
    case "membership.added":
      return { title: "Morador cadastrado", detail: join(condo, person, by), icon: UserPlus, tone: "success", pill: "Cadastro" };
    case "document.uploaded":
      return { title: "Documento enviado", detail: join(condo, file, by), icon: FileText, tone: "info", pill: "Enviado" };
    case "document.processed":
      return { title: "Documento processado", detail: join(condo, file), icon: FileText, tone: "success", pill: "Processado" };
    case "document.failed":
      return { title: "Falha ao processar documento", detail: join(condo, file), icon: FileX, tone: "danger", pill: "Falha" };
    case "document.deleted":
      return { title: "Documento excluído", detail: join(condo, file, by), icon: FileX, tone: "neutral", pill: "Excluído" };
    case "agent.updated":
      return { title: "Assistente reconfigurado", detail: join(condo, by), icon: Bot, tone: "info", pill: "Agente" };
    case "agent.enabled":
      return { title: "Assistente liberado aos moradores", detail: join(condo, by), icon: Bot, tone: "success", pill: "Disponível" };
    case "agent.disabled":
      return { title: "Assistente retirado dos moradores", detail: join(condo, by), icon: Bot, tone: "warning", pill: "Retirado" };
    case "branding.updated":
      return { title: "Identidade visual atualizada", detail: join(condo, by), icon: Palette, tone: "info", pill: "Visual" };
    case "branding.restored":
      return { title: "Identidade padrão restaurada", detail: join(condo, by), icon: Palette, tone: "neutral", pill: "Visual" };
    case "condo.created":
      return { title: "Condomínio cadastrado", detail: join(e.condo_name, by), icon: Building2, tone: "success", pill: "Novo" };
    case "condo.updated":
      return {
        title: e.payload.status === "inactive" ? "Condomínio desativado" : "Cadastro do condomínio atualizado",
        detail: join(e.condo_name, by),
        icon: Building2,
        tone: e.payload.status === "inactive" ? "danger" : "info",
        pill: "Cadastro",
      };
    default:
      return { title: e.type, detail: join(condo, by), icon: Clock, tone: "neutral", pill: "Evento" };
  }
}
