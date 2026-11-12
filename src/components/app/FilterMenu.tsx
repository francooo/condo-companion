import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface FilterMenuProps<T extends string> {
  /** Rótulo do menu (acessível e no topo da lista). */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Valor considerado "sem filtro": o chip fica neutro quando selecionado. */
  neutralValue?: T;
}

/** Chip que abre uma lista de opções (ex.: "Todas categorias ▾"). Destaca-se quando há filtro aplicado. */
function FilterMenu<T extends string>({ label, options, value, onChange, neutralValue }: FilterMenuProps<T>) {
  const current = options.find((o) => o.value === value);
  const applied = neutralValue !== undefined && value !== neutralValue;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${current?.label ?? ""}`}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          applied || neutralValue === undefined
            ? "border-primary/40 bg-brand-soft text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted",
        )}
      >
        {current?.label ?? label}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem] rounded-xl">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="py-2">
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FilterMenu;
