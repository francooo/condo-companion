import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Loader2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import CondoBadge from "@/components/app/CondoBadge";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import FullScreenLoader from "@/components/app/FullScreenLoader";
import { OnboardingShell, formatAddress } from "@/components/onboarding/Onboarding";
import { homePathFor } from "@/components/layout/nav";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const RULES = [
  "Selecionar um condomínio não concede acesso automático.",
  "A administração confirma o vínculo com uma unidade específica.",
  "O acesso ao assistente só aparece após a aprovação.",
];

const FindCondoPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const debounced = useDebouncedValue(q.trim());

  const canSearch = Boolean(profile && profile.role === "resident" && (!profile.condo_id || profile.membership_status === "rejected"));
  const search = useQuery({
    queryKey: ["condo-search", debounced],
    queryFn: () => api.condos.search(debounced),
    enabled: canSearch,
    placeholderData: (prev) => prev,
  });

  const condos = useMemo(() => search.data?.condos ?? [], [search.data]);
  const cities = useMemo(() => [...new Set(condos.map((c) => c.city).filter(Boolean) as string[])].sort(), [condos]);
  const visible = city === "all" ? condos : condos.filter((c) => c.city === city);

  if (loading || (user && !profile)) return <FullScreenLoader />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (!canSearch) return <Navigate to={homePathFor(profile)} replace />;

  return (
    <OnboardingShell>
      <PageHeader
        eyebrow={["Entrada e acesso", "Buscar condomínio"]}
        title="Encontre seu condomínio"
        description="Busque pelo nome, endereço ou cidade. O vínculo precisa ser aprovado pela administração."
      />

      {profile.membership_status === "rejected" && (
        <InlineNotice tone="warning">Sua solicitação anterior não foi aprovada. Você pode enviar uma nova solicitação.</InlineNotice>
      )}

      <SectionCard title="Buscar condomínio">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome, endereço ou cidade"
              aria-label="Buscar condomínio"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCity("all");
              }}
              className="pl-11"
              autoFocus
            />
            {search.isFetching && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          {cities.length > 1 && (
            <FilterChips
              aria-label="Filtrar por cidade"
              value={city}
              onChange={setCity}
              options={[{ value: "all", label: "Todos" }, ...cities.map((c) => ({ value: c, label: c }))]}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Condomínios encontrados"
        aside={search.data && <CountBadge>{visible.length} {visible.length === 1 ? "opção" : "opções"}</CountBadge>}
      >
        {search.isError ? (
          <InlineNotice tone="danger">Não foi possível buscar agora. Tente novamente em instantes.</InlineNotice>
        ) : search.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum condomínio encontrado"
            description="Confira a grafia ou busque pelo endereço. Se o seu condomínio não aparecer, fale com a administração."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <CondoBadge name={c.name} />
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    {formatAddress(c) && <p className="text-sm text-muted-foreground">{formatAddress(c)}</p>}
                  </div>
                </div>
                <Button variant="outline" onClick={() => navigate(`/vinculo/${c.id}`)} className="sm:shrink-0">
                  Solicitar acesso
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Antes de acessar" description="Cada condomínio tem documentos e conversas independentes.">
        <ul className="space-y-3">
          {RULES.map((r) => (
            <li key={r} className="flex gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="h-4 w-4" />
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </OnboardingShell>
  );
};

export default FindCondoPage;
