import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileX, Loader2, RefreshCw, Replace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type CondoDocument, type DocumentCategory } from "@/lib/api";
import {
  ACCEPT_ATTR,
  categoryLabel,
  DOCUMENT_CATEGORIES,
  formatBytes,
  IN_PROGRESS,
  isProcessingHere,
  kindLabel,
  PHASE_LABEL,
  processUntilDone,
  replaceDocument,
  shortDate,
  validateFile,
  type UploadProgress,
} from "@/lib/documents";
import { errorMessage } from "@/lib/utils";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { useResumeProcessing } from "@/hooks/use-resume-processing";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import StatusPill from "@/components/app/StatusPill";
import InlineNotice from "@/components/app/InlineNotice";
import EmptyState from "@/components/app/EmptyState";
import FormField from "@/components/app/FormField";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { PageContainer } from "@/components/layout/AppShell";

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
    <dd className="break-words font-semibold">{value}</dd>
  </div>
);

/** Prévia do texto extraído, página a página — é exatamente o que o assistente lê. */
const PagePreview = ({ doc, condoName }: { doc: CondoDocument; condoName: string }) => {
  const [page, setPage] = useState(1);
  const total = doc.page_count ?? 0;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-page", doc.id, page, doc.updated_at],
    queryFn: () => api.documents.page(doc.id, page),
    enabled: total > 0,
  });

  if (!total) {
    const legacy = doc.mime === "application/pdf";
    return (
      <InlineNotice tone="info">
        {legacy
          ? "Este documento foi indexado antes da separação por páginas. Substitua o arquivo para ver a prévia e permitir que o assistente cite a página."
          : `${kindLabel(doc)} não tem paginação: o assistente cita o documento pelo nome do arquivo.`}
      </InlineNotice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-warm px-5 py-6 shadow-sm sm:px-8">
        <p className="eyebrow text-[0.7rem]">
          {condoName} · {doc.filename}
        </p>
        <div className="mt-4 min-h-[12rem] max-h-[28rem] overflow-y-auto whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed">
          {isLoading ? (
            <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando página" />
          ) : isError ? (
            <span className="text-danger">Não foi possível carregar esta página.</span>
          ) : data?.content ? (
            data.content
          ) : (
            <span className="italic text-muted-foreground">Página sem texto extraível (imagem ou em branco).</span>
          )}
        </div>
        <p className="mt-4 text-center font-serif text-sm text-muted-foreground">Página {page}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
          <ChevronLeft /> Anterior
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          Página {page} de {total}
        </span>
        <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= total}>
          Próxima <ChevronRight />
        </Button>
      </div>
    </div>
  );
};

const DocumentDetailPage = () => {
  const { docId = "" } = useParams();
  const scope = useCondoScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryPath = `${scope.basePath}/documentos`;

  const queryKey = ["document", docId];
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => api.documents.get(docId),
    refetchInterval: (q) => (q.state.data && IN_PROGRESS.includes(q.state.data.document.status) ? 3000 : false),
    retry: false,
  });
  const doc = data?.document;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };
  useResumeProcessing(doc ? [doc] : undefined, refresh);

  const [category, setCategory] = useState<DocumentCategory>("outros");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (!doc) return;
    setCategory(doc.category);
    setDescription(doc.description ?? "");
  }, [doc?.id, doc?.category, doc?.description]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = Boolean(doc) && (category !== doc!.category || description.trim() !== (doc!.description ?? ""));

  const [replacing, setReplacing] = useState<UploadProgress | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof api.documents.update>[1]) => api.documents.update(docId, patch),
    onSuccess: ({ document }, patch) => {
      queryClient.setQueryData(queryKey, { document });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (patch.active !== undefined) {
        toast.success(patch.active ? "Documento disponível para o assistente." : "Documento retirado do assistente.");
      } else toast.success("Alterações salvas.");
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível salvar.")),
  });

  const remove = useMutation({
    mutationFn: () => api.documents.remove(docId),
    onSuccess: () => {
      toast.success("Documento excluído.");
      // Tira da lista em cache já, para a biblioteca não mostrar o item por um instante.
      queryClient.setQueriesData<{ documents: CondoDocument[] }>({ queryKey: ["documents"] }, (old) =>
        old ? { documents: old.documents.filter((d) => d.id !== docId) } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.removeQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["condos"] });
      navigate(libraryPath, { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível excluir.")),
  });

  const runProcessing = async (force = false) => {
    setRetrying(true);
    try {
      const final = await processUntilDone(docId, () => queryClient.invalidateQueries({ queryKey }), force);
      if (final.status === "processed") toast.success("Documento processado.");
    } catch (err) {
      toast.error(errorMessage(err, "O processamento falhou."));
    } finally {
      setRetrying(false);
      refresh();
    }
  };

  const onReplace = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const invalid = validateFile(file);
    if (invalid) return toast.error(invalid);
    setReplacing({ phase: "extracting", percent: 0 });
    try {
      const { document } = await replaceDocument(docId, file, setReplacing);
      toast[document.status === "processed" ? "success" : "warning"](
        document.status === "processed" ? "Arquivo substituído e processado." : "Arquivo substituído, mas precisa de atenção.",
      );
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível substituir o arquivo."));
    } finally {
      setReplacing(null);
      refresh();
    }
  };

  const download = async () => {
    try {
      const blob = await api.documents.downloadFile(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc?.filename ?? "documento";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível baixar o arquivo."));
    }
  };

  if (isError || (!isLoading && !doc)) {
    return (
      <PageContainer>
        <EmptyState
          icon={FileX}
          title="Documento não encontrado"
          description={errorMessage(error, "Ele pode ter sido excluído ou pertencer a outro condomínio.")}
          action={
            <Button asChild variant="outline">
              <Link to={libraryPath}>
                <ArrowLeft /> Voltar à biblioteca
              </Link>
            </Button>
          }
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

  const busy = Boolean(replacing) || remove.isPending;
  const inProgress = IN_PROGRESS.includes(doc.status);
  const progress = doc.chunk_count ? Math.round(((doc.summarized_count ?? 0) / doc.chunk_count) * 100) : 0;
  const working = retrying || isProcessingHere(doc.id);

  return (
    <PageContainer>
      <Link to={libraryPath} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Biblioteca de {scope.condoName}
      </Link>
      <PageHeader
        eyebrow={[scope.areaLabel, "Detalhes do documento"]}
        title={<span className="[overflow-wrap:anywhere]">{doc.filename}</span>}
        description={`${categoryLabel(doc.category)} · enviado em ${shortDate.format(new Date(doc.created_at))}${doc.uploaded_by_name ? ` por ${doc.uploaded_by_name}` : ""}`}
      />

      <SectionCard
        title="Situação no assistente"
        aside={doc.status === "processed" && !doc.active ? <StatusPill tone="neutral">Desativado</StatusPill> : <StatusPill status={doc.status} />}
      >
        <div className="space-y-4">
          {replacing ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                {PHASE_LABEL[replacing.phase]} · {replacing.percent}%
              </p>
              <Progress value={replacing.percent} className="h-2" />
            </div>
          ) : inProgress ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Processando {doc.summarized_count ?? 0} de {doc.chunk_count} trechos. O documento entra no assistente ao
                terminar.
              </p>
              <Progress value={progress} className="h-2" aria-label="Progresso do processamento" />
            </div>
          ) : doc.status === "processed" ? (
            <p className="text-sm text-muted-foreground">
              {doc.active
                ? `Disponível para o assistente: ${doc.chunk_count} ${doc.chunk_count === 1 ? "trecho indexado" : "trechos indexados"}.`
                : "Desativado: o assistente não usa este documento nas respostas."}
            </p>
          ) : (
            <InlineNotice tone="danger">{doc.error ?? "O documento não pôde ser processado."}</InlineNotice>
          )}

          {!replacing && doc.status === "failed" && (
            <Button onClick={() => runProcessing()} disabled={working}>
              {working ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tentar novamente
            </Button>
          )}
          {!replacing && doc.status === "needs_review" && doc.chunk_count > 0 && (
            <Button variant="outline" onClick={() => runProcessing(true)} disabled={working}>
              {working ? <Loader2 className="animate-spin" /> : <RefreshCw />} Processar mesmo assim
            </Button>
          )}

          {doc.status === "processed" && (
            <label htmlFor="doc-active" className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
              <span>
                <span className="block font-semibold">Disponível para o assistente</span>
                <span className="block text-sm text-muted-foreground">Desative para tirar o documento das respostas sem excluí-lo.</span>
              </span>
              <Switch
                id="doc-active"
                checked={doc.active}
                disabled={save.isPending || busy}
                onCheckedChange={(active) => save.mutate({ active })}
              />
            </label>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <SectionCard title="Prévia do documento" description="Texto extraído de cada página, como o assistente o lê.">
          <PagePreview doc={doc} condoName={scope.condoName} />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Informações do arquivo">
            <dl className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Info label="Nome" value={doc.filename} />
              </div>
              <Info label="Tipo" value={`${kindLabel(doc)} · ${formatBytes(doc.size)}`} />
              <Info label="Condomínio" value={doc.condo_name ?? scope.condoName} />
              <Info label="Páginas" value={doc.page_count ?? "—"} />
              <Info label="Trechos indexados" value={doc.chunk_count} />
              <Info label="Atualizado em" value={shortDate.format(new Date(doc.updated_at))} />
              <Info label="Arquivo original" value={doc.has_file ? "Guardado" : "Não guardado"} />
            </dl>
          </SectionCard>

          <SectionCard title="Classificação">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({ category, description: description.trim() });
              }}
            >
              <FormField label="Categoria" htmlFor="detail-category">
                <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                  <SelectTrigger id="detail-category" className="h-12 rounded-xl bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Descrição" htmlFor="detail-description">
                <Textarea id="detail-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
              </FormField>
              <Button type="submit" disabled={!dirty || save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />} Salvar alterações
              </Button>
            </form>
          </SectionCard>

          <SectionCard title="Arquivo">
            <div className="flex flex-col gap-2">
              {doc.has_file && (
                <Button variant="outline" onClick={download} disabled={busy}>
                  <Download /> Baixar original
                </Button>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => onReplace(e.target.files?.[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy || working || inProgress}>
                {replacing ? <Loader2 className="animate-spin" /> : <Replace />} Substituir arquivo
              </Button>
              <Button variant="destructive-outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 /> Excluir documento
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir documento?"
        description={`"${doc.filename}" sai da biblioteca e o assistente deixa de usá-lo. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir documento"
        destructive
        onConfirm={() => remove.mutate()}
      />
    </PageContainer>
  );
};

export default DocumentDetailPage;
