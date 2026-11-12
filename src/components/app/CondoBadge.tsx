import { cn } from "@/lib/utils";

export function condoInitials(name?: string | null) {
  if (!name) return "?";
  const words = name
    .replace(/^(condom[ií]nio|residencial|edif[ií]cio)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

const sizes = {
  sm: "h-8 w-8 rounded-lg text-xs",
  md: "h-12 w-12 rounded-2xl text-sm",
  lg: "h-16 w-16 rounded-2xl text-base",
};

interface CondoBadgeProps {
  name?: string | null;
  logoUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

/** Logotipo do condomínio ou, na falta dele, as iniciais sobre a cor do tenant. */
const CondoBadge = ({ name, logoUrl, size = "md", className }: CondoBadgeProps) => {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={cn("shrink-0 object-cover", sizes[size], className)} />;
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-brand-soft font-bold text-foreground",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {condoInitials(name)}
    </span>
  );
};

export default CondoBadge;
