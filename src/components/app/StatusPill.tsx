import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-soft text-success", dot: "bg-success" },
  warning: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  danger: { pill: "bg-danger-soft text-danger", dot: "bg-danger" },
  info: { pill: "bg-info-soft text-info", dot: "bg-info" },
  neutral: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

/** Mapeia os estados de domínio (documentos, vínculos, agente) para tom e rótulo. */
export const STATUS_MAP: Record<string, { tone: StatusTone; label: string }> = {
  // documentos
  uploaded: { tone: "info", label: "Enviado" },
  processing: { tone: "warning", label: "Processando" },
  processed: { tone: "success", label: "Processado" },
  failed: { tone: "danger", label: "Falha no processamento" },
  needs_review: { tone: "danger", label: "Precisa de revisão" },
  // vínculo / conta
  pending: { tone: "warning", label: "Pendente" },
  approved: { tone: "success", label: "Aprovado" },
  rejected: { tone: "danger", label: "Recusado" },
  suspended: { tone: "neutral", label: "Suspenso" },
  active: { tone: "success", label: "Ativo" },
  inactive: { tone: "danger", label: "Inativo" },
  // agente
  available: { tone: "success", label: "Disponível" },
  ready: { tone: "success", label: "Pronto" },
  incomplete: { tone: "warning", label: "Configuração incompleta" },
};

interface StatusPillProps {
  tone?: StatusTone;
  /** Estado de domínio; define tom e rótulo pelo STATUS_MAP quando `tone`/`children` não forem passados. */
  status?: string;
  children?: ReactNode;
  className?: string;
}

const StatusPill = ({ tone, status, children, className }: StatusPillProps) => {
  const mapped = status ? STATUS_MAP[status] : undefined;
  const t = tones[tone ?? mapped?.tone ?? "neutral"];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
        t.pill,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", t.dot)} aria-hidden />
      {children ?? mapped?.label ?? status}
    </span>
  );
};

export default StatusPill;
