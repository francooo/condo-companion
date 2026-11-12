import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, FileText, FolderOpen, Loader2 } from "lucide-react";
import { api, type CondoDocument } from "@/lib/api";
import { kindLabel } from "@/lib/documents";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import ListRow, { ListRows } from "@/components/app/ListRow";
import IconTile from "@/components/app/IconTile";
import StatusPill, { type StatusTone } from "@/components/app/StatusPill";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import { PageContainer } from "@/components/layout/AppShell";

/** Situação do documento do ponto de vista do agente. */
function agentAvailability(d: CondoDocument): { label: string; tone: StatusTone; meta: string; order: number } {
  if (d.status === "processed" && d.active) return { label: "Ativo", tone: "success", meta: "Processado", order: 0 };
  if (d.status === "processed") return { label: "Desativado", tone: "neutral", meta: "Retirado pela administração", order: 3 };
  if (d.status === "uploaded" || d.status === "processing") return { label: "Em processamento", tone: "warning", meta: "Processando", order: 1 };
  return { label: "Indisponível", tone: "danger", meta: d.status === "failed" ? "Falha no processamento" : "Revisão solicitada", order: 2 };
}

const AgentSourcesPage = () => {
  const scope = useCondoScope();
  const agentPath = `${scope.basePath}/agente`;
  const docsPath = `${scope.basePath}/documentos`;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["documents", scope.condoId],
    queryFn: () => api.documents.list(scope.apiCondoId),
    enabled: Boolean(scope.condoId),
  });
  const docs = [...(data?.documents ?? [])].sort(
    (a, b) => agentAvailability(a).order - agentAvailability(b).order || a.filename.localeCompare(b.filename, "pt-BR"),
  );
  const active = docs.filter((d) => d.status === "processed" && d.active).length;
  const pendingOrBlocked = docs.length - active;

  return (
    <PageContainer>
      <Link to={agentPath} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Agente de IA
      </Link>
      <PageHeader
        eyebrow={[scope.areaLabel, "Fontes de conhecimento"]}
        title="Base de conhecimento"
        description="Documentos que o assistente pode consultar e os que ainda não estão disponíveis para ele."
        actions={
          <Button asChild size="lg">
            <Link to={docsPath}>
              <FolderOpen /> Biblioteca
            </Link>
          </Button>
        }
      />

      <SectionCard
        title={`Documentos de ${scope.condoName}`}
        description={`O agente só consulta documentos de ${scope.condoName}.`}
        aside={data && <CountBadge>{active === 1 ? "1 ativo" : `${active} ativos`}</CountBadge>}
      >
        {isError ? (
          <InlineNotice tone="danger">Não foi possível carregar os documentos.</InlineNotice>
        ) : isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum documento ainda"
            description="Sem documentos processados o assistente não tem o que consultar."
            action={
              <Button asChild>
                <Link to={`${docsPath}/novo`}>Adicionar documentos</Link>
              </Button>
            }
          />
        ) : (
          <ListRows>
            {docs.map((d) => {
              const a = agentAvailability(d);
              return (
                <ListRow
                  key={d.id}
                  to={`${docsPath}/${d.id}`}
                  leading={<IconTile icon={FileText} />}
                  title={d.filename}
                  meta={
                    <>
                      {kindLabel(d)} · {a.meta}
                      <span className="mt-2 flex sm:hidden">
                        <StatusPill tone={a.tone}>{a.label}</StatusPill>
                      </span>
                    </>
                  }
                  trailing={
                    <span className="hidden sm:inline-flex">
                      <StatusPill tone={a.tone}>{a.label}</StatusPill>
                    </span>
                  }
                />
              );
            })}
          </ListRows>
        )}
      </SectionCard>

      <SectionCard title="Disponibilidade das fontes">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={active ? (pendingOrBlocked ? "warning" : "success") : "danger"}>
              {active === 0 ? "Base vazia" : pendingOrBlocked ? "Base parcialmente pronta" : "Base pronta"}
            </StatusPill>
            <StatusPill tone="success">{active === 1 ? "1 documento ativo" : `${active} documentos ativos`}</StatusPill>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              Documentos processados e ativos aparecem como fontes nas respostas, com arquivo e página.
            </li>
            <li className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              Arquivos em processamento, com falha, em revisão ou desativados não são consultados pelo agente.
            </li>
          </ul>
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default AgentSourcesPage;
