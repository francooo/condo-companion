import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Inbox, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { api, type AccessRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import StatusPill from "@/components/app/StatusPill";
import EmptyState from "@/components/app/EmptyState";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import InlineNotice from "@/components/app/InlineNotice";
import FormField from "@/components/app/FormField";
import { condoInitials } from "@/components/app/CondoBadge";
import { PageContainer } from "@/components/layout/AppShell";

type Status = AccessRequest["status"];
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="font-semibold">{value || "—"}</dd>
  </div>
);

const RequestCard = ({
  r,
  showCondo,
  onApprove,
  onReject,
  busy,
}: {
  r: AccessRequest;
  showCondo: boolean;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) => (
  <li className="space-y-4 py-5">
    <div className="flex items-start gap-4">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold">
        {condoInitials(r.full_name || r.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{r.full_name || "Sem nome"}</p>
        <p className="break-all text-sm text-muted-foreground">{r.email}</p>
        <p className="text-xs text-muted-foreground">
          {r.status === "pending" ? `Enviada ${relativeTime(r.requested_at)}` : `Analisada ${relativeTime(r.decided_at ?? r.requested_at)}`}
        </p>
      </div>
      <StatusPill status={r.status} />
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-4">
      {showCondo && <Detail label="Condomínio" value={r.condo_name} />}
      <Detail label="Unidade" value={[r.unit, r.block && `Bloco ${r.block}`].filter(Boolean).join(" · ")} />
      <Detail label="Data do pedido" value={dateFmt.format(new Date(r.requested_at))} />
      <Detail label="Celular" value={r.phone} />
      {r.invite_code && <Detail label="Convite" value={r.invite_code} />}
    </dl>
    {r.status === "rejected" && r.decision_reason && (
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">Motivo:</strong> {r.decision_reason}
      </p>
    )}
    {r.status === "pending" && (
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApprove} disabled={busy}>
          <Check /> Aprovar
        </Button>
        <Button variant="destructive-outline" onClick={onReject} disabled={busy}>
          <X /> Recusar
        </Button>
      </div>
    )}
  </li>
);

const AccessRequestsPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isPlatform = profile?.role === "superadmin";
  const [status, setStatus] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<AccessRequest | null>(null);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError } = useQuery({ queryKey: ["access-requests", status], queryFn: () => api.accessRequests.list(status) });
  const requests = useMemo(() => data?.requests ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? requests.filter((r) => [r.full_name, r.email, r.unit, r.condo_name].some((v) => v?.toLowerCase().includes(q)))
      : requests;
  }, [requests, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["access-requests"] });
    queryClient.invalidateQueries({ queryKey: ["residents"] });
    queryClient.invalidateQueries({ queryKey: ["condos"] });
  };

  const approve = useMutation({
    mutationFn: (r: AccessRequest) => api.accessRequests.approve(r.id),
    onSuccess: (_d, r) => {
      toast.success(`Acesso de ${r.full_name || r.email} aprovado.`);
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível aprovar.")),
  });
  const reject = useMutation({
    mutationFn: ({ r, reason }: { r: AccessRequest; reason: string }) => api.accessRequests.reject(r.id, reason || undefined),
    onSuccess: (_d, { r }) => {
      toast.success(`Solicitação de ${r.full_name || r.email} recusada.`);
      setReason("");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível recusar.")),
  });

  const scopeName = isPlatform ? "todos os condomínios" : profile?.condo_name ?? "condomínio";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[isPlatform ? "Plataforma" : "Administração", "Solicitações de acesso"]}
        title={status === "pending" ? "Aguardando análise" : status === "approved" ? "Solicitações aprovadas" : "Solicitações recusadas"}
        description="Moradores que pediram vínculo. O acesso ao assistente só é liberado após a aprovação."
      />

      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar solicitante" aria-label="Buscar solicitante" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
      </div>

      <FilterChips<Status>
        aria-label="Filtrar solicitações"
        value={status}
        onChange={setStatus}
        options={[
          { value: "pending", label: "Pendentes" },
          { value: "approved", label: "Aprovadas" },
          { value: "rejected", label: "Recusadas" },
        ]}
      />

      <SectionCard
        title={`Solicitações · ${isPlatform ? "Plataforma" : scopeName}`}
        description={isPlatform ? "Pedidos de todos os condomínios." : "Aprovação vinculada somente a este condomínio."}
        aside={data && <CountBadge>{filtered.length}</CountBadge>}
      >
        {isError ? (
          <InlineNotice tone="danger">Não foi possível carregar as solicitações.</InlineNotice>
        ) : isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={status === "pending" ? "Nenhuma solicitação pendente" : "Nada por aqui"}
            description={status === "pending" ? "Novos pedidos de vínculo aparecem aqui para análise." : "Ajuste o filtro ou a busca."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                showCondo={isPlatform}
                busy={approve.isPending || reject.isPending}
                onApprove={() => setApproving(r)}
                onReject={() => setRejecting(r)}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <InlineNotice tone="warning">
        Aprove apenas quem você conseguiu confirmar como morador da unidade informada. A pessoa passa a ver os documentos e o
        assistente do condomínio.
      </InlineNotice>

      <ConfirmDialog
        open={Boolean(approving)}
        onOpenChange={(o) => !o && setApproving(null)}
        title="Aprovar acesso?"
        description={
          approving &&
          `${approving.full_name || approving.email} terá acesso ao assistente e aos documentos do ${approving.condo_name}` +
            (approving.unit ? ` como morador da unidade ${approving.unit}${approving.block ? `, bloco ${approving.block}` : ""}.` : ".")
        }
        confirmLabel="Aprovar acesso"
        onConfirm={() => approving && approve.mutate(approving)}
      />

      <ConfirmDialog
        open={Boolean(rejecting)}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setReason("");
          }
        }}
        title="Recusar solicitação?"
        description="O morador verá que a solicitação precisa de atenção e poderá enviar uma nova."
        confirmLabel="Recusar"
        destructive
        onConfirm={() => rejecting && reject.mutate({ r: rejecting, reason: reason.trim() })}
      >
        <FormField label="Motivo (opcional)" htmlFor="reject-reason" hint="Mostrado ao morador. Ex.: unidade não confere com o cadastro.">
          <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </FormField>
      </ConfirmDialog>
    </PageContainer>
  );
};

export default AccessRequestsPage;
