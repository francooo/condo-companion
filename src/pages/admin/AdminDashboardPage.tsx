import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Inbox, MessageCircle, UserCheck, UserX, Users, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import PageHeader from "@/components/app/PageHeader";
import MetricCard from "@/components/app/MetricCard";
import SectionCard from "@/components/app/SectionCard";
import ListRow, { ListRows } from "@/components/app/ListRow";
import IconTile from "@/components/app/IconTile";
import { PageContainer } from "@/components/layout/AppShell";

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const SHORTCUTS = [
  { to: "/admin/documentos", icon: FileText, title: "Documentos", meta: "Envie convenção, regimento, atas e comunicados" },
  { to: "/admin/solicitacoes", icon: Inbox, title: "Solicitações de acesso", meta: "Aprove ou recuse pedidos de vínculo" },
  { to: "/admin/moradores", icon: Users, title: "Moradores", meta: "Cadastre, ative ou desative moradores" },
  { to: "/admin/financeiro", icon: Wallet, title: "Financeiro", meta: "Importe e consulte receitas e despesas" },
  { to: "/chat", icon: MessageCircle, title: "Assistente do condomínio", meta: "Veja o chat como os moradores veem" },
];

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const residents = useQuery({ queryKey: ["residents"], queryFn: () => api.residents.list() });
  const pending = useQuery({ queryKey: ["access-requests", "pending"], queryFn: () => api.accessRequests.list("pending") });
  const financial = useQuery({ queryKey: ["financial", "count"], queryFn: () => api.financial.list({ page: 0, pageSize: 1 }) });

  const list = residents.data?.residents ?? [];
  const active = list.filter((r) => r.active && r.membership_status === "approved").length;
  const inactive = list.filter((r) => !r.active || r.membership_status === "suspended").length;
  const loadingValue = "—";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Administração", "Visão geral", profile?.condo_name ?? "Condomínio"]}
        title={`${greeting()}, ${profile?.full_name?.split(" ")[0] ?? "administrador"}`}
        description={`Gestão do ${profile?.condo_name ?? "condomínio"}.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Moradores ativos" icon={UserCheck} value={residents.isLoading ? loadingValue : active} hint="com acesso ao assistente" hintTone="success" />
        <MetricCard label="Acesso suspenso" icon={UserX} value={residents.isLoading ? loadingValue : inactive} hint="sem acesso no momento" />
        <MetricCard
          label="Solicitações pendentes"
          icon={Clock}
          value={pending.isLoading ? loadingValue : (pending.data?.requests.length ?? 0)}
          hint="aguardando análise"
        />
        <MetricCard
          label="Registros financeiros"
          icon={Wallet}
          value={financial.isLoading ? loadingValue : (financial.data?.total ?? 0).toLocaleString("pt-BR")}
          hint="lançamentos importados"
        />
      </div>

      <SectionCard title="Atalhos" description="Acesse as áreas deste condomínio.">
        <ListRows>
          {SHORTCUTS.map((s) => (
            <ListRow key={s.to} to={s.to} leading={<IconTile icon={s.icon} />} title={s.title} meta={s.meta} />
          ))}
        </ListRows>
      </SectionCard>
    </PageContainer>
  );
};

export default AdminDashboardPage;
