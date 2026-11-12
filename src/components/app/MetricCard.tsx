import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import IconTile from "./IconTile";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  hintTone?: "muted" | "success";
  className?: string;
}

const MetricCard = ({ label, value, icon, hint, hintTone = "muted", className }: MetricCardProps) => (
  <div className={cn("flex flex-col gap-3 rounded-3xl border border-border bg-card p-5", className)}>
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <IconTile icon={icon} size="sm" />
    </div>
    <p className="font-display text-3xl font-extrabold tracking-tight">{value}</p>
    {hint && (
      <p className={cn("text-xs font-semibold", hintTone === "success" ? "text-success" : "text-muted-foreground")}>
        {hint}
      </p>
    )}
  </div>
);

export default MetricCard;
