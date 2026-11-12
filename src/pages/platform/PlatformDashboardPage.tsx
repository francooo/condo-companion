import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/app/PageHeader";
import MetricCard from "@/components/app/MetricCard";
import SectionCard from "@/components/app/SectionCard";
import ListRow, { ListRows } from "@/components/app/ListRow";
import CondoBadge from "@/components/app/CondoBadge";
import EmptyState from "@/components/app/EmptyState";
import { PageContainer } from "@/components/layout/AppShell";
import { greeting } from "@/pages/admin/AdminDashboardPage";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const PlatformDashboardPage = () => {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["condos"], queryFn: () => api.condos.list() });
  const condos = data?.condos ?? [];
  const chunks = condos.reduce((s, c) => s + Number(c.doc_count ?? 0), 0);
  const recent = [...condos].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Administração", "Visão geral", "Plataforma"]}
        title={`${greeting()}, ${profile?.full_name?.split(" ")[0] ?? "administrador"}`}
        description="Gestão da plataforma: visão consolidada de todos os condomínios."
        actions={
          <Button asChild>
            <Link to="/plataforma/condominios?novo=1">
              <Plus /> Adicionar condomínio
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricCard label="Condomínios cadastrados" icon={Building2} value={isLoading ? "—" : condos.length} hint="em toda a plataforma" hintTone="success" />
        <MetricCard label="Trechos indexados" icon={FileText} value={isLoading ? "—" : chunks.toLocaleString("pt-BR")} hint="em todas as bibliotecas" hintTone="success" />
      </div>

      <SectionCard
        title="Condomínios recentes"
        description="Os últimos ambientes cadastrados."
        aside={
          <Button asChild variant="outline" size="sm">
            <Link to="/plataforma/condominios">Ver todos</Link>
          </Button>
        }
      >
        {!isLoading && recent.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhum condomínio ainda" description="Cadastre o primeiro condomínio para começar." />
        ) : (
          <ListRows>
            {recent.map((c) => (
              <ListRow
                key={c.id}
                to="/plataforma/condominios"
                leading={<CondoBadge name={c.name} />}
                title={c.name}
                meta={`${c.identifier} · desde ${dateFmt.format(new Date(c.created_at))}`}
              />
            ))}
          </ListRows>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default PlatformDashboardPage;
