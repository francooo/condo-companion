import { Router, type Request } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Atividade recente e indicadores de uso do assistente para a administração.
 * Admin vê só o próprio condomínio; a plataforma vê todos ou filtra por `condo_id`.
 */
const router = Router();

const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** `null` = todos os condomínios (só a plataforma). `undefined` = filtro inválido. */
function condoFilter(req: Request): string | null | undefined {
  if (req.user!.role !== "superadmin") return req.user!.condo_id;
  const requested = req.query.condo_id;
  if (requested === undefined || requested === "") return null;
  return isUuid(requested) ? String(requested) : undefined;
}

router.get("/activity", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = condoFilter(req);
    if (condoId === undefined) return res.json({ events: [] });
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const { rows } = await query(
      `SELECT e.id, e.type, e.payload, e.created_at, e.condo_id,
              COALESCE(c.display_name, c.name) AS condo_name,
              a.full_name AS actor_name, s.full_name AS subject_name, s.email AS subject_email
         FROM activity_events e
         LEFT JOIN condos c ON c.id = e.condo_id
         LEFT JOIN users a ON a.id = e.actor_id
         LEFT JOIN users s ON s.id = e.subject_user_id
        WHERE ($1::uuid IS NULL OR e.condo_id = $1)
        ORDER BY e.created_at DESC
        LIMIT $2`,
      [condoId, limit]
    );
    res.json({ events: rows });
  } catch (e) {
    console.error("activity error:", e);
    res.status(500).json({ error: "Não foi possível carregar a atividade." });
  }
});

/**
 * Indicadores do assistente no período. Não identifica moradores: o histórico de cada pessoa é privado;
 * a administração vê números e as perguntas que ficaram sem resposta (para saber que documentos faltam).
 */
router.get("/usage", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = condoFilter(req);
    if (condoId === undefined) return res.status(400).json({ error: "Condomínio inválido." });
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;

    const scope = `FROM messages m JOIN conversations v ON v.id = m.conversation_id
      WHERE m.created_at > now() - make_interval(days => $2) AND ($1::uuid IS NULL OR v.condo_id = $1)`;

    const { rows: totals } = await query(
      `SELECT COUNT(DISTINCT m.conversation_id)::int AS conversations,
              COUNT(DISTINCT v.user_id)::int AS people,
              COUNT(*) FILTER (WHERE m.role = 'user')::int AS questions,
              COUNT(*) FILTER (WHERE m.outcome = 'answered')::int AS answered,
              COUNT(*) FILTER (WHERE m.outcome = 'answered' AND jsonb_array_length(m.sources) > 0)::int AS with_sources,
              COUNT(*) FILTER (WHERE m.outcome = 'not_found')::int AS not_found,
              COUNT(*) FILTER (WHERE m.outcome = 'out_of_scope')::int AS out_of_scope,
              COUNT(*) FILTER (WHERE m.outcome = 'error')::int AS errors
         ${scope}`,
      [condoId, days]
    );

    // Tempo de resposta: da pergunta à resposta seguinte na mesma conversa.
    const { rows: timing } = await query(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM created_at - prev_at))::numeric, 1)::float AS avg_seconds FROM (
         SELECT m.role, m.created_at,
                LAG(m.created_at) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.role DESC) AS prev_at,
                LAG(m.role) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.role DESC) AS prev_role
           ${scope}
       ) t WHERE role = 'assistant' AND prev_role = 'user'`,
      [condoId, days]
    );

    const { rows: daily } = await query(
      `SELECT to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS questions
         ${scope} AND m.role = 'user'
        GROUP BY 1 ORDER BY 1`,
      [condoId, days]
    );

    // Perguntas sem resposta: a pergunta do morador que antecede cada "não encontrei". Sem nomes.
    const { rows: unanswered } = await query(
      `SELECT q.content AS question, a.created_at, COALESCE(c.display_name, c.name) AS condo_name
         FROM messages a
         JOIN conversations v ON v.id = a.conversation_id
         JOIN condos c ON c.id = v.condo_id
         JOIN LATERAL (
           SELECT content FROM messages u
            WHERE u.conversation_id = a.conversation_id AND u.role = 'user' AND u.created_at <= a.created_at
            ORDER BY u.created_at DESC LIMIT 1
         ) q ON true
        WHERE a.outcome = 'not_found' AND a.created_at > now() - make_interval(days => $2)
          AND ($1::uuid IS NULL OR v.condo_id = $1)
        ORDER BY a.created_at DESC
        LIMIT 20`,
      [condoId, days]
    );

    res.json({ days, totals: { ...totals[0], avg_response_seconds: timing[0]?.avg_seconds ?? null }, daily, unanswered });
  } catch (e) {
    console.error("usage error:", e);
    res.status(500).json({ error: "Não foi possível carregar os indicadores." });
  }
});

export default router;
