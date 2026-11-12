/** Máscara simples de celular brasileiro: (11) 99999-9999. */
export function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

const relFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 5 minutos", "há 2 horas", "ontem"… */
export function relativeTime(iso: string, now = Date.now()) {
  const diffMin = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(diffMin) < 60) return relFmt.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return relFmt.format(diffH, "hour");
  return relFmt.format(Math.round(diffH / 24), "day");
}
