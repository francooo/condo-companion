import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Histórico do próprio usuário, sempre restrito ao condomínio do vínculo atual:
 * conversas de outro condomínio (ex.: vínculo antigo) não aparecem.
 */
const router = Router();

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    const params: unknown[] = [user.id, user.condo_id];
    let filter = "";
    if (q) {
      params.push(`%${q.replace(/[%_\\]/g, "\\$&")}%`);
      filter = `AND (c.title ILIKE $3 OR EXISTS (SELECT 1 FROM messages s WHERE s.conversation_id = c.id AND s.content ILIKE $3))`;
    }
    const { rows } = await query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              COUNT(m.id)::int AS message_count,
              COALESCE(bool_or(jsonb_array_length(m.sources) > 0), false) AS has_sources
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.user_id = $1 AND c.condo_id = $2 ${filter}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT 200`,
      params
    );
    res.json({ conversations: rows });
  } catch (e) {
    console.error("list conversations error:", e);
    res.status(500).json({ error: "Não foi possível carregar o histórico." });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (!isUuid(req.params.id)) return res.status(404).json({ error: "Conversa não encontrada." });
    const { rows } = await query(
      `SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2 AND condo_id = $3`,
      [req.params.id, user.id, user.condo_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Conversa não encontrada." });
    const { rows: messages } = await query(
      `SELECT id, conversation_id, role, content, outcome, intent, sources, created_at
         FROM messages WHERE conversation_id = $1 ORDER BY created_at, role DESC`,
      [rows[0].id]
    );
    res.json({ conversation: rows[0], messages });
  } catch (e) {
    console.error("get conversation error:", e);
    res.status(500).json({ error: "Não foi possível carregar a conversa." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (!isUuid(req.params.id)) return res.status(404).json({ error: "Conversa não encontrada." });
    const { rowCount } = await query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2 AND condo_id = $3`, [
      req.params.id,
      user.id,
      user.condo_id,
    ]);
    if (!rowCount) return res.status(404).json({ error: "Conversa não encontrada." });
    res.status(204).end();
  } catch (e) {
    console.error("delete conversation error:", e);
    res.status(500).json({ error: "Não foi possível apagar a conversa." });
  }
});

/** Apaga todo o histórico do usuário neste condomínio (Configurações → Privacidade). */
router.delete("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { rowCount } = await query(`DELETE FROM conversations WHERE user_id = $1 AND condo_id = $2`, [user.id, user.condo_id]);
    res.json({ deleted: rowCount ?? 0 });
  } catch (e) {
    console.error("delete all conversations error:", e);
    res.status(500).json({ error: "Não foi possível apagar o histórico." });
  }
});

export default router;
