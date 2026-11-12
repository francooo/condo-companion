/** Código de erro do Postgres (ex.: "23505" = valor duplicado), se houver. */
export const pgCode = (e: unknown) => (e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : undefined);
