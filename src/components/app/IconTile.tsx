import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4",
  md: "h-12 w-12 rounded-2xl [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-16 w-16 rounded-3xl [&_svg]:h-7 [&_svg]:w-7",
};

const tones = {
  brand: "bg-brand-soft text-brand-strong",
  solid: "bg-primary text-primary-foreground",
  muted: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

interface IconTileProps {
  icon: LucideIcon;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  className?: string;
}

const IconTile = ({ icon: Icon, size = "md", tone = "brand", className }: IconTileProps) => (
  <span className={cn("inline-flex shrink-0 items-center justify-center", sizes[size], tones[tone], className)}>
    <Icon aria-hidden />
  </span>
);

export default IconTile;
