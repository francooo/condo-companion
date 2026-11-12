import { query } from "../db.js";
import { groqChat, MODEL_FAST, MODEL_CHAT } from "./groq.js";
import { systemPrompt, type AgentLanguage, type AgentPersona } from "./agent.js";

/**
 * Geração de respostas do assistente: classificação da pergunta, busca nos documentos
 * processados e ativos do condomínio e resposta com a identidade configurada (nome, tom, idioma).
 * Usada pelo chat dos moradores e pelo teste do agente na administração.
 */

const NOT_FOUND_TOKEN = "NAO_ENCONTRADO";

export type Outcome = "answered" | "not_found" | "out_of_scope" | "error";
export interface Source {
  document_id: string;
  filename: string;
  page: number | null;
}
export interface Answer {
  content: string;
  outcome: Outcome;
  intent: string | null;
  sources: Source[];
}
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}
interface FinancialRow {
  date: string;
  category: string;
  description: string | null;
  amount: string;
  type: "income" | "expense";
}

type FixedOutcome = Exclude<Outcome, "answered">;

/** Respostas fixas (sem IA) em cada idioma suportado. */
export const FIXED_REPLIES: Record<AgentLanguage, Record<FixedOutcome, string>> = {
  "pt-BR": {
    not_found:
      "Não encontrei essa informação nos documentos disponíveis do seu condomínio. Consulte a administração para confirmar antes de tomar uma decisão.",
    out_of_scope:
      "Posso ajudar com perguntas sobre documentos e informações deste condomínio. Não consigo orientar sobre assuntos fora desse contexto.",
    error: "O assistente está temporariamente indisponível. Tente novamente em instantes.",
  },
  en: {
    not_found:
      "I couldn't find this information in your condominium's available documents. Please check with the management before making a decision.",
    out_of_scope: "I can help with questions about this condominium's documents and information. I can't advise on other topics.",
    error: "The assistant is temporarily unavailable. Please try again in a moment.",
  },
  es: {
    not_found:
      "No encontré esta información en los documentos disponibles de tu condominio. Consulta a la administración antes de tomar una decisión.",
    out_of_scope: "Puedo ayudar con preguntas sobre los documentos e información de este condominio. No puedo orientar sobre otros temas.",
    error: "El asistente no está disponible en este momento. Inténtalo de nuevo en unos instantes.",
  },
};

const reply = (outcome: FixedOutcome, persona: AgentPersona) => FIXED_REPLIES[persona.language][outcome];

function historyBlock(history: HistoryMessage[]) {
  if (!history.length) return "";
  const lines = history.map((m) => `${m.role === "user" ? "Morador" : "Assistente"}: ${m.content.slice(0, 500)}`);
  return `Conversa anterior (use apenas para entender a pergunta atual):\n${lines.join("\n")}\n\n`;
}

async function classify(question: string, history: HistoryMessage[]) {
  const prompt = `Classifique a pergunta atual de um morador de condomínio em uma das três categorias:
- "financeiro" — APENAS se for claramente sobre dados financeiros do condomínio: gastos, receitas, prestação de contas, saldo, valores pagos ou arrecadados
- "fora" — APENAS se for claramente sem relação com o condomínio, a moradia ou a convivência (ex.: receitas culinárias, filmes, esportes, programação, notícias, tarefas escolares)
- "regras" — para QUALQUER outra pergunta, incluindo regras, regulamentos, convivência, normas, avisos, comunicados ou qualquer assunto que possa estar nos documentos do condomínio

Na dúvida, responda "regras".

Responda APENAS com a palavra "regras", "financeiro" ou "fora".

${historyBlock(history)}Pergunta atual: "${question}"`;
  const raw = (await groqChat(prompt, undefined, { model: MODEL_FAST, maxTokens: 10 })).trim().toLowerCase();
  if (raw.includes("financeiro")) return "financeiro";
  if (raw.includes("fora")) return "fora";
  return "regras";
}

async function answerFinancial(condoId: string, question: string, persona: AgentPersona): Promise<Answer> {
  const extractPrompt = `Analise a seguinte pergunta sobre finanças de um condomínio e extraia os filtros em JSON:
{
  "category": "string ou null",
  "type": "income ou expense ou null",
  "months": "número de meses para olhar para trás ou null",
  "year": "ano específico ou null"
}

Responda APENAS com o JSON, sem explicação.

Pergunta: "${question}"`;

  const filtersRaw = await groqChat(extractPrompt, undefined, { model: MODEL_FAST, maxTokens: 200 });
  let filters: { category?: string; type?: string; months?: string | number; year?: string | number } = {};
  try {
    const match = filtersRaw.match(/\{[\s\S]*\}/);
    if (match) filters = JSON.parse(match[0]);
  } catch {
    // segue sem filtros
  }

  const params: unknown[] = [condoId];
  let where = "WHERE condo_id = $1";
  if (filters.category) {
    params.push(`%${filters.category}%`);
    where += ` AND category ILIKE $${params.length}`;
  }
  if (filters.type === "income" || filters.type === "expense") {
    params.push(filters.type);
    where += ` AND type = $${params.length}`;
  }
  const monthsNum = parseInt(String(filters.months ?? ""), 10);
  if (!isNaN(monthsNum)) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsNum);
    params.push(d.toISOString().split("T")[0]);
    where += ` AND date >= $${params.length}`;
  }
  if (filters.year && /^\d{4}$/.test(String(filters.year))) {
    params.push(`${filters.year}-01-01`, `${filters.year}-12-31`);
    where += ` AND date >= $${params.length - 1} AND date <= $${params.length}`;
  }

  const { rows: records } = await query<FinancialRow>(
    `SELECT date::text, category, description, amount::text, type FROM financial_records ${where} ORDER BY date DESC LIMIT 50`,
    params
  );
  if (records.length === 0) {
    return { content: reply("not_found", persona), outcome: "not_found", intent: "financeiro", sources: [] };
  }

  const sum = (type: string) => records.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = sum("income");
  const totalExpense = sum("expense");
  const financialContext = `Dados financeiros encontrados (${records.length} registros):
Total receitas: R$ ${totalIncome.toFixed(2)}
Total despesas: R$ ${totalExpense.toFixed(2)}
Saldo: R$ ${(totalIncome - totalExpense).toFixed(2)}

Detalhes:
${records
  .map(
    (r) =>
      `${r.date} | ${r.category} | ${r.description ?? ""} | R$ ${Number(r.amount).toFixed(2)} | ${r.type === "income" ? "Receita" : "Despesa"}`
  )
  .join("\n")}`;

  const content = await groqChat(
    `Pergunta do morador: "${question}"\n\n${financialContext}\n\nResponda a pergunta baseado EXCLUSIVAMENTE nos dados acima. Use formatação Markdown. Mostre valores em reais (R$). Nunca invente dados. Se os dados não responderem à pergunta, diga isso.`,
    systemPrompt(persona, "Responda sobre as finanças do condomínio de forma clara e precisa, baseado nos dados fornecidos."),
    { model: MODEL_CHAT }
  );
  return { content, outcome: "answered", intent: "financeiro", sources: [] };
}

async function answerFromDocuments(condoId: string, question: string, history: HistoryMessage[], persona: AgentPersona): Promise<Answer> {
  const keywordsPrompt = `Extraia as 3-5 palavras-chave mais importantes da pergunta atual para buscar em documentos de um condomínio. Se a pergunta depender da conversa anterior (ex.: "e aos domingos?"), inclua o assunto dela.
Responda APENAS com as palavras separadas por vírgula, sem explicação.

${historyBlock(history)}Pergunta atual: "${question}"`;

  const keywordsRaw = await groqChat(keywordsPrompt, undefined, { model: MODEL_FAST, maxTokens: 60 });
  const searchTerms = keywordsRaw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 2)
    .join(" OR ");

  // Só documentos processados e ativos fundamentam respostas.
  const { rows: matches } = await query<{ content: string; page: number | null; document_id: string; filename: string }>(
    `SELECT kb.content, kb.page, d.id AS document_id, d.filename
       FROM knowledge_base kb
       JOIN documents d ON d.id = kb.document_id
      WHERE kb.condo_id = $1 AND d.status = 'processed' AND d.active
        AND kb.search_vector @@ websearch_to_tsquery('portuguese', $2)
      ORDER BY ts_rank(kb.search_vector, websearch_to_tsquery('portuguese', $2)) DESC
      LIMIT 4`,
    [condoId, searchTerms || question]
  );

  if (matches.length === 0) {
    return { content: reply("not_found", persona), outcome: "not_found", intent: "regras", sources: [] };
  }

  const context = matches
    .map((m, i) => `[Trecho ${i + 1} — ${m.filename}${m.page ? `, página ${m.page}` : ""}]\n${m.content.slice(0, 1500)}`)
    .join("\n\n");

  const raw = await groqChat(
    `${historyBlock(history)}Pergunta do morador: "${question}"\n\nContexto dos documentos do condomínio:\n${context}\n\nResponda a pergunta baseado EXCLUSIVAMENTE no contexto acima. Se a resposta não estiver no contexto, responda apenas: ${NOT_FOUND_TOKEN}. Use formatação Markdown e não cite os números dos trechos.`,
    systemPrompt(persona, "Responda de forma precisa, baseado somente nos documentos fornecidos."),
    { model: MODEL_CHAT }
  );

  if (raw.trim().toUpperCase().startsWith(NOT_FOUND_TOKEN) || !raw.trim()) {
    return { content: reply("not_found", persona), outcome: "not_found", intent: "regras", sources: [] };
  }

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const m of matches) {
    const key = `${m.document_id}:${m.page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ document_id: m.document_id, filename: m.filename, page: m.page ?? null });
  }
  return { content: raw.replaceAll(NOT_FOUND_TOKEN, "").trim(), outcome: "answered", intent: "regras", sources };
}

/** Gera a resposta. Nunca lança: falha do serviço de IA vira o resultado "error", que pode ser refeito. */
export async function generateAnswer(
  condoId: string,
  question: string,
  history: HistoryMessage[],
  persona: AgentPersona
): Promise<Answer> {
  try {
    const intent = await classify(question, history);
    if (intent === "fora") return { content: reply("out_of_scope", persona), outcome: "out_of_scope", intent, sources: [] };
    if (intent === "financeiro") return await answerFinancial(condoId, question, persona);
    return await answerFromDocuments(condoId, question, history, persona);
  } catch (e) {
    console.error("chat answer error:", e);
    return { content: reply("error", persona), outcome: "error", intent: null, sources: [] };
  }
}
