import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import SectionCard from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import InlineNotice from "@/components/app/InlineNotice";
import EmptyState from "@/components/app/EmptyState";
import FullScreenLoader from "@/components/app/FullScreenLoader";
import { CondoCard, OnboardingShell, StateHero } from "@/components/onboarding/Onboarding";
import { homePathFor } from "@/components/layout/nav";

const LinkConfirmPage = () => {
  const { condoId = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [unit, setUnit] = useState("");
  const [block, setBlock] = useState("");
  const [invite, setInvite] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const canRequest = Boolean(profile && profile.role === "resident" && (!profile.condo_id || profile.membership_status === "rejected"));
  const condo = useQuery({ queryKey: ["condo-summary", condoId], queryFn: () => api.condos.summary(condoId), enabled: canRequest, retry: false });
  const membership = useQuery({ queryKey: ["membership"], queryFn: () => api.membership.get(), enabled: canRequest });
  const needsTerms = membership.data ? !membership.data.membership.terms_accepted : false;

  const submit = useMutation({
    mutationFn: () =>
      api.membership.request({
        condo_id: condoId,
        unit: unit.trim(),
        block: block.trim() || undefined,
        invite_code: invite.trim() || undefined,
        accept_terms: needsTerms ? acceptTerms : undefined,
      }),
    onSuccess: async () => {
      await refreshProfile();
      navigate("/vinculo/status", { replace: true });
    },
  });

  if (loading || (user && !profile)) return <FullScreenLoader />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (!canRequest) return <Navigate to={homePathFor(profile)} replace />;

  return (
    <OnboardingShell>
      <p className="eyebrow">Entrada e acesso · Solicitar vínculo</p>
      <SectionCard>
        {condo.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : condo.isError || !condo.data ? (
          <EmptyState
            icon={Building2}
            title="Condomínio não encontrado"
            description="Ele pode ter sido desativado. Volte à busca e tente novamente."
            action={
              <Button asChild variant="outline">
                <Link to="/vinculo">Voltar à busca</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <StateHero icon={Building2} pill="Vínculo não aprovado" tone="warning" title={`Solicitar acesso ao ${condo.data.condo.name}?`}>
              Informe sua unidade para solicitar o vínculo. A solicitação não libera o assistente nem os documentos até a
              aprovação da administração.
            </StateHero>

            <CondoCard label="Condomínio selecionado" condo={condo.data.condo} />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Unidade / apartamento" htmlFor="unit">
                  <Input id="unit" placeholder="Ex.: 304" value={unit} onChange={(e) => setUnit(e.target.value)} required maxLength={40} />
                </FormField>
                <FormField label="Bloco / torre" htmlFor="block" hint="Opcional">
                  <Input id="block" placeholder="Ex.: A" value={block} onChange={(e) => setBlock(e.target.value)} maxLength={40} />
                </FormField>
              </div>
              <FormField label="Código de convite" htmlFor="invite" hint="Opcional. Informe se a administração enviou um código.">
                <Input id="invite" value={invite} onChange={(e) => setInvite(e.target.value)} maxLength={40} />
              </FormField>

              {needsTerms && (
                <label htmlFor="terms" className="flex items-start gap-3 text-sm">
                  <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" />
                  <span>Li e aceito os termos de uso e a política de privacidade do Condo App.</span>
                </label>
              )}

              {submit.isError && <InlineNotice tone="danger">{errorMessage(submit.error, "Não foi possível enviar a solicitação.")}</InlineNotice>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                <Button asChild variant="outline" size="lg">
                  <Link to="/vinculo">Voltar à busca</Link>
                </Button>
                <Button type="submit" size="lg" disabled={submit.isPending || !unit.trim() || (needsTerms && !acceptTerms)}>
                  {submit.isPending && <Loader2 className="animate-spin" />}
                  Enviar solicitação
                </Button>
              </div>
            </form>
          </div>
        )}
      </SectionCard>
    </OnboardingShell>
  );
};

export default LinkConfirmPage;
