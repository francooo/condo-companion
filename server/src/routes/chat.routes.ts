import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateAnswer, type HistoryMessage } from "../lib/assistant.js";
import { loadAgent } from "../lib/agent.js";
import { conversationTitle } from "../lib/chat-utils.js";

const router = Router();

export const MAX_QUESTION_CHARS = 2000;
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Mensagens anteriores usadas como contexto de continuidade (pergunta + resposta). */
const HISTORY_MESSAGES = 4;

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

const AGENT_UNAVAILABLE = {
  error: "O assistente deste condomínio ainda não foi liberado pela administração.",
  code: "agent_unavailable",
};

/** Persona do assistente do condomínio, ou `null` se a administração ainda não o liberou. */
async function enabledAgent(condoId: string) {
  const agent = await loadAgent(condoId);
  return agent?.enabled ? agent : null;
}

/** Envia uma pergunta. Sem `conversation_id`, abre uma conversa nova com a pergunta como título. */
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const condoId = user.condo_id;
    if (!condoId) return res.status(400).json({ error: "Usuário não vinculado a um condomínio" });

    const question = String(req.body.question ?? "").trim();
    if (!question) return res.status(400).json({ error: "Escreva uma pergunta." });
    if (question.length > MAX_QUESTION_CHARS) {
      return res.status(400).json({ error: `A pergunta pode ter até ${MAX_QUESTION_CHARS} caracteres.` });
    }
    const agent = await enabledAgent(condoId);
    if (!agent) return res.status(409).json(AGENT_UNAVAILABLE);

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

    const answer = await generateAnswer(condoId, question, history, agent);
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
    const agent = await enabledAgent(failed.condo_id);
    if (!agent) return res.status(409).json(AGENT_UNAVAILABLE);

    const history = await recentHistory(failed.conversation_id, qRows[0].created_at);
    const answer = await generateAnswer(failed.condo_id, qRows[0].content, history, agent);
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
