/** Identidade visual do condomínio exposta ao app (sem dados internos). */
export interface Branding {
  display_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  cover_url: string | null;
}

export const fileUrl = (id: string | null | undefined) => (id ? `/api/files/${id}` : null);

/** Colunas para montar `Branding` a partir de `condos` com o alias informado. */
export const brandingColumns = (alias: string) =>
  `${alias}.display_name, ${alias}.primary_color, ${alias}.secondary_color, ${alias}.logo_file_id, ${alias}.cover_file_id`;

export function toBranding(row: {
  display_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_file_id?: string | null;
  cover_file_id?: string | null;
}): Branding {
  return {
    display_name: row.display_name ?? null,
    primary_color: row.primary_color ?? null,
    secondary_color: row.secondary_color ?? null,
    logo_url: fileUrl(row.logo_file_id),
    cover_url: fileUrl(row.cover_file_id),
  };
}

/** Cor no formato #RRGGBB (maiúsculas), ou `null` para "usar o padrão". `undefined` = inválida. */
export function normalizeColor(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return undefined;
  const hex = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${hex.toUpperCase()}`;
}

export const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Confere a assinatura do arquivo: o Content-Type enviado não basta. */
export function sniffImage(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
