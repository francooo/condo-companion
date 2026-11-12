import { Building2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Marca "condo app": ícone amarelo + wordmark + tagline opcional. */
export const BrandLogo = ({ tagline, compact, className }: { tagline?: string; compact?: boolean; className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <span
      className={cn(
        "inline-flex items-center justify-center bg-primary text-primary-foreground",
        compact ? "h-9 w-9 rounded-xl" : "h-14 w-14 rounded-2xl",
      )}
    >
      <Building2 className={compact ? "h-5 w-5" : "h-7 w-7"} aria-hidden />
    </span>
    <div className="leading-tight">
      <p className={cn("font-display font-extrabold tracking-tight", compact ? "text-lg" : "text-2xl")}>condo app</p>
      {tagline && <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{tagline}</p>}
    </div>
  </div>
);

/** Ilustração de prédios com o "sparkle" de IA, usada nas telas de entrada. */
export const BuildingsIllustration = ({ className }: { className?: string }) => (
  <div className={cn("relative flex h-40 items-end gap-3 sm:h-48", className)} aria-hidden>
    <div className="pointer-events-none absolute -bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full border border-primary/20" />
    <Tower className="h-[45%] w-1/5" />
    <Tower className="h-[90%] w-1/4 bg-brand-soft" rows={5} />
    <div className="relative h-[65%] w-1/5">
      <Tower className="h-full w-full" rows={3} />
      <span className="absolute -right-3 -top-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-md">
        <Sparkles className="h-5 w-5" />
      </span>
    </div>
    <Tower className="h-[38%] w-1/5" rows={1} />
  </div>
);

const Tower = ({ className, rows = 2 }: { className?: string; rows?: number }) => (
  <div className={cn("flex flex-col justify-end gap-3 rounded-t-xl border border-primary/40 bg-card px-4 pb-3", className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-1 rounded-full bg-primary/40" />
    ))}
  </div>
);

/** Painel creme com marca, título e ilustração (splash, boas-vindas, login). */
export const BrandHero = ({
  tagline,
  title,
  description,
  className,
}: {
  tagline?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) => (
  <div className={cn("relative overflow-hidden rounded-3xl bg-surface-warm px-6 pt-8 sm:px-10 sm:pt-10", className)}>
    <BrandLogo tagline={tagline} />
    <h2 className="mt-8 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl">{title}</h2>
    {description && <p className="mt-4 max-w-md text-muted-foreground">{description}</p>}
    <BuildingsIllustration className="mt-8" />
  </div>
);
