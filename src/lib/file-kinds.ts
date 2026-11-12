/** Formatos de documento aceitos. Sem dependências pesadas: pode ser usado em qualquer tela. */

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
