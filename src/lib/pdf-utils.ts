import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Usa o worker empacotado pelo Vite.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

export interface ExtractedPage {
  /** 1..n em PDF; `null` em formatos sem paginação (TXT, DOCX). */
  page: number | null;
  text: string;
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DocumentKind = "pdf" | "docx" | "txt";

export function documentKind(file: Pick<File, "name" | "type">): DocumentKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || file.type === DOCX_MIME) return "docx";
  if (name.endsWith(".txt") || file.type === "text/plain") return "txt";
  return null;
}

export const MIME_BY_KIND: Record<DocumentKind, string> = {
  pdf: "application/pdf",
  docx: DOCX_MIME,
  txt: "text/plain",
};

export function isAcceptedFile(file: Pick<File, "name" | "type">): boolean {
  return documentKind(file) !== null;
}

/** Texto de cada página do PDF, na ordem. Páginas sem texto vêm vazias (mantêm a numeração). */
export async function extractPdfPages(file: File): Promise<ExtractedPage[]> {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Quebra de linha do PDF é visual; só mantemos a que encerra uma frase (fim de parágrafo provável).
    let text = "";
    for (const item of content.items) {
      const t = item as TextItem;
      if (typeof t.str !== "string") continue;
      text += t.str;
      if (t.hasEOL) text += /[.:;!?]\s*$/.test(t.str) ? "\n" : " ";
    }
    text = text.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
    pages.push({ page: i, text });
    page.cleanup();
  }
  await pdf.destroy();
  return pages;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

/** Extrai o texto do arquivo no navegador, separado por página quando o formato tem páginas. */
export async function extractPages(file: File): Promise<ExtractedPage[]> {
  switch (documentKind(file)) {
    case "pdf":
      return extractPdfPages(file);
    case "docx":
      return [{ page: null, text: await extractDocxText(file) }];
    case "txt":
      return [{ page: null, text: await file.text() }];
    default:
      throw new Error("Formato não suportado. Use PDF, DOCX ou TXT.");
  }
}
