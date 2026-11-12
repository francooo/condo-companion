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

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayMonthFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fullDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Horário de uma mensagem: "Agora", "10:42" (hoje) ou "12 de nov., 10:42". */
export function chatTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (now.getTime() - d.getTime() < 60_000) return "Agora";
  return startOfDay(d) === startOfDay(now) ? timeFmt.format(d) : `${dayMonthFmt.format(d)}, ${timeFmt.format(d)}`;
}

/** Data de uma conversa no histórico: "Hoje, 10:42", "Ontem, 18:03" ou "18 de out. de 2026". */
export function conversationWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return `Hoje, ${timeFmt.format(d)}`;
  if (days === 1) return `Ontem, ${timeFmt.format(d)}`;
  return fullDateFmt.format(d);
}
