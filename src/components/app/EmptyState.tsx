import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import IconTile from "./IconTile";

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
    <IconTile icon={icon} size="lg" />
    <h3 className="text-xl font-bold tracking-tight">{title}</h3>
    {description && <p className="max-w-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export default EmptyState;
