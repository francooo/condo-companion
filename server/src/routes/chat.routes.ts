import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { groqChat, MODEL_FAST, MODEL_CHAT } from "../lib/groq.js";
import { conversationTitle } from "../lib/chat-utils.js";

const router = Router();

export const MAX_QUESTION_CHARS = 2000;
/** Mensagens anteriores usadas como contexto de continuidade (pergunta + resposta). */
const HISTORY_MESSAGES = 4;
const NOT_FOUND_TOKEN = "NAO_ENCONTRADO";

export type Outcome = "answered" | "not_found" | "out_of_scope" | "error";
export interface Source {
  document_id: string;
  filename: string;
  page: number | null;
}
interface Answer {
  content: string;
  outcome: Outcome;
  intent: string | null;
  sources: Source[];
}
interface HistoryMessage {
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

export const FIXED_REPLIES: Record<Exclude<Outcome, "answered">, string> = {
  not_found:
    "Não encontrei essa informação nos documentos disponíveis do seu condomínio. Consulte a administração para confirmar antes de tomar uma decisão.",
  out_of_scope:
    "Posso ajudar com perguntas sobre documentos e informações deste condomínio. Não consigo orientar sobre assuntos fora desse contexto.",
  error: "O assistente está temporariamente indisponível. Tente novamente em instantes.",
};

const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

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

async function answerFinancial(condoId: string, question: string): Promise<Answer> {
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
    return { content: FIXED_REPLIES.not_found, outcome: "not_found", intent: "financeiro", sources: [] };
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
    `Pergunta do morador: "${question}"\n\n${financialContext}\n\nResponda a pergunta baseado EXCLUSIVAMENTE nos dados acima. Use formatação Markdown. Mostre valores em reais (R$). Nunca invente dados.`,
    "Você é o assistente financeiro de um condomínio. Responda de forma clara e precisa baseado nos dados fornecidos.",
    { model: MODEL_CHAT }
  );
  return { content, outcome: "answered", intent: "financeiro", sources: [] };
}

async function answerFromDocuments(condoId: string, question: string, history: HistoryMessage[]): Promise<Answer> {
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
    return { content: FIXED_REPLIES.not_found, outcome: "not_found", intent: "regras", sources: [] };
  }

  const context = matches
    .map((m, i) => `[Trecho ${i + 1} — ${m.filename}${m.page ? `, página ${m.page}` : ""}]\n${m.content.slice(0, 1500)}`)
    .join("\n\n");

  const raw = await groqChat(
    `${historyBlock(history)}Pergunta do morador: "${question}"\n\nContexto dos documentos do condomínio:\n${context}\n\nResponda a pergunta baseado EXCLUSIVAMENTE no contexto acima. Se a resposta não estiver no contexto, responda apenas: ${NOT_FOUND_TOKEN}. Use formatação Markdown e não cite os números dos trechos.`,
    "Você é o assistente de um condomínio. Responda de forma clara, educada e precisa baseado nos documentos fornecidos.",
    { model: MODEL_CHAT }
  );

  if (raw.trim().toUpperCase().startsWith(NOT_FOUND_TOKEN) || !raw.trim()) {
    return { content: FIXED_REPLIES.not_found, outcome: "not_found", intent: "regras", sources: [] };
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
async function generateAnswer(condoId: string, question: string, history: HistoryMessage[]): Promise<Answer> {
  try {
    const intent = await classify(question, history);
    if (intent === "fora") return { content: FIXED_REPLIES.out_of_scope, outcome: "out_of_scope", intent, sources: [] };
    if (intent === "financeiro") return await answerFinancial(condoId, question);
    return await answerFromDocuments(condoId, question, history);
  } catch (e) {
    console.error("chat answer error:", e);
    return { content: FIXED_REPLIES.error, outcome: "error", intent: null, sources: [] };
  }
}

const MESSAGE_FIELDS = "id, conversation_id, role, content, outcome, intent, sources, created_at";

async function recentHistory(conversationId: string, before?: string): Promise<HistoryMessage[]> {
  const { rows } = await query<HistoryMessage>(
    `SELECT role, content FROM (
       SELECT role, content, created_at FROM messages
        WHERE conversation_id = $1 AND (outcome IS NULL OR outcome <> 'error')
          AND ($2::timestamptz IS NULL OR created_at < $2)
        ORDER BY created_at DESC LIMIT $3
     ) t ORDER BY created_at`,
    [conversationId, before ?? null, HISTORY_MESSAGES]
  );
  return rows;
}

function requireCondo(user: AuthUser) {
  return user.condo_id;
}

/** Envia uma pergunta. Sem `conversation_id`, abre uma conversa nova com a pergunta como título. */
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const condoId = requireCondo(user);
    if (!condoId) return res.status(400).json({ error: "Usuário não vinculado a um condomínio" });

    const question = String(req.body.question ?? "").trim();
    if (!question) return res.status(400).json({ error: "Escreva uma pergunta." });
    if (question.length > MAX_QUESTION_CHARS) {
      return res.status(400).json({ error: `A pergunta pode ter até ${MAX_QUESTION_CHARS} caracteres.` });
    }

    let conversation;
    let history: HistoryMessage[] = [];
    if (req.body.conversation_id) {
      if (!isUuid(req.body.conversation_id)) return res.status(404).json({ error: "Conversa não encontrada." });
      const { rows } = await query(
        `SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2 AND condo_id = $3`,
        [req.body.conversation_id, user.id, condoId]
      );
      conversation = rows[0];
      if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });
      history = await recentHistory(conversation.id);
    } else {
      const { rows } = await query(
        `INSERT INTO conversations (condo_id, user_id, title) VALUES ($1, $2, $3) RETURNING id, title, created_at, updated_at`,
        [condoId, user.id, conversationTitle(question)]
      );
      conversation = rows[0];
    }

    const { rows: userRows } = await query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING ${MESSAGE_FIELDS}`,
      [conversation.id, question]
    );

    const answer = await generateAnswer(condoId, question, history);
    const { rows: botRows } = await query(
      `INSERT INTO messages (conversation_id, role, content, outcome, intent, sources)
       VALUES ($1, 'assistant', $2, $3, $4, $5) RETURNING ${MESSAGE_FIELDS}`,
      [conversation.id, answer.content, answer.outcome, answer.intent, JSON.stringify(answer.sources)]
    );
    const { rows: convRows } = await query(
      `UPDATE conversations SET updated_at = now() WHERE id = $1 RETURNING id, title, created_at, updated_at`,
      [conversation.id]
    );

    res.json({
      conversation: convRows[0],
      user_message: userRows[0],
      assistant_message: botRows[0],
      // Campos de compatibilidade com o cliente anterior.
      answer: answer.content,
      intent: answer.intent,
      sources: answer.sources,
    });
  } catch (e) {
    console.error("chat error:", e);
    res.status(500).json({ error: "Não foi possível registrar a pergunta." });
  }
});

/** Refaz uma resposta que falhou ("erro temporário"), no mesmo lugar da conversa. */
router.post("/messages/:id/retry", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (!isUuid(req.params.id)) return res.status(404).json({ error: "Mensagem não encontrada." });
    const { rows } = await query(
      `SELECT m.id, m.outcome, m.created_at, m.conversation_id, c.condo_id
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.id = $1 AND c.user_id = $2 AND c.condo_id = $3`,
      [req.params.id, user.id, user.condo_id]
    );
    const failed = rows[0];
    if (!failed) return res.status(404).json({ error: "Mensagem não encontrada." });
    if (failed.outcome !== "error") return res.status(409).json({ error: "Esta resposta não precisa ser refeita." });

    const { rows: qRows } = await query<{ content: string; created_at: string }>(
      `SELECT content, created_at FROM messages
        WHERE conversation_id = $1 AND role = 'user' AND created_at <= $2
        ORDER BY created_at DESC LIMIT 1`,
      [failed.conversation_id, failed.created_at]
    );
    if (!qRows[0]) return res.status(409).json({ error: "Pergunta original não encontrada." });

    const history = await recentHistory(failed.conversation_id, qRows[0].created_at);
    const answer = await generateAnswer(failed.condo_id, qRows[0].content, history);
    const { rows: updated } = await query(
      `UPDATE messages SET content = $2, outcome = $3, intent = $4, sources = $5
        WHERE id = $1 RETURNING ${MESSAGE_FIELDS}`,
      [failed.id, answer.content, answer.outcome, answer.intent, JSON.stringify(answer.sources)]
    );
    await query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [failed.conversation_id]);
    res.json({ assistant_message: updated[0] });
  } catch (e) {
    console.error("chat retry error:", e);
    res.status(500).json({ error: "Não foi possível refazer a resposta." });
  }
});

export default router;
