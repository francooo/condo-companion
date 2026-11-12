import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { documentKind } from "./file-kinds";

// Usa o worker empacotado pelo Vite.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

export interface ExtractedPage {
  /** 1..n em PDF; `null` em formatos sem paginação (TXT, DOCX). */
  page: number | null;
  text: string;
}

export { DOCX_MIME, documentKind, isAcceptedFile, MIME_BY_KIND, type DocumentKind } from "./file-kinds";

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
