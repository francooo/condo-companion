import { NavLink, Link, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import CondoBadge from "@/components/app/CondoBadge";
import StatusPill from "@/components/app/StatusPill";

const TABS = [
  { to: "", label: "Visão geral", end: true },
  { to: "documentos", label: "Documentos" },
  { to: "moradores", label: "Moradores" },
  { to: "agente", label: "Agente de IA" },
  { to: "personalizacao", label: "Personalização" },
];

/** Barra comum às áreas de um condomínio na plataforma: identificação e abas. */
const PlatformCondoLayout = () => {
  const { condoId = "" } = useParams();
  const { data } = useQuery({ queryKey: ["condo", condoId], queryFn: () => api.condos.get(condoId), retry: false });
  const condo = data?.condo;
  const base = `/plataforma/condominios/${condoId}`;

  return (
    <>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-5xl space-y-3 px-4 pt-4 sm:px-6">
          <Link to="/plataforma/condominios" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Condomínios
          </Link>
          <div className="flex items-center gap-3">
            <CondoBadge name={condo?.branding.display_name || condo?.name} logoUrl={condo?.branding.logo_url} color={condo?.branding.primary_color} size="sm" />
            <p className="min-w-0 truncate font-bold">{condo?.branding.display_name || condo?.name || "Condomínio"}</p>
            {condo?.status === "inactive" && <StatusPill status="inactive" />}
          </div>
          <nav aria-label="Áreas do condomínio" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {TABS.map((t) => (
              <NavLink
                key={t.label}
                to={t.to ? `${base}/${t.to}` : base}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    isActive ? "bg-brand-soft text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <Outlet />
    </>
  );
};

export default PlatformCondoLayout;
