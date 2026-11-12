import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bot, Clock, FileText, Inbox, MessageCircle, Palette, Users, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { greeting } from "@/lib/format";
import PageHeader from "@/components/app/PageHeader";
import MetricCard from "@/components/app/MetricCard";
import SectionCard from "@/components/app/SectionCard";
import ListRow, { ListRows } from "@/components/app/ListRow";
import IconTile from "@/components/app/IconTile";
import ScopeCard from "@/components/app/ScopeCard";
import ActivityFeed from "@/components/app/ActivityFeed";
import { PageContainer } from "@/components/layout/AppShell";

const SHORTCUTS = [
  { to: "/admin/solicitacoes", icon: Inbox, title: "Solicitações de acesso", meta: "Aprove ou recuse pedidos de vínculo" },
  { to: "/admin/documentos", icon: FileText, title: "Documentos", meta: "Envie convenção, regimento, atas e comunicados" },
  { to: "/admin/moradores", icon: Users, title: "Moradores", meta: "Cadastre, suspenda ou remova moradores" },
  { to: "/admin/agente", icon: Bot, title: "Agente de IA", meta: "Identidade, fontes, teste e liberação aos moradores" },
  { to: "/admin/uso", icon: BarChart3, title: "Uso do assistente", meta: "Indicadores e perguntas sem resposta" },
  { to: "/admin/personalizacao", icon: Palette, title: "Personalização", meta: "Nome, cores, logotipo e capa do condomínio" },
  { to: "/admin/financeiro", icon: Wallet, title: "Financeiro", meta: "Importe e consulte receitas e despesas" },
  { to: "/chat", icon: MessageCircle, title: "Assistente do condomínio", meta: "Veja o chat como os moradores veem" },
];

const AGENT_LABEL = { incomplete: "Incompleto", ready: "Pronto", available: "Disponível" } as const;

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const condoId = profile?.condo_id ?? "";
  const { data, isLoading } = useQuery({ queryKey: ["condo", condoId], queryFn: () => api.condos.get(condoId), enabled: Boolean(condoId) });
  const c = data?.condo;
  const v = (n: number | undefined) => (isLoading || n === undefined ? "—" : n.toLocaleString("pt-BR"));
  const condoName = profile?.condo_name ?? "Condomínio";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Administração", "Visão do condomínio"]}
        title={`${greeting()}, ${profile?.full_name?.split(" ")[0] ?? "administrador"}`}
        description={`Painel de ${condoName}: gestão limitada a este condomínio.`}
      />

      <ScopeCard scope="condo" condoName={condoName} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Moradores vinculados" icon={Users} value={v(c?.resident_count)} hint={`somente ${condoName}`} hintTone="success" />
        <MetricCard
          label="Solicitações pendentes"
          icon={Clock}
          value={v(c?.pending_count)}
          hint={c?.pending_count ? "aguardando sua análise" : "nenhuma pendência"}
          hintTone={c?.pending_count ? "warning" : undefined}
        />
        <MetricCard label="Documentos próprios" icon={FileText} value={v(c?.doc_count)} hint={c ? `${c.agent.documents_available} disponíveis ao agente` : "base deste ambiente"} />
        <MetricCard
          label="Conversas"
          icon={MessageCircle}
          value={v(c?.conversations_30d)}
          hint={c ? `nos últimos 30 dias · agente ${AGENT_LABEL[c.agent.status].toLowerCase()}` : "últimos 30 dias"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <ActivityFeed title="Atividade deste condomínio" description={`Somente eventos de ${condoName}.`} />
        <SectionCard title="Atalhos">
          <ListRows>
            {SHORTCUTS.map((s) => (
              <ListRow key={s.to} to={s.to} leading={<IconTile icon={s.icon} />} title={s.title} meta={s.meta} />
            ))}
          </ListRows>
        </SectionCard>
      </div>
    </PageContainer>
  );
};

export default AdminDashboardPage;
