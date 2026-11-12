import { Router } from "express";
import { query } from "../db.js";
import { requireAccount, requireAuth, requireRole } from "../middleware/auth.js";
import { fileUrl } from "../lib/branding.js";

const router = Router();

const PUBLIC_FIELDS = "id, COALESCE(display_name, name) AS name, address, city, state, primary_color, logo_file_id";
/** Dados de identificação + logotipo e cor, para os cartões da busca. */
const publicCondo = ({ logo_file_id, ...c }: Record<string, unknown>) => ({ ...c, logo_url: fileUrl(logo_file_id as string | null) });
const clean = (v: unknown, max = 160) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Busca de condomínios para quem vai solicitar vínculo (nome, endereço ou cidade).
 * Exige conta logada e devolve só dados de identificação; encontrar não concede acesso.
 */
router.get("/search", requireAccount, async (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 80);
  const params: unknown[] = [];
  let where = "status = 'active'";
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, "\\$&")}%`);
    where += ` AND (name ILIKE $1 OR display_name ILIKE $1 OR identifier ILIKE $1 OR address ILIKE $1 OR city ILIKE $1)`;
  }
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM condos WHERE ${where} ORDER BY 2 LIMIT 30`, params);
  res.json({ condos: rows.map(publicCondo) });
});

router.get("/:id/summary", requireAccount, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: "Condomínio não encontrado." });
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM condos WHERE id = $1 AND status = 'active'`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Condomínio não encontrado." });
  res.json({ condo: publicCondo(rows[0]) });
});

router.get("/", requireAuth, requireRole("superadmin"), async (_req, res) => {
  const { rows } = await query(`
    SELECT c.*,
           COALESCE(kb.doc_count, 0)::int AS doc_count,
           COALESCE(m.residents, 0)::int AS resident_count,
           COALESCE(m.pending, 0)::int AS pending_count
      FROM condos c
      LEFT JOIN (SELECT condo_id, COUNT(*) AS doc_count FROM documents GROUP BY condo_id) kb ON kb.condo_id = c.id
      LEFT JOIN (
        SELECT condo_id,
               COUNT(*) FILTER (WHERE membership_status = 'approved') AS residents,
               COUNT(*) FILTER (WHERE membership_status = 'pending') AS pending
          FROM users WHERE role = 'resident' GROUP BY condo_id
      ) m ON m.condo_id = c.id
     ORDER BY c.created_at DESC
  `);
  res.json({ condos: rows.map(({ logo_file_id, cover_file_id, ...c }) => ({ ...c, logo_url: fileUrl(logo_file_id), cover_url: fileUrl(cover_file_id) })) });
});

router.post("/", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const name = clean(req.body.name, 120);
    const identifier = clean(req.body.identifier, 80)?.toLowerCase().replace(/\s+/g, "-");
    if (!name || !identifier) return res.status(400).json({ error: "Nome e identificador são obrigatórios." });

    const { rows } = await query(
      `INSERT INTO condos (name, identifier, address, city, state)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, identifier, clean(req.body.address), clean(req.body.city, 80), clean(req.body.state, 2)?.toUpperCase() ?? null]
    );
    res.json({ condo: { ...rows[0], doc_count: 0, resident_count: 0, pending_count: 0 } });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "Identificador já em uso." });
    console.error("create condo error:", e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
