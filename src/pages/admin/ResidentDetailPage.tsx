import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileText, Loader2, PauseCircle, PlayCircle, UserMinus, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { api, type ResidentDetail } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { describeEvent, residentStatus, roleLabel, unitLabel } from "@/lib/residents";
import { shortDate } from "@/lib/documents";
import { useAuth } from "@/contexts/AuthContext";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import StatusPill from "@/components/app/StatusPill";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import EmptyState from "@/components/app/EmptyState";
import FormField from "@/components/app/FormField";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import PersonAvatar from "@/components/app/PersonAvatar";
import { PageContainer } from "@/components/layout/AppShell";

type Action = "approve" | "reject" | "suspend" | "reactivate" | "remove";

const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="font-semibold sm:text-right">{children}</dd>
  </div>
);

const ACTIONS: Record<Action, { title: string; confirm: string; destructive?: boolean; reasonLabel?: string; success: string }> = {
  approve: { title: "Aprovar acesso?", confirm: "Aprovar acesso", success: "Vínculo aprovado." },
  reject: {
    title: "Recusar solicitação?",
    confirm: "Recusar",
    destructive: true,
    reasonLabel: "Motivo (opcional, mostrado ao morador)",
    success: "Solicitação recusada.",
  },
  suspend: {
    title: "Suspender acesso?",
    confirm: "Suspender acesso",
    destructive: true,
    reasonLabel: "Motivo (opcional, mostrado ao morador)",
    success: "Acesso suspenso.",
  },
  reactivate: { title: "Reativar acesso?", confirm: "Reativar acesso", success: "Acesso reativado." },
  remove: {
    title: "Remover do condomínio?",
    confirm: "Remover do condomínio",
    destructive: true,
    reasonLabel: "Motivo (opcional, fica no histórico)",
    success: "Morador removido do condomínio.",
  },
};

function actionDescription(action: Action, r: ResidentDetail) {
  const name = r.full_name || r.email;
  switch (action) {
    case "approve":
      return `${name} terá acesso ao assistente e aos documentos do ${r.condo_name}${r.unit ? ` como morador da ${unitLabel(r).toLowerCase()}` : ""}.`;
    case "reject":
      return `${name} verá que a solicitação precisa de atenção e poderá enviar uma nova.`;
    case "suspend":
      return `${name} perde o acesso ao assistente e aos documentos até ser reativado. A conta e o histórico são mantidos.`;
    case "reactivate":
      return `${name} volta a ter acesso ao assistente e aos documentos do ${r.condo_name}.`;
    case "remove":
      return `${name} deixa de ser morador do ${r.condo_name} e poderá solicitar vínculo com outro condomínio. A conta continua existindo.`;
  }
}

const ResidentDetailPage = () => {
  const { residentId = "" } = useParams();
  const { profile } = useAuth();
  const scope = useCondoScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [justApproved, setJustApproved] = useState(false);

  const listPath = `${scope.basePath}/moradores`;
  const requestsPath = scope.isPlatform ? "/plataforma/solicitacoes" : "/admin/solicitacoes";
  const queryKey = ["resident", residentId];
  const { data, isLoading, isError } = useQuery({ queryKey, queryFn: () => api.residents.get(residentId), retry: false });
  const r = data?.resident;

  const act = useMutation({
    mutationFn: async ({ action, reason }: { action: Action; reason?: string }) => {
      switch (action) {
        case "approve":
          return api.accessRequests.approve(residentId);
        case "reject":
          return api.accessRequests.reject(residentId, reason);
        case "suspend":
          return api.residents.suspend(residentId, reason);
        case "reactivate":
          return api.residents.reactivate(residentId);
        case "remove":
          return api.residents.remove(residentId, reason);
      }
    },
    onSuccess: (_d, { action }) => {
      toast.success(ACTIONS[action].success);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      if (action === "remove" || action === "reject") {
        queryClient.removeQueries({ queryKey });
        navigate(action === "reject" ? requestsPath : listPath, { replace: true });
        return;
      }
      if (action === "approve") setJustApproved(true);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível concluir a ação.")),
  });

  if (isError || (!isLoading && !r)) {
    return (
      <PageContainer>
        <EmptyState
          icon={UserX}
          title="Morador não encontrado"
          description="A pessoa pode ter sido removida do condomínio ou ter cancelado a solicitação."
          action={
            <Button asChild variant="outline">
              <Link to={listPath}>
                <ArrowLeft /> Voltar aos moradores
              </Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }
  if (!r) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      </PageContainer>
    );
  }

  const status = residentStatus(r);
  const isSelf = r.id === profile?.id;
  const manageable = r.role === "resident" && !isSelf;
  const name = r.full_name || r.email;
  const busy = act.isPending;
  const accessLine =
    r.membership_status === "approved" && r.active
      ? { label: "Liberado", tone: "success" as const, text: "Acesso ao assistente e aos documentos do condomínio." }
      : r.membership_status === "pending"
        ? { label: "Restrito", tone: "neutral" as const, text: "Aguardando confirmação do vínculo." }
        : { label: "Bloqueado", tone: "danger" as const, text: "Sem acesso ao assistente e aos documentos." };

  return (
    <PageContainer>
      <Link to={r.membership_status === "pending" ? requestsPath : listPath} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {r.membership_status === "pending" ? "Solicitações" : "Moradores"}
      </Link>
      <PageHeader eyebrow={[scope.areaLabel, "Detalhes do morador"]} title={<span className="[overflow-wrap:anywhere]">{name}</span>} description="Dados básicos, vínculo e histórico administrativo." />

      {justApproved && r.membership_status === "approved" && (
        <SectionCard>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <IconTile icon={Check} size="lg" />
            <StatusPill tone="success">Aprovado</StatusPill>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Vínculo aprovado</h2>
            <p className="max-w-md text-muted-foreground">
              {name} já pode usar o assistente e consultar os documentos do {r.condo_name}. Na próxima vez que abrir o app, o
              acesso estará liberado.
            </p>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" asChild>
                <Link to={requestsPath}>Voltar às solicitações</Link>
              </Button>
              <Button onClick={() => setJustApproved(false)}>Ver estado do morador</Button>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-6">
          <SectionCard title="Dados do morador">
            <div className="mb-4 flex items-center gap-4 rounded-3xl border border-border bg-surface-warm/60 p-5">
              <PersonAvatar name={name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold">{name}</p>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <dl className="divide-y divide-border">
              <Info label="Condomínio">{r.condo_name}</Info>
              <Info label="Unidade">{unitLabel(r) || "—"}</Info>
              <Info label="Perfil">{roleLabel(r.role)}</Info>
              <Info label="Status do vínculo">
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </Info>
              {r.membership_status === "pending" ? (
                <Info label="Solicitação recebida">{shortDate.format(new Date(r.requested_at ?? r.created_at))}</Info>
              ) : (
                <Info label="Morador desde">{shortDate.format(new Date(r.member_since))}</Info>
              )}
              {r.decided_by_name && r.membership_status !== "pending" && <Info label="Última decisão por">{r.decided_by_name}</Info>}
            </dl>
          </SectionCard>

          <SectionCard title="Ações administrativas">
            {!manageable ? (
              <InlineNotice tone="info">
                {isSelf ? "Este é o seu próprio vínculo." : "Administradores do condomínio são geridos pela administração da plataforma."}
              </InlineNotice>
            ) : (
              <div className="space-y-4">
                {r.membership_status === "suspended" && (
                  <InlineNotice tone="danger">
                    Acesso suspenso{r.decided_at ? ` em ${shortDate.format(new Date(r.decided_at))}` : ""}.
                    {r.decision_reason && ` Motivo: ${r.decision_reason}`}
                  </InlineNotice>
                )}
                {!r.active && (
                  <InlineNotice tone="warning">A conta desta pessoa está desativada na plataforma; ela não consegue entrar no app.</InlineNotice>
                )}
                <div className="flex flex-wrap gap-2">
                  {r.membership_status === "pending" && (
                    <>
                      <Button onClick={() => setPending("approve")} disabled={busy}>
                        <Check /> Aprovar
                      </Button>
                      <Button variant="destructive-outline" onClick={() => setPending("reject")} disabled={busy}>
                        <X /> Recusar
                      </Button>
                    </>
                  )}
                  {r.membership_status === "approved" && (
                    <Button variant="destructive-outline" onClick={() => setPending("suspend")} disabled={busy}>
                      <PauseCircle /> Suspender acesso
                    </Button>
                  )}
                  {r.membership_status === "suspended" && (
                    <Button onClick={() => setPending("reactivate")} disabled={busy}>
                      <PlayCircle /> Reativar acesso
                    </Button>
                  )}
                  {(r.membership_status === "approved" || r.membership_status === "suspended") && (
                    <Button variant="outline" onClick={() => setPending("remove")} disabled={busy}>
                      <UserMinus /> Remover do condomínio
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Suspender bloqueia o acesso temporariamente. Remover desfaz o vínculo (por exemplo, quando o morador se muda).
                </p>
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Histórico do vínculo">
          <ul className="divide-y divide-border">
            <li className="flex items-start gap-4 py-4">
              <IconTile icon={FileText} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Acesso a documentos e assistente</p>
                <p className="text-sm text-muted-foreground">{accessLine.text}</p>
              </div>
              <StatusPill tone={accessLine.tone}>{accessLine.label}</StatusPill>
            </li>
            {data.events.map((e) => {
              const d = describeEvent(e);
              return (
                <li key={e.id} className="flex items-start gap-4 py-4">
                  <IconTile icon={d.icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{d.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[shortDate.format(new Date(e.created_at)), d.who, d.unit].filter(Boolean).join(" · ")}
                    </p>
                    {d.reason && <p className="mt-1 text-sm">Motivo: {d.reason}</p>}
                  </div>
                  <StatusPill tone={d.tone} className="hidden sm:inline-flex">
                    {d.pill}
                  </StatusPill>
                </li>
              );
            })}
            {data.events.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">Vínculo anterior ao registro de histórico. Novas ações aparecem aqui.</li>
            )}
          </ul>
        </SectionCard>
      </div>

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setPending(null);
              setReason("");
            }
          }}
          title={ACTIONS[pending].title}
          description={actionDescription(pending, r)}
          confirmLabel={ACTIONS[pending].confirm}
          destructive={ACTIONS[pending].destructive}
          onConfirm={() => act.mutate({ action: pending, reason: reason.trim() || undefined })}
        >
          {ACTIONS[pending].reasonLabel && (
            <FormField label={ACTIONS[pending].reasonLabel!} htmlFor="action-reason">
              <Textarea id="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </FormField>
          )}
        </ConfirmDialog>
      )}
    </PageContainer>
  );
};

export default ResidentDetailPage;
