import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Circle, FileText, Loader2, MessageCircle, Settings2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { shortDate } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import MetricCard from "@/components/app/MetricCard";
import StatusPill from "@/components/app/StatusPill";
import CondoBadge from "@/components/app/CondoBadge";
import PersonAvatar from "@/components/app/PersonAvatar";
import FormField from "@/components/app/FormField";
import PasswordInput from "@/components/app/PasswordInput";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import ActivityFeed from "@/components/app/ActivityFeed";
import { PageContainer } from "@/components/layout/AppShell";

const AGENT_LABEL = { incomplete: "Incompleto", ready: "Pronto", available: "Disponível" } as const;

const AddAdminDialog = ({ condoId, condoName, open, onOpenChange }: { condoId: string; condoName: string; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const create = useMutation({
    mutationFn: () => api.admins.create({ email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), condo_id: condoId }),
    onSuccess: () => {
      toast.success("Administrador criado.");
      setForm({ full_name: "", email: "", password: "" });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["condo-admins", condoId] });
      queryClient.invalidateQueries({ queryKey: ["condo", condoId] });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível criar o administrador.")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Administrador · {condoName}</DialogTitle>
          <DialogDescription>A administração do condomínio só acessa este ambiente. Passe a senha inicial à pessoa.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Nome completo" htmlFor="adm-name">
            <Input id="adm-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </FormField>
          <FormField label="E-mail" htmlFor="adm-email">
            <Input id="adm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </FormField>
          <FormField label="Senha inicial" htmlFor="adm-pass" hint="Mínimo de 6 caracteres.">
            <PasswordInput id="adm-pass" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />} Criar administrador
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Step = ({ done, children, to }: { done: boolean; children: React.ReactNode; to: string }) => (
  <li>
    <Link to={to} className="group flex items-start gap-3 rounded-xl py-1.5 hover:underline">
      {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Concluído" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="Pendente" />}
      <span className={done ? "text-muted-foreground" : "font-semibold"}>{children}</span>
    </Link>
  </li>
);

const CondoDetailPage = () => {
  const { condoId = "" } = useParams();
  const [addingAdmin, setAddingAdmin] = useState(false);
  const { data, isError } = useQuery({ queryKey: ["condo", condoId], queryFn: () => api.condos.get(condoId), retry: false });
  const admins = useQuery({ queryKey: ["condo-admins", condoId], queryFn: () => api.condos.admins(condoId) });
  const base = `/plataforma/condominios/${condoId}`;

  if (isError) {
    return (
      <PageContainer>
        <EmptyState icon={Settings2} title="Condomínio não encontrado" action={<Button asChild variant="outline"><Link to="/plataforma/condominios">Voltar</Link></Button>} />
      </PageContainer>
    );
  }
  const c = data?.condo;
  if (!c) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      </PageContainer>
    );
  }

  const displayName = c.branding.display_name || c.name;
  const location = [c.address, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const customized = Boolean(c.branding.display_name || c.branding.primary_color || c.branding.logo_url);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Plataforma", "Detalhes do condomínio"]}
        title={displayName}
        description={c.description || `Resumo de ${displayName}, com acesso às áreas próprias do condomínio.`}
        actions={
          <Button asChild size="lg">
            <Link to={`${base}/editar`}>
              <Settings2 /> Editar condomínio
            </Link>
          </Button>
        }
      />

      <SectionCard>
        <div className="flex items-center gap-4 rounded-3xl border border-border bg-surface-warm/60 p-4">
          <CondoBadge name={displayName} logoUrl={c.branding.logo_url} color={c.branding.primary_color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{displayName}</p>
            <p className="text-sm text-muted-foreground">{location || "Endereço não informado"}</p>
          </div>
          <StatusPill status={c.status === "active" ? "active" : "inactive"} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Moradores" icon={Users} value={c.resident_count} hint={c.pending_count ? `+${c.pending_count} pendentes` : "vínculos aprovados"} />
          <MetricCard label="Documentos" icon={FileText} value={c.doc_count} hint={`${c.agent.documents_available} disponíveis ao agente`} />
          <MetricCard label="Agente" icon={Bot} value={AGENT_LABEL[c.agent.status]} hint={c.agent.enabled ? "liberado aos moradores" : "não liberado"} hintTone={c.agent.status === "available" ? "success" : undefined} />
          <MetricCard label="Conversas" icon={MessageCircle} value={c.conversations_30d} hint="nos últimos 30 dias" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <ActivityFeed condoId={c.id} title="Atividade recente" description={`Somente eventos de ${displayName}.`} />

        <div className="space-y-6">
          <SectionCard title="Próximos passos">
            <ul className="space-y-1">
              <Step done={c.admin_count > 0} to={`${base}`}>Indicar o síndico (administrador)</Step>
              <Step done={c.doc_count > 0} to={`${base}/documentos`}>Enviar os documentos oficiais</Step>
              <Step done={c.agent.documents_available > 0} to={`${base}/agente/fontes`}>Ter documentos processados</Step>
              <Step done={c.agent.enabled} to={`${base}/agente`}>Liberar o assistente aos moradores</Step>
              <Step done={customized} to={`${base}/personalizacao`}>Personalizar nome, cores e logotipo</Step>
            </ul>
          </SectionCard>

          <SectionCard
            title="Administradores"
            aside={admins.data && <CountBadge>{admins.data.admins.length}</CountBadge>}
          >
            {admins.isLoading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" />
            ) : admins.data?.admins.length ? (
              <ul className="divide-y divide-border">
                {admins.data.admins.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <PersonAvatar name={a.full_name || a.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.full_name || a.email}</p>
                      <p className="truncate text-sm text-muted-foreground">{a.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <InlineNotice tone="warning">Nenhum administrador ainda: ninguém aprova os moradores deste condomínio.</InlineNotice>
            )}
            <Button variant="outline" className="mt-4 w-full" onClick={() => setAddingAdmin(true)}>
              <UserPlus /> Adicionar administrador
            </Button>
          </SectionCard>

          <SectionCard title="Cadastro">
            <dl className="space-y-3 text-sm">
              {[
                ["Nome de cadastro", c.name],
                ["Identificador", c.identifier],
                ["CNPJ", c.cnpj],
                ["Responsável", c.contact_name],
                ["E-mail", c.contact_email],
                ["Telefone", c.contact_phone],
                ["Criado em", shortDate.format(new Date(c.created_at))],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-semibold [overflow-wrap:anywhere]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </div>
      </div>

      <AddAdminDialog condoId={c.id} condoName={displayName} open={addingAdmin} onOpenChange={setAddingAdmin} />
    </PageContainer>
  );
};

export default CondoDetailPage;
