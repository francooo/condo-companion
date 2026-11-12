// Funções puras (sem banco) usadas pelas rotas de chat e de conta.

/** Título da conversa: a primeira pergunta, encurtada numa fronteira de palavra. */
export function conversationTitle(question: string, max = 80) {
  const clean = question.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

export const TEXT_SIZES = ["normal", "large"] as const;

export function sanitizePreferences(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (src.text_size !== undefined) {
    if (!TEXT_SIZES.includes(src.text_size as (typeof TEXT_SIZES)[number])) return null;
    out.text_size = src.text_size;
  }
  if (src.reduced_motion !== undefined) {
    if (typeof src.reduced_motion !== "boolean") return null;
    out.reduced_motion = src.reduced_motion;
  }
  return Object.keys(out).length ? out : null;
}
