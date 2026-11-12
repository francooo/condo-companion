import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, Clock, FileText, Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { greeting } from "@/lib/format";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/app/PageHeader";
import MetricCard from "@/components/app/MetricCard";
import SectionCard from "@/components/app/SectionCard";
import ListRow, { ListRows } from "@/components/app/ListRow";
import EmptyState from "@/components/app/EmptyState";
import IconTile from "@/components/app/IconTile";
import CondoBadge from "@/components/app/CondoBadge";
import ScopeCard from "@/components/app/ScopeCard";
import ActivityFeed from "@/components/app/ActivityFeed";
import { PageContainer } from "@/components/layout/AppShell";

const num = (n: number) => n.toLocaleString("pt-BR");

const PlatformDashboardPage = () => {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["condos"], queryFn: () => api.condos.list() });
  const condos = data?.condos ?? [];
  const sum = (k: "resident_count" | "pending_count" | "doc_count") => condos.reduce((s, c) => s + Number(c[k] ?? 0), 0);
  const recent = [...condos].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const v = (n: number) => (isLoading ? "—" : num(n));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Administração", "Visão geral", "Plataforma"]}
        title={`${greeting()}, ${profile?.full_name?.split(" ")[0] ?? "administrador"}`}
        description="Gestão da plataforma: visão consolidada de todos os condomínios."
        actions={
          <Button asChild size="lg">
            <Link to="/plataforma/condominios/novo">
              <Plus /> Adicionar condomínio
            </Link>
          </Button>
        }
      />

      <ScopeCard scope="platform" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Condomínios cadastrados" icon={Building2} value={v(condos.length)} hint="em toda a plataforma" hintTone="success" />
        <MetricCard label="Moradores ativos" icon={Users} value={v(sum("resident_count"))} hint="em todos os ambientes" hintTone="success" />
        <MetricCard label="Solicitações pendentes" icon={Clock} value={v(sum("pending_count"))} hint="aguardando análise" />
        <MetricCard label="Documentos" icon={FileText} value={v(sum("doc_count"))} hint="em todas as bibliotecas" hintTone="success" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <ActivityFeed showCondo description="Eventos de todos os condomínios." />
        <div className="space-y-6">
          <SectionCard
            title="Condomínios recentes"
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
                    to={`/plataforma/condominios/${c.id}`}
                    leading={<CondoBadge name={c.display_name || c.name} logoUrl={c.logo_url} color={c.primary_color} />}
                    title={c.display_name || c.name}
                    meta={[c.city, `${c.resident_count ?? 0} moradores`].filter(Boolean).join(" · ")}
                  />
                ))}
              </ListRows>
            )}
          </SectionCard>
          <SectionCard>
            <ListRow
              to="/plataforma/uso"
              leading={<IconTile icon={BarChart3} />}
              title="Uso do assistente"
              meta="Conversas, respostas com fontes e perguntas sem resposta"
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
};

export default PlatformDashboardPage;
