import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Partes do sobretítulo, unidas por " · " (ex.: ["Administração", "Documentos"]). */
  eyebrow?: string[];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const PageHeader = ({ eyebrow, title, description, actions, className }: PageHeaderProps) => (
  <header className={cn("space-y-3", className)}>
    {eyebrow && eyebrow.length > 0 && <p className="eyebrow">{eyebrow.join(" · ")}</p>}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
