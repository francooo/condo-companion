import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BarChart3, Home, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/app/Brand";
import CondoBadge from "@/components/app/CondoBadge";
import { cn } from "@/lib/utils";
import { tenantStyle } from "@/lib/color";
import { AREA_LABEL, NAV, type NavItem, type ShellArea } from "./nav";

const navLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
    active ? "bg-brand-soft text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

const NavList = ({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) => (
  <nav className="flex flex-col gap-1">
    {items.map((item) => (
      <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => navLinkClass(isActive)}>
        <item.icon className="h-5 w-5" aria-hidden />
        {item.label}
      </NavLink>
    ))}
  </nav>
);

/** Alternador Morador | Administração, para quem administra um condomínio e também usa o chat. */
const ModeSwitch = ({ area }: { area: ShellArea }) => {
  const { profile } = useAuth();
  if (profile?.role !== "admin") return null;
  const items = [
    { to: "/chat", label: "Morador", icon: Home, current: area === "resident" },
    { to: "/admin", label: "Administração", icon: BarChart3, current: area === "admin" },
  ];
  return (
    <div className="inline-flex rounded-2xl border border-border bg-muted p-1" role="tablist" aria-label="Modo de uso">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          role="tab"
          aria-selected={i.current}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            i.current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <i.icon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{i.label}</span>
        </Link>
      ))}
    </div>
  );
};

const CondoChip = () => {
  const { profile } = useAuth();
  if (!profile?.condo_name) return null;
  return (
    <span className="inline-flex max-w-[11rem] items-center gap-2 rounded-2xl border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm font-semibold">
      <CondoBadge
        name={profile.condo_name}
        size="sm"
        logoUrl={profile.condo_branding?.logo_url}
        color={profile.condo_branding?.primary_color}
        className={profile.condo_branding?.primary_color ? undefined : "bg-primary"}
      />
      <span className="truncate">{profile.condo_name}</span>
    </span>
  );
};

const UserFooter = () => {
  const { profile, signOut } = useAuth();
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="px-3">
        <p className="truncate text-sm font-semibold">{profile?.full_name || profile?.email}</p>
        <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
      </div>
      <button type="button" onClick={signOut} className={cn(navLinkClass(false), "w-full")}>
        <LogOut className="h-5 w-5" aria-hidden />
        Sair
      </button>
    </div>
  );
};

interface AppShellProps {
  area: ShellArea;
}

const AppShell = ({ area }: AppShellProps) => {
  const { profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // A área do morador assume as cores do condomínio; a administração mantém a identidade do Condo App.
  const branding = area === "resident" ? profile?.condo_branding : null;
  const items = NAV[area];
  const bottomItems = items.filter((i) => !i.menuOnly);

  return (
    <div className="flex min-h-dvh bg-background" style={tenantStyle(branding?.primary_color, branding?.secondary_color)}>
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 border-r border-border bg-card px-4 py-6 lg:flex">
        <BrandLogo compact className="px-2" />
        <p className="eyebrow px-3">{AREA_LABEL[area]}</p>
        <div className="flex-1 overflow-y-auto">
          <NavList items={items} />
        </div>
        <UserFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-80 flex-col gap-6">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <BrandLogo compact />
              </SheetHeader>
              <p className="eyebrow px-3">{AREA_LABEL[area]}</p>
              <div className="flex-1 overflow-y-auto">
                <NavList items={items} onNavigate={() => setMenuOpen(false)} />
              </div>
              <UserFooter />
            </SheetContent>
          </Sheet>
          <ModeSwitch area={area} />
          <div className="ml-auto">
            <CondoChip />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (mobile) */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {bottomItems.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-xs",
                    isActive ? "font-bold text-foreground [&_svg]:text-brand-strong" : "text-muted-foreground",
                  )
                }
              >
                <item.icon className="h-6 w-6" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

/** Contêiner padrão do conteúdo das páginas. */
export const PageContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-10", className)}>{children}</div>
);

export default AppShell;
