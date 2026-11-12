import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, FileText, Loader2, Plus, Search, Sparkles, Upload } from "lucide-react";
import { api, type CondoDocument, type DocumentCategory } from "@/lib/api";
import { categoryLabel, DOCUMENT_CATEGORIES, formatBytes, IN_PROGRESS, shortDate } from "@/lib/documents";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { useResumeProcessing } from "@/hooks/use-resume-processing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterMenu from "@/components/app/FilterMenu";
import ListRow, { ListRows } from "@/components/app/ListRow";
import IconTile from "@/components/app/IconTile";
import StatusPill from "@/components/app/StatusPill";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import { PageContainer } from "@/components/layout/AppShell";

type CategoryFilter = "all" | DocumentCategory;
type StatusFilter = "all" | "processed" | "in_progress" | "needs_review" | "failed" | "inactive";
type Sort = "recent" | "oldest" | "name" | "size";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "processed", label: "Processados" },
  { value: "in_progress", label: "Em processamento" },
  { value: "needs_review", label: "Precisam de revisão" },
  { value: "failed", label: "Com falha" },
  { value: "inactive", label: "Desativados" },
];

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name", label: "Nome (A–Z)" },
  { value: "size", label: "Maior tamanho" },
];

function matchesStatus(d: CondoDocument, f: StatusFilter) {
  switch (f) {
    case "all":
      return true;
    case "inactive":
      return !d.active;
    case "in_progress":
      return IN_PROGRESS.includes(d.status);
    default:
      return d.status === f;
  }
}

const SORTERS: Record<Sort, (a: CondoDocument, b: CondoDocument) => number> = {
  recent: (a, b) => b.created_at.localeCompare(a.created_at),
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  name: (a, b) => a.filename.localeCompare(b.filename, "pt-BR"),
  size: (a, b) => (b.size ?? 0) - (a.size ?? 0),
};

const DocumentPill = ({ doc }: { doc: CondoDocument }) =>
  doc.status === "processed" && !doc.active ? <StatusPill tone="neutral">Desativado</StatusPill> : <StatusPill status={doc.status} />;

const DocumentRow = ({ doc, to }: { doc: CondoDocument; to: string }) => (
  <ListRow
    to={to}
    leading={<IconTile icon={FileText} />}
    title={doc.filename}
    meta={
      <>
        {categoryLabel(doc.category)} · {formatBytes(doc.size)} · Enviado em {shortDate.format(new Date(doc.created_at))}
        {/* No mobile a pílula fica abaixo, para o nome não ser cortado. */}
        <span className="mt-2 flex sm:hidden">
          <DocumentPill doc={doc} />
        </span>
      </>
    }
    trailing={
      <span className="hidden sm:inline-flex">
        <DocumentPill doc={doc} />
      </span>
    }
  />
);

const DocumentsPage = () => {
  const scope = useCondoScope();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const queryKey = ["documents", scope.condoId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => api.documents.list(scope.apiCondoId),
    enabled: Boolean(scope.condoId),
    refetchInterval: (q) => (q.state.data?.documents.some((d) => IN_PROGRESS.includes(d.status)) ? 4000 : false),
  });
  const docs = data?.documents;
  useResumeProcessing(docs, () => queryClient.invalidateQueries({ queryKey }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (docs ?? [])
      .filter((d) => (category === "all" || d.category === category) && matchesStatus(d, status))
      .filter((d) => !q || d.filename.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q))
      .sort(SORTERS[sort]);
  }, [docs, search, category, status, sort]);

  const attention = (docs ?? []).filter((d) => d.status === "failed" || d.status === "needs_review").length;
  const libraryPath = `${scope.basePath}/documentos`;
  const isEmpty = docs !== undefined && docs.length === 0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[scope.areaLabel, "Documentos"]}
        title="Documentos do condomínio"
        description={`Biblioteca da base de conhecimento de ${scope.condoName}.`}
        actions={
          !isEmpty && (
            <Button asChild size="lg">
              <Link to={`${libraryPath}/novo`}>
                <Plus /> Adicionar documentos
              </Link>
            </Button>
          )
        }
      />

      {isEmpty ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
            <IconTile icon={Sparkles} size="lg" />
            <p className="eyebrow">Base de conhecimento vazia · {scope.condoName}</p>
            <h2 className="max-w-md text-2xl font-extrabold tracking-tight sm:text-3xl">
              Seu assistente está pronto para aprender sobre o condomínio.
            </h2>
            <p className="max-w-md text-muted-foreground">
              Adicione documentos oficiais para preparar a base do agente de {scope.condoName}. Até existirem fontes
              processadas, não há conteúdo disponível para consulta.
            </p>
            <Button asChild size="lg">
              <Link to={`${libraryPath}/novo`}>
                <Upload /> Adicionar primeiro documento
              </Link>
            </Button>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do arquivo"
              aria-label="Buscar por nome do arquivo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterMenu<CategoryFilter>
              label="Categoria"
              value={category}
              onChange={setCategory}
              neutralValue="all"
              options={[{ value: "all", label: "Todas categorias" }, ...DOCUMENT_CATEGORIES]}
            />
            <FilterMenu<StatusFilter> label="Status" value={status} onChange={setStatus} neutralValue="all" options={STATUS_OPTIONS} />
            <FilterMenu<Sort> label="Ordenar" value={sort} onChange={setSort} neutralValue="recent" options={SORT_OPTIONS} />
          </div>

          {attention > 0 && status === "all" && (
            <InlineNotice tone="warning">
              {attention === 1 ? "1 documento precisa" : `${attention} documentos precisam`} de atenção.{" "}
              <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setStatus("needs_review")}>
                Ver pendências
              </button>
            </InlineNotice>
          )}

          <SectionCard
            title={`Biblioteca de ${scope.condoName}`}
            description={`Documentos disponibilizados somente ao assistente de ${scope.condoName}.`}
            aside={docs && <CountBadge>{filtered.length === 1 ? "1 documento" : `${filtered.length} documentos`}</CountBadge>}
          >
            {isError ? (
              <InlineNotice tone="danger">Não foi possível carregar os documentos.</InlineNotice>
            ) : isLoading || !docs ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={FileSearch} title="Nenhum documento encontrado" description="Ajuste a busca ou os filtros." />
            ) : (
              <ListRows>
                {filtered.map((d) => (
                  <DocumentRow key={d.id} doc={d} to={`${libraryPath}/${d.id}`} />
                ))}
              </ListRows>
            )}
          </SectionCard>
        </>
      )}

      <InlineNotice tone="info">
        Envie convenção, regimento interno, atas, comunicados, regulamentos e manuais. Só documentos processados e ativos
        fundamentam as respostas do assistente.
      </InlineNotice>
    </PageContainer>
  );
};

export default DocumentsPage;
