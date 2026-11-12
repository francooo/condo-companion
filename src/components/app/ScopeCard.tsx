import { cn } from "@/lib/utils";
import SectionCard from "./SectionCard";

/** Mostra qual escopo de administração este perfil tem: plataforma inteira ou um único condomínio. */
const ScopeCard = ({ scope, condoName }: { scope: "platform" | "condo"; condoName?: string | null }) => {
  const options = [
    { key: "platform", title: "Plataforma", text: "Todos os condomínios" },
    { key: "condo", title: "Condomínio", text: condoName ? `Somente ${condoName}` : "Somente o condomínio vinculado" },
  ];
  return (
    <SectionCard title="Escopo da administração" description="Papéis distintos: a administração de um condomínio não acessa outros ambientes.">
      <ul className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const current = o.key === scope;
          return (
            <li
              key={o.key}
              aria-current={current ? "true" : undefined}
              className={cn("rounded-2xl border p-4", current ? "border-2 border-foreground bg-surface-warm" : "border-border text-muted-foreground")}
            >
              <p className={cn("font-bold", current && "text-foreground")}>{o.title}</p>
              <p className="text-sm">{o.text}</p>
              {current && <p className="mt-2 text-xs font-semibold text-foreground">Seu acesso</p>}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};

export default ScopeCard;
