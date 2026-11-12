import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, FileX, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { categoryLabel } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import IconTile from "@/components/app/IconTile";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import StatusPill from "@/components/app/StatusPill";
import { PageContainer } from "@/components/layout/AppShell";

/** "Origem da resposta": a página do documento que o assistente usou como fonte. */
const SourcePage = () => {
  const { documentId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("pagina"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : null;
  const conversationId = params.get("conversa");
  const backTo = conversationId ? `/chat/${conversationId}` : "/chat";

  const source = useQuery({ queryKey: ["source", documentId], queryFn: () => api.documents.source(documentId), retry: false });
  const doc = source.data?.document;
  const pageCount = doc?.page_count ?? 0;
  const currentPage = page && pageCount ? Math.min(page, pageCount) : null;

  const content = useQuery({
    queryKey: ["source-page", documentId, currentPage],
    queryFn: () => api.documents.page(documentId, currentPage!),
    enabled: Boolean(currentPage),
  });

  const goTo = (n: number) => {
    const next = new URLSearchParams(params);
    next.set("pagina", String(n));
    setParams(next, { replace: true });
  };

  const back = (
    <Button asChild variant="outline">
      <Link to={backTo}>
        <ArrowLeft /> Voltar à conversa
      </Link>
    </Button>
  );

  if (source.isError) {
    return (
      <PageContainer>
        <EmptyState
          icon={FileX}
          title="Fonte indisponível"
          description="O documento pode ter sido removido ou desativado pela administração do condomínio."
          action={back}
        />
      </PageContainer>
    );
  }
  if (!doc) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Morador", "Detalhe da fonte"]}
        title="Origem da resposta"
        description="Trecho do documento do condomínio que fundamentou a resposta do assistente."
      />

      <SectionCard title={currentPage ? `Prévia · página ${currentPage}` : "Prévia"}>
        {currentPage ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-muted/60 p-3 sm:p-5">
              <article className="rounded-lg border border-border bg-surface-warm px-5 py-6 shadow-sm sm:px-8">
                <p className="eyebrow text-[0.7rem]">{doc.condo_name}</p>
                <h2 className="mt-3 text-center text-xl font-bold">{doc.filename.replace(/\.[a-z0-9]+$/i, "")}</h2>
                <p className="mt-1 text-center font-serif text-sm text-muted-foreground">Página {currentPage}</p>
                <div className="mt-5 max-h-[32rem] min-h-[10rem] overflow-y-auto whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed">
                  {content.isLoading ? (
                    <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando página" />
                  ) : content.isError ? (
                    <span className="text-danger">Não foi possível carregar esta página.</span>
                  ) : content.data?.content ? (
                    content.data.content
                  ) : (
                    <span className="italic text-muted-foreground">Página sem texto extraível.</span>
                  )}
                </div>
              </article>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}>
                  <ChevronLeft /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  Página {currentPage} de {pageCount}
                </span>
                <Button variant="outline" size="sm" onClick={() => goTo(currentPage + 1)} disabled={currentPage >= pageCount}>
                  Próxima <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <InlineNotice tone="info">
            Este documento não tem paginação, por isso a resposta cita apenas o nome do arquivo. Peça à administração o
            documento completo se precisar consultá-lo.
          </InlineNotice>
        )}
      </SectionCard>

      <SectionCard title="Fonte da resposta" description={categoryLabel(doc.category)} aside={<StatusPill tone="success">Documento oficial</StatusPill>}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <IconTile icon={FileText} />
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">{doc.filename}</p>
              <p className="text-sm text-muted-foreground">
                {doc.condo_name}
                {page ? ` · página ${page}` : ""}
              </p>
            </div>
          </div>
          <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            As fontes vêm somente dos documentos que a administração de {doc.condo_name} disponibilizou ao assistente. Em caso de
            dúvida, confirme com a administração.
          </p>
          {back}
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default SourcePage;
