import { Loader2 } from "lucide-react";

const FullScreenLoader = () => (
  <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Carregando">
    <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft">
      <Loader2 className="h-7 w-7 animate-spin text-brand-strong" />
    </span>
  </div>
);

export default FullScreenLoader;
