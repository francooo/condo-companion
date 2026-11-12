import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Loader2, Lock, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type Membership } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/app/SectionCard";
import InlineNotice from "@/components/app/InlineNotice";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import FullScreenLoader from "@/components/app/FullScreenLoader";
import { CondoCard, OnboardingShell, StateHero, Stepper } from "@/components/onboarding/Onboarding";
import { homePathFor } from "@/components/layout/nav";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const unitLabel = (m: Membership) => [m.unit && `Unidade ${m.unit}`, m.block && `Bloco ${m.block}`].filter(Boolean).join(" · ");

const MembershipStatusPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isResident = profile?.role === "resident";
  const query = useQuery({
    queryKey: ["membership"],
    queryFn: () => api.membership.get(),
    enabled: Boolean(isResident),
    // Enquanto aguarda a decisão, confere de novo a cada 30 s.
    refetchInterval: (q) => (q.state.data?.membership.status === "pending" ? 30_000 : false),
  });

  const refresh = async () => {
    await query.refetch();
    await refreshProfile();
  };

  const cancel = useMutation({
    mutationFn: () => api.membership.cancel(),
    onSuccess: async () => {
      await refreshProfile();
      navigate("/vinculo", { replace: true });
    },
  });

  if (loading || (user && !profile)) return <FullScreenLoader />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (!isResident) return <Navigate to={homePathFor(profile)} replace />;
  if (!profile.condo_id) return <Navigate to="/vinculo" replace />;

  const m = query.data?.membership;

  return (
    <OnboardingShell>
      <p className="eyebrow">Entrada e acesso · Situação do vínculo</p>
      <SectionCard>
        {query.isLoading || !m ? (
          query.isError ? (
            <InlineNotice tone="danger">Não foi possível carregar a situação do vínculo. Tente atualizar.</InlineNotice>
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )
        ) : (
          <div className="space-y-8">
            {m.status === "pending" && (
              <>
                <Stepper states={["done", "current", "todo"]} />
                <StateHero icon={Clock} pill="Aguardando aprovação" tone="warning" title="Estamos confirmando seu vínculo">
                  Sua solicitação para o {m.condo?.name} foi enviada
                  {m.requested_at ? ` em ${dateTimeFmt.format(new Date(m.requested_at))}` : ""}. A administração do condomínio
                  precisa confirmar seu vínculo.
                </StateHero>
                {m.condo && <CondoCard label="Condomínio relacionado" condo={m.condo} note={unitLabel(m) || undefined} />}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button size="lg" onClick={refresh} disabled={query.isFetching}>
                    <RefreshCw className={query.isFetching ? "animate-spin" : undefined} /> Atualizar status
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setConfirmCancel(true)}>
                    Cancelar solicitação
                  </Button>
                </div>
              </>
            )}

            {m.status === "approved" && (
              <>
                <Stepper states={["done", "done", "done"]} />
                <StateHero icon={CheckCircle2} pill="Acesso aprovado" tone="success" title="Seu acesso foi liberado">
                  Você já pode usar o assistente e consultar as informações do {m.condo?.name}.
                </StateHero>
                {m.condo && <CondoCard label="Condomínio vinculado" condo={m.condo} note={unitLabel(m) || undefined} />}
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={async () => {
                      await refreshProfile();
                      navigate("/chat", { replace: true });
                    }}
                  >
                    Acessar meu assistente <ArrowRight />
                  </Button>
                </div>
              </>
            )}

            {m.status === "rejected" && (
              <>
                <Stepper states={["done", "error", "todo"]} />
                <StateHero icon={AlertTriangle} pill="Pendente de correção" tone="danger" title="Sua solicitação precisa de atenção">
                  Não foi possível confirmar os dados informados. Revise as informações e envie uma nova solicitação, ou fale com a
                  administração do condomínio.
                </StateHero>
                {m.decision_reason && (
                  <InlineNotice tone="warning">
                    <strong>Motivo informado:</strong> {m.decision_reason}
                  </InlineNotice>
                )}
                {m.condo && <CondoCard label="Condomínio relacionado" condo={m.condo} note={unitLabel(m) || undefined} />}
                <div className="flex justify-center">
                  <Button asChild size="lg" variant="outline">
                    <Link to="/vinculo">
                      Verificar vínculo novamente <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </>
            )}

            {m.status === "suspended" && (
              <>
                <Stepper states={["done", "done", "error"]} />
                <StateHero icon={Lock} pill="Acesso suspenso" tone="neutral" title="Seu acesso está suspenso">
                  A administração do {m.condo?.name} suspendeu temporariamente o seu acesso. Entre em contato com a administração para
                  regularizar.
                </StateHero>
                {m.decision_reason && (
                  <p className="rounded-2xl bg-muted/60 p-4 text-sm">
                    <strong>Motivo informado:</strong> {m.decision_reason}
                  </p>
                )}
                {m.condo && <CondoCard label="Condomínio relacionado" condo={m.condo} />}
                <div className="flex justify-center">
                  <Button size="lg" variant="outline" onClick={refresh} disabled={query.isFetching}>
                    <RefreshCw className={query.isFetching ? "animate-spin" : undefined} /> Atualizar status
                  </Button>
                </div>
              </>
            )}

            {cancel.isError && <InlineNotice tone="danger">{errorMessage(cancel.error, "Não foi possível cancelar.")}</InlineNotice>}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar solicitação?"
        description="Você poderá buscar e solicitar acesso a um condomínio novamente."
        confirmLabel="Cancelar solicitação"
        cancelLabel="Manter"
        destructive
        onConfirm={() => cancel.mutate()}
      />
    </OnboardingShell>
  );
};

export default MembershipStatusPage;
