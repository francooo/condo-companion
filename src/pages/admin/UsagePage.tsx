import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, Clock, FileText, FlaskConical, Loader2, MessageCircle, Users } from "lucide-react";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import MetricCard from "@/components/app/MetricCard";
import FilterChips from "@/components/app/FilterChips";
import FilterMenu from "@/components/app/FilterMenu";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import { PageContainer } from "@/components/layout/AppShell";

type Period = "7" | "30" | "90";
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");
const seconds = (s: number | null) => (s == null ? "—" : `${s.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);

/**
 * Uso do assistente. Mostra números e perguntas sem resposta, sem identificar quem perguntou:
 * o histórico de conversas de cada morador é privado.
 */
const UsagePage = () => {
  const { profile } = useAuth();
  const isPlatform = profile?.role === "superadmin";
  const [period, setPeriod] = useState<Period>("30");
  const [condo, setCondo] = useState("all");
  const condos = useQuery({ queryKey: ["condos"], queryFn: () => api.condos.list(), enabled: isPlatform });
  const condoId = isPlatform && condo !== "all" ? condo : undefined;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["usage", period, condoId ?? "all"],
    queryFn: () => api.insights.usage(Number(period), condoId),
  });
  const t = data?.totals;
  const answersTotal = t ? t.answered + t.not_found + t.out_of_scope + t.errors : 0;
  const busiest = data?.daily.reduce<{ day: string; questions: number } | null>((best, d) => (!best || d.questions > best.questions ? d : best), null);
  const scopeName = isPlatform ? (condoId ? condos.data?.condos.find((c) => c.id === condoId)?.name ?? "condomínio" : "todos os condomínios") : profile?.condo_name ?? "condomínio";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[isPlatform ? "Plataforma" : "Administração", "Histórico e indicadores"]}
        title="Uso do assistente"
        description="Como os moradores usam o assistente e o que ele não soube responder. As conversas de cada morador continuam privadas."
        actions={
          !isPlatform && (
            <Button asChild size="lg" variant="outline">
              <Link to="/admin/agente/teste">
                <FlaskConical /> Testar o agente
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-2">
        {isPlatform && (
          <FilterMenu
            label="Condomínio"
            value={condo}
            onChange={setCondo}
            neutralValue="all"
            options={[{ value: "all", label: "Todos os condomínios" }, ...(condos.data?.condos ?? []).map((c) => ({ value: c.id, label: c.display_name || c.name }))]}
          />
        )}
        <FilterChips<Period>
          aria-label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "Últimos 7 dias" },
            { value: "30", label: "30 dias" },
            { value: "90", label: "90 dias" },
          ]}
        />
      </div>

      {isError ? (
        <InlineNotice tone="danger">Não foi possível carregar os indicadores.</InlineNotice>
      ) : isLoading || !t ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard label="Conversas" icon={MessageCircle} value={t.conversations.toLocaleString("pt-BR")} hint={`${t.questions.toLocaleString("pt-BR")} perguntas no período`} />
            <MetricCard label="Moradores que usaram" icon={Users} value={t.people.toLocaleString("pt-BR")} hint={scopeName} />
            <MetricCard label="Respostas com fontes" icon={FileText} value={pct(t.with_sources, answersTotal)} hint="citando arquivo e página" hintTone="success" />
            <MetricCard label="Tempo médio" icon={Clock} value={seconds(t.avg_response_seconds)} hint="da pergunta à resposta" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <SectionCard
              title="Perguntas sem resposta"
              description="O assistente não encontrou a informação nos documentos. Use-as para saber o que falta na biblioteca."
              aside={<CountBadge>{data.unanswered.length}</CountBadge>}
            >
              {data.unanswered.length === 0 ? (
                <EmptyState icon={CircleHelp} title="Nenhuma no período" description="Todas as perguntas sobre o condomínio encontraram resposta nos documentos." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.unanswered.map((u, i) => (
                    <li key={`${u.created_at}-${i}`} className="py-3">
                      <p className="font-semibold [overflow-wrap:anywhere]">“{u.question}”</p>
                      <p className="text-sm text-muted-foreground">{[isPlatform && !condoId ? u.condo_name : null, relativeTime(u.created_at)].filter(Boolean).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Resultado das respostas" description={`${answersTotal.toLocaleString("pt-BR")} respostas no período.`}>
              <dl className="divide-y divide-border">
                {[
                  ["Respondidas", t.answered],
                  ["Não encontradas nos documentos", t.not_found],
                  ["Fora do escopo do condomínio", t.out_of_scope],
                  ["Erro temporário", t.errors],
                ].map(([label, n]) => (
                  <div key={label as string} className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm">{label}</dt>
                    <dd className="text-right">
                      <span className="font-bold">{(n as number).toLocaleString("pt-BR")}</span>{" "}
                      <span className="text-sm text-muted-foreground">({pct(n as number, answersTotal)})</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {busiest && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Dia de maior uso: {new Date(`${busiest.day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ({busiest.questions}{" "}
                  {busiest.questions === 1 ? "pergunta" : "perguntas"}).
                </p>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default UsagePage;
