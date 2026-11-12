import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Elemento no canto superior direito (contador, pílula, ação). */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

const SectionCard = ({ title, description, aside, children, className, bodyClassName }: SectionCardProps) => (
  <section className={cn("rounded-3xl border border-border bg-card p-5 sm:p-7", className)}>
    {(title || aside) && (
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          {title && <h2 className="text-xl font-bold tracking-tight">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

export const CountBadge = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex rounded-xl bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground">
    {children}
  </span>
);

export default SectionCard;
