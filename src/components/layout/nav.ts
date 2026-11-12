import {
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ShellArea = "resident" | "admin" | "platform";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Ativo apenas na rota exata (ex.: o painel "/admin"). */
  end?: boolean;
  /** Fica fora da barra inferior do mobile e só aparece no menu/sidebar. */
  menuOnly?: boolean;
}

export const NAV: Record<ShellArea, NavItem[]> = {
  resident: [
    { to: "/chat", label: "Chat", icon: MessageCircle },
    { to: "/ajuda", label: "Ajuda", icon: LifeBuoy },
    { to: "/perfil", label: "Perfil", icon: UserRound },
  ],
  admin: [
    { to: "/admin", label: "Painel", icon: LayoutDashboard, end: true },
    { to: "/admin/documentos", label: "Documentos", icon: FileText },
    { to: "/admin/moradores", label: "Moradores", icon: Users },
    { to: "/admin/solicitacoes", label: "Solicitações", icon: Inbox },
    { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
    { to: "/admin/perfil", label: "Perfil", icon: UserRound, menuOnly: true },
  ],
  platform: [
    { to: "/plataforma", label: "Painel", icon: LayoutDashboard, end: true },
    { to: "/plataforma/condominios", label: "Condomínios", icon: Building2 },
    { to: "/plataforma/solicitacoes", label: "Solicitações", icon: Inbox },
    { to: "/plataforma/perfil", label: "Perfil", icon: UserRound },
  ],
};

export const AREA_LABEL: Record<ShellArea, string> = {
  resident: "Morador",
  admin: "Administração",
  platform: "Plataforma",
};

/** Página inicial de cada perfil após o login, conforme o estado do vínculo. */
export function homePathFor(
  profile: { role: string; condo_id: string | null; membership_status?: string | null } | null,
) {
  if (!profile) return "/boas-vindas";
  if (profile.role === "superadmin") return "/plataforma";
  if (!profile.condo_id) return "/vinculo";
  if (profile.membership_status !== "approved") return "/vinculo/status";
  if (profile.role === "admin") return "/admin";
  return "/chat";
}

/** Vínculo aprovado: pode usar as áreas do condomínio. */
export function hasApprovedAccess(profile: { role: string; condo_id: string | null; membership_status?: string | null }) {
  return profile.role === "superadmin" || (Boolean(profile.condo_id) && profile.membership_status === "approved");
}
