import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileText, Loader2, Upload, X } from "lucide-react";
import type { CondoDocument, DocumentCategory } from "@/lib/api";
import {
  ACCEPT_ATTR,
  DOCUMENT_CATEGORIES,
  formatBytes,
  kindLabel,
  MAX_STORED_FILE_BYTES,
  PHASE_LABEL,
  uploadDocument,
  validateFile,
  type UploadProgress,
} from "@/lib/documents";
import { errorMessage, cn } from "@/lib/utils";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import IconTile from "@/components/app/IconTile";
import StatusPill from "@/components/app/StatusPill";
import InlineNotice from "@/components/app/InlineNotice";
import FormField from "@/components/app/FormField";
import { PageContainer } from "@/components/layout/AppShell";

interface Item {
  key: string;
  file: File;
  /** Erro de validação: o arquivo não será enviado. */
  invalid?: string;
  state: "ready" | "working" | "done" | "failed";
  progress?: UploadProgress;
  document?: CondoDocument;
  error?: string;
}

let seq = 0;
const toItem = (file: File): Item => ({ key: `${Date.now()}-${seq++}`, file, invalid: validateFile(file) ?? undefined, state: "ready" });

const ItemPill = ({ item }: { item: Item }) => {
  if (item.invalid) return <StatusPill tone="danger">Não suportado</StatusPill>;
  switch (item.state) {
    case "ready":
      return <StatusPill tone="info">Pronto</StatusPill>;
    case "working":
      return <StatusPill tone="warning">{item.progress ? PHASE_LABEL[item.progress.phase] : "Enviando"}</StatusPill>;
    case "failed":
      return <StatusPill tone="danger">Falha</StatusPill>;
    case "done":
      return <StatusPill status={item.document?.status} />;
  }
};

const FileRow = ({ item, condoName, onRemove, to }: { item: Item; condoName: string; onRemove?: () => void; to?: string }) => {
  const meta = [kindLabel({ filename: item.file.name, mime: item.file.type }), formatBytes(item.file.size), condoName].join(" · ");
  const note =
    item.invalid ??
    item.error ??
    (item.state === "done" && item.document?.status !== "processed" ? item.document?.error : undefined) ??
    (item.file.size > MAX_STORED_FILE_BYTES && item.state === "ready"
      ? "Acima de 4 MB: o texto será indexado, mas o arquivo original não ficará guardado."
      : undefined);
  const title = to ? (
    <Link to={to} className="underline-offset-4 hover:underline">
      {item.file.name}
    </Link>
  ) : (
    item.file.name
  );
  return (
    <li className="flex items-start gap-4 py-4">
      <IconTile icon={FileText} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold [overflow-wrap:anywhere]">{title}</p>
        <p className="text-sm text-muted-foreground">{meta}</p>
        <div className="pt-1 sm:hidden">
          <ItemPill item={item} />
        </div>
        {item.state === "working" && item.progress && (
          <Progress value={item.progress.percent} className="h-2" aria-label={`Progresso de ${item.file.name}`} />
        )}
        {note && <p className={cn("text-sm", item.invalid || item.state === "failed" ? "text-danger" : "text-muted-foreground")}>{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden sm:inline-flex">
          <ItemPill item={item} />
        </span>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove} aria-label={`Remover ${item.file.name}`}>
            <X />
          </Button>
        )}
      </div>
    </li>
  );
};

const DocumentUploadPage = () => {
  const scope = useCondoScope();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);

  const libraryPath = `${scope.basePath}/documentos`;
  const sendable = items.filter((i) => !i.invalid && i.state === "ready");
  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const addFiles = (files: FileList | null | undefined) => {
    if (!files?.length) return;
    setItems((list) => {
      const names = new Set(list.map((i) => `${i.file.name}:${i.file.size}`));
      return [...list, ...Array.from(files).filter((f) => !names.has(`${f.name}:${f.size}`)).map(toItem)];
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const send = async () => {
    if (!category || sendable.length === 0) return;
    setSending(true);
    for (const item of sendable) {
      update(item.key, { state: "working", progress: { phase: "extracting", percent: 0 } });
      try {
        const { document } = await uploadDocument(
          item.file,
          { category, description: description.trim(), condoId: scope.apiCondoId },
          (progress) => update(item.key, { progress }),
        );
        update(item.key, { state: document.status === "failed" ? "failed" : "done", document, error: document.status === "failed" ? document.error ?? undefined : undefined });
      } catch (err) {
        update(item.key, { state: "failed", error: errorMessage(err, "Não foi possível enviar o arquivo.") });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["condos"] });
    setSending(false);
    setFinished(true);
  };

  const restart = (keepFailed: boolean) => {
    setItems((list) =>
      keepFailed
        ? list.filter((i) => i.state === "failed" && !i.document).map((i) => ({ ...i, state: "ready" as const, error: undefined, progress: undefined }))
        : [],
    );
    setFinished(false);
  };

  const working = items.find((i) => i.state === "working");
  const overall = sending
    ? Math.round(
        items.filter((i) => !i.invalid).reduce((s, i) => s + (i.state === "working" ? i.progress?.percent ?? 0 : i.state === "ready" ? 0 : 100), 0) /
          Math.max(1, items.filter((i) => !i.invalid).length),
      )
    : 0;

  if (finished) {
    const attempted = items.filter((i) => !i.invalid);
    const failed = attempted.filter((i) => i.state === "failed");
    const allFailed = failed.length === attempted.length;
    const allProcessed = attempted.every((i) => i.document?.status === "processed");
    const plural = attempted.length > 1;
    const retryable = failed.some((i) => !i.document);

    return (
      <PageContainer>
        <PageHeader eyebrow={[scope.areaLabel, allFailed ? "Falha no envio" : "Envio concluído"]} title={allFailed ? "Envio não concluído" : "Envio concluído"} />
        <SectionCard>
          <div className="flex flex-col items-center gap-4 px-1 py-6 text-center">
            <IconTile icon={allFailed ? AlertTriangle : Check} size="lg" />
            {allFailed ? (
              <StatusPill tone="danger">Falha no envio</StatusPill>
            ) : (
              <StatusPill tone={allProcessed ? "success" : "warning"}>{allProcessed ? "Envio concluído" : "Concluído com pendências"}</StatusPill>
            )}
            <h2 className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
              {allFailed
                ? `Não foi possível enviar ${plural ? "os documentos" : "o documento"}`
                : allProcessed
                  ? plural
                    ? "Documentos prontos para consulta"
                    : "Documento pronto para consulta"
                  : "Alguns documentos precisam de atenção"}
            </h2>
            <p className="max-w-md text-muted-foreground">
              {allFailed
                ? retryable
                  ? "Revise o arquivo ou tente novamente. Nada foi adicionado à base do assistente."
                  : "O arquivo está na biblioteca, mas não pôde ser processado. Abra o documento para tentar de novo."
                : allProcessed
                  ? `${plural ? "Os arquivos já fundamentam" : "O arquivo já fundamenta"} as respostas do assistente de ${scope.condoName}.`
                  : "Os itens marcados abaixo não estão disponíveis para o assistente. Abra cada um para ver o motivo."}
            </p>
            <ul className="w-full divide-y divide-border rounded-3xl border border-border px-4 text-left sm:px-5">
              {attempted.map((i) => (
                <FileRow key={i.key} item={i} condoName={scope.condoName} to={i.document ? `${libraryPath}/${i.document.id}` : undefined} />
              ))}
            </ul>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" size="lg" onClick={() => restart(retryable)}>
                {retryable ? "Tentar novamente" : "Enviar outros documentos"}
              </Button>
              <Button asChild size="lg">
                <Link to={libraryPath}>Ver biblioteca · {scope.condoName}</Link>
              </Button>
            </div>
          </div>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[scope.areaLabel, "Adicionar documentos"]}
        title="Adicionar documentos"
        description={`Os arquivos ficam disponíveis somente ao assistente de ${scope.condoName}.`}
      />

      <SectionCard title="Enviar novos arquivos">
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!sending) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!sending) addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragOver ? "border-primary bg-brand-soft" : "border-primary/40 bg-brand-soft/40",
            )}
          >
            <IconTile icon={Upload} size="lg" />
            <p className="font-bold">Arraste arquivos para esta área</p>
            <p className="text-sm text-muted-foreground">ou selecione arquivos do dispositivo · PDF, DOCX ou TXT</p>
            <input
              ref={inputRef}
              id="doc-files"
              type="file"
              aria-label="Selecionar arquivos"
              multiple
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
              disabled={sending}
            />
            <Button type="button" variant="outline" disabled={sending} onClick={() => inputRef.current?.click()}>
              Selecionar arquivos
            </Button>
          </div>

          {items.length > 0 && (
            <ul className="divide-y divide-border border-y border-border">
              {items.map((i) => (
                <FileRow
                  key={i.key}
                  item={i}
                  condoName={scope.condoName}
                  onRemove={sending ? undefined : () => setItems((list) => list.filter((x) => x.key !== i.key))}
                />
              ))}
            </ul>
          )}

          <FormField label="Categoria" htmlFor="doc-category">
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} disabled={sending}>
              <SelectTrigger id="doc-category" className="h-12 rounded-xl bg-card">
                <SelectValue placeholder="Selecione a categoria" />
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

          <FormField
            label="Descrição"
            htmlFor="doc-description"
            hint={items.length > 1 ? "Opcional. Vale para todos os arquivos deste envio." : "Opcional. Ajuda a equipe a identificar o documento."}
          >
            <Input
              id="doc-description"
              placeholder="Ex.: Orientações de uso das áreas comuns"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              disabled={sending}
            />
          </FormField>

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {sending && working?.progress
                ? `${overall}% · ${PHASE_LABEL[working.progress.phase]}: ${working.file.name}`
                : sendable.length === 0
                  ? "Selecione ao menos um arquivo."
                  : !category
                    ? "Escolha a categoria para enviar."
                    : `${sendable.length} ${sendable.length === 1 ? "arquivo pronto" : "arquivos prontos"} para envio.`}
            </p>
            <Button size="lg" onClick={send} disabled={sending || !category || sendable.length === 0}>
              {sending && <Loader2 className="animate-spin" />}
              {sending ? "Enviando…" : sendable.length > 1 ? "Enviar documentos" : "Enviar documento"}
            </Button>
          </div>

          {sending && (
            <InlineNotice tone="info">
              Mantenha esta página aberta até o processamento terminar. Se sair, ele continua quando a biblioteca for aberta
              novamente.
            </InlineNotice>
          )}
        </div>
      </SectionCard>

      <InlineNotice tone="warning">
        O texto é extraído no seu navegador e indexado para o assistente. Arquivos digitalizados (imagem) não têm texto e
        ficam marcados como "Precisa de revisão".
      </InlineNotice>
    </PageContainer>
  );
};

export default DocumentUploadPage;
