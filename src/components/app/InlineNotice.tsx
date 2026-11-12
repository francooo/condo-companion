import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { box: "bg-muted text-muted-foreground", icon: Info },
  warning: { box: "border border-primary/30 bg-warning-soft text-foreground", icon: AlertTriangle },
  success: { box: "bg-success-soft text-success", icon: CheckCircle2 },
  danger: { box: "bg-danger-soft text-danger", icon: XCircle },
};

interface InlineNoticeProps {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
  hideIcon?: boolean;
}

const InlineNotice = ({ tone = "info", children, className, hideIcon }: InlineNoticeProps) => {
  const { box, icon: Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl px-4 py-3 text-sm", box, className)}>
      {!hideIcon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export default InlineNotice;
