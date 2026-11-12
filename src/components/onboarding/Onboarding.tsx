import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, LogOut, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { CondoSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/app/Brand";
import CondoBadge from "@/components/app/CondoBadge";
import IconTile from "@/components/app/IconTile";
import StatusPill, { type StatusTone } from "@/components/app/StatusPill";
import { cn } from "@/lib/utils";

/** Layout das etapas de vínculo (usuário logado, ainda sem acesso ao condomínio). */
export const OnboardingShell = ({ children }: { children: ReactNode }) => {
  const { signOut, profile } = useAuth();
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-4 sm:px-6">
          <BrandLogo compact />
          <div className="flex items-center gap-2">
            {profile?.full_name && <span className="hidden text-sm text-muted-foreground sm:inline">{profile.full_name}</span>}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
};

type StepState = "done" | "current" | "todo" | "error";
const STEPS = ["Conta", "Vínculo", "Acesso"];

/** Indicador de progresso Conta → Vínculo → Acesso. */
export const Stepper = ({ states }: { states: [StepState, StepState, StepState] }) => (
  <ol className="flex items-center gap-2 sm:gap-3" aria-label="Etapas do acesso">
    {STEPS.map((label, i) => {
      const state = states[i];
      return (
        <li key={label} className="flex flex-1 items-center gap-2 last:flex-none sm:gap-3">
          <span
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              state === "done" && "bg-success text-white",
              state === "current" && "bg-primary text-primary-foreground",
              state === "error" && "bg-danger text-white",
              state === "todo" && "bg-muted text-muted-foreground",
            )}
          >
            {state === "done" ? <Check className="h-4 w-4" /> : state === "error" ? <X className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn("text-sm font-semibold", state === "todo" && "font-normal text-muted-foreground")}>{label}</span>
          {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden />}
        </li>
      );
    })}
  </ol>
);

export const formatAddress = (c: Pick<CondoSummary, "address" | "city" | "state">) =>
  [c.address, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

/** Cartão "Condomínio selecionado/relacionado". */
export const CondoCard = ({ label, condo, note }: { label: string; condo: CondoSummary; note?: ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-5 text-left">
    <p className="eyebrow">{label}</p>
    <div className="mt-3 flex items-center gap-4">
      <CondoBadge name={condo.name} className="bg-primary/60" />
      <div className="min-w-0">
        <p className="font-semibold">{condo.name}</p>
        <p className="text-sm text-muted-foreground">{note ?? (formatAddress(condo) || "Acesso limitado a este condomínio")}</p>
      </div>
    </div>
  </div>
);

/** Bloco central dos estados: ícone, pílula, título e texto. */
export const StateHero = ({
  icon,
  pill,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  pill: string;
  tone: StatusTone;
  title: ReactNode;
  children?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <IconTile icon={icon} size="lg" className="h-20 w-20 rounded-[1.75rem] text-foreground [&_svg]:h-8 [&_svg]:w-8" />
    <StatusPill tone={tone}>{pill}</StatusPill>
    <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>
    {children && <div className="max-w-md text-muted-foreground">{children}</div>}
  </div>
);
