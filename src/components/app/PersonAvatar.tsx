import { condoInitials } from "./CondoBadge";
import { cn } from "@/lib/utils";

/** Avatar com iniciais de uma pessoa (morador, solicitante). */
const PersonAvatar = ({ name, size = "md", className }: { name: string | null; size?: "md" | "lg"; className?: string }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold",
      size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm",
      className,
    )}
    aria-hidden
  >
    {condoInitials(name || "?")}
  </span>
);

export default PersonAvatar;
