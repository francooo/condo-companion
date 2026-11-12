import { cn } from "@/lib/utils";

interface FilterChipsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}

function FilterChips<T extends string>({ options, value, onChange, className, ...rest }: FilterChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={rest["aria-label"]} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary/40 bg-brand-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterChips;
