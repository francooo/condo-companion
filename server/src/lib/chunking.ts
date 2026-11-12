export interface PageText {
  /** Número da página (1..n). `null` para formatos sem paginação (TXT, DOCX). */
  page: number | null;
  text: string;
}

export interface Chunk {
  page: number | null;
  index: number;
  content: string;
}

/** Normaliza espaços e remove caracteres de controle (o Postgres rejeita NUL em text). */
export function cleanText(text: string) {
  return text
    .split(String.fromCharCode(0))
    .join("")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Divide um texto em janelas de palavras com sobreposição. */
export function chunkText(text: string, chunkSize = 900, overlap = 100): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);
  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

/**
 * Gera trechos dentro de cada página, para que todo trecho tenha uma única página de origem
 * (é isso que permite citar "arquivo + página" na resposta do assistente).
 */
export function chunkPages(pages: PageText[], chunkSize = 900, overlap = 100): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) {
    for (const content of chunkText(p.text, chunkSize, overlap)) {
      out.push({ page: p.page, index: out.length, content });
    }
  }
  return out;
}
