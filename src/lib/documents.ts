import { api, type CondoDocument, type DocumentCategory, type DocumentStatus } from "./api";
// O leitor de PDF (pdf.js) é pesado: só é carregado quando alguém envia um arquivo.
import { documentKind, MIME_BY_KIND } from "./file-kinds";

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "convencao", label: "Convenção condominial" },
  { value: "regimento", label: "Regimento interno" },
  { value: "atas", label: "Atas de assembleia" },
  { value: "comunicados", label: "Comunicados" },
  { value: "regulamentos", label: "Regulamentos" },
  { value: "manuais", label: "Manuais e orientações" },
  { value: "outros", label: "Outros" },
];

export const categoryLabel = (c: string) => DOCUMENT_CATEGORIES.find((x) => x.value === c)?.label ?? "Outros";

/** O original é guardado até este tamanho (limite de corpo da função serverless). */
export const MAX_STORED_FILE_BYTES = 4 * 1024 * 1024;
/** Acima disso nem extraímos: o navegador sofre e o texto passaria do limite da API. */
export const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024;
export const ACCEPT_ATTR = ".pdf,.docx,.txt,application/pdf,text/plain";

/** Estados em que o documento ainda vai mudar sem intervenção do admin. */
export const IN_PROGRESS: DocumentStatus[] = ["uploaded", "processing"];

const sizeFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "Tamanho desconhecido";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${sizeFmt.format(bytes / (1024 * 1024))} MB`;
}

export function kindLabel(doc: { filename: string; mime?: string | null }) {
  const kind = documentKind({ name: doc.filename, type: doc.mime ?? "" });
  return kind ? kind.toUpperCase() : "Arquivo";
}

export const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** Valida o arquivo antes de qualquer trabalho. Devolve a mensagem de erro, se houver. */
export function validateFile(file: File): string | null {
  if (!documentKind(file)) return "Formato não suportado. Use PDF, DOCX ou TXT.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_SOURCE_FILE_BYTES) return "O arquivo passa de 25 MB. Divida o documento ou reduza o tamanho.";
  return null;
}

export type UploadPhase = "extracting" | "sending" | "storing" | "processing" | "done";

export interface UploadProgress {
  phase: UploadPhase;
  /** 0..100 */
  percent: number;
}

/** Evita dois laços de processamento simultâneos para o mesmo documento nesta aba. */
const inFlight = new Map<string, Promise<CondoDocument>>();

/**
 * Chama o processamento em lotes até o documento sair de "enviado/processando".
 * Retorna o documento final (processado, com falha ou precisando de revisão).
 */
export function processUntilDone(
  id: string,
  onProgress?: (processed: number, total: number) => void,
  force = false,
): Promise<CondoDocument> {
  const existing = inFlight.get(id);
  if (existing) return existing;
  const run = (async () => {
    let forceNext = force;
    for (let guard = 0; guard < 2000; guard++) {
      const r = await api.documents.process(id, forceNext);
      forceNext = false;
      onProgress?.(r.processed, r.total);
      if (!IN_PROGRESS.includes(r.document.status)) return r.document;
    }
    throw new Error("O processamento não terminou. Tente novamente.");
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, run);
  return run;
}

export const isProcessingHere = (id: string) => inFlight.has(id);

async function prepare(file: File) {
  const kind = documentKind(file);
  if (!kind) throw new Error("Formato não suportado. Use PDF, DOCX ou TXT.");
  const { extractPages } = await import("./pdf-utils");
  const pages = await extractPages(file);
  return { filename: file.name, mime: MIME_BY_KIND[kind], size: file.size, pages };
}

/** Envia o original quando cabe no limite; falhar aqui não impede a indexação do texto. */
async function storeOriginal(id: string, file: File, mime: string) {
  if (file.size > MAX_STORED_FILE_BYTES) return false;
  try {
    await api.documents.uploadFile(id, file, mime);
    return true;
  } catch (err) {
    console.warn("Falha ao guardar o arquivo original:", err);
    return false;
  }
}

async function finish(
  doc: CondoDocument,
  file: File,
  mime: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<{ document: CondoDocument; storedOriginal: boolean }> {
  onProgress?.({ phase: "storing", percent: 30 });
  const storedOriginal = await storeOriginal(doc.id, file, mime);
  if (doc.status === "needs_review") {
    onProgress?.({ phase: "done", percent: 100 });
    return { document: { ...doc, has_file: storedOriginal }, storedOriginal };
  }
  onProgress?.({ phase: "processing", percent: 35 });
  const final = await processUntilDone(doc.id, (done, total) =>
    onProgress?.({ phase: "processing", percent: total ? 35 + Math.round((done / total) * 65) : 100 }),
  ).catch(async (err) => {
    // O servidor já marcou "falha"; devolve o estado atual para a tela mostrar o motivo.
    const { document } = await api.documents.get(doc.id).catch(() => ({ document: null }));
    if (document) return document;
    throw err;
  });
  onProgress?.({ phase: "done", percent: 100 });
  return { document: final, storedOriginal };
}

/** Pipeline completo de envio: extrai no navegador → cria → guarda o original → processa em lotes. */
export async function uploadDocument(
  file: File,
  opts: { category: DocumentCategory; description?: string; condoId?: string },
  onProgress?: (p: UploadProgress) => void,
) {
  onProgress?.({ phase: "extracting", percent: 5 });
  const body = await prepare(file);
  onProgress?.({ phase: "sending", percent: 20 });
  const { document } = await api.documents.create({
    ...body,
    category: opts.category,
    description: opts.description || undefined,
    condo_id: opts.condoId,
  });
  return finish(document, file, body.mime, onProgress);
}

/** Substitui o arquivo de um documento existente pelo mesmo pipeline. */
export async function replaceDocument(id: string, file: File, onProgress?: (p: UploadProgress) => void) {
  onProgress?.({ phase: "extracting", percent: 5 });
  const body = await prepare(file);
  onProgress?.({ phase: "sending", percent: 20 });
  const { document } = await api.documents.replace(id, body);
  return finish(document, file, body.mime, onProgress);
}

export const PHASE_LABEL: Record<UploadPhase, string> = {
  extracting: "Lendo o arquivo",
  sending: "Enviando",
  storing: "Guardando o original",
  processing: "Processando com IA",
  done: "Concluído",
};
