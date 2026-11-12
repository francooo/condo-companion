/**
 * Envio de e-mail transacional.
 * - Com RESEND_API_KEY: envia pela API HTTP do Resend (sem dependência extra).
 * - Sem chave, fora de produção: registra o conteúdo no log, para desenvolvimento.
 * - Sem chave, em produção: não envia nem registra o conteúdo (links de redefinição são sensíveis).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[mail] RESEND_API_KEY não configurada; e-mail "${msg.subject}" não enviado.`);
    } else {
      console.info(`[mail:dev] Para: ${msg.to}\nAssunto: ${msg.subject}\n\n${msg.text}`);
    }
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "Condo App <onboarding@resend.dev>",
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao enviar e-mail (${res.status})`);
  }
}

export function frontendUrl() {
  return process.env.CORS_ORIGIN?.split(",")[0] ?? "http://localhost:8080";
}
