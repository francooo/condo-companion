import { Building2 } from "lucide-react";

/** Splash da marca, exibida enquanto a sessão é carregada. */
const FullScreenLoader = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface-warm" role="status" aria-label="Carregando">
    <span className="inline-flex h-20 w-20 animate-pulse items-center justify-center rounded-[1.75rem] bg-primary shadow-lg">
      <Building2 className="h-10 w-10" aria-hidden />
    </span>
    <div className="text-center">
      <p className="font-display text-2xl font-extrabold tracking-tight">condo app</p>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Inteligência para viver melhor</p>
    </div>
  </div>
);

export default FullScreenLoader;
