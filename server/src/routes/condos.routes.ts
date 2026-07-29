import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/lookup", async (req, res) => {
  const identifier = String(req.query.identifier || "").trim().toLowerCase();
  if (!identifier) return res.status(400).json({ error: "identifier é obrigatório" });
  const { rows } = await query("SELECT id, name FROM condos WHERE identifier = $1", [identifier]);
  if (!rows[0]) return res.status(404).json({ error: "Condomínio não encontrado" });
  res.json({ condo: rows[0] });
});

router.get("/", requireAuth, requireRole("superadmin"), async (_req, res) => {
  const { rows } = await query(`
    SELECT c.*, COALESCE(kb.doc_count, 0)::int AS doc_count
    FROM condos c
    LEFT JOIN (
      SELECT condo_id, COUNT(*) AS doc_count FROM knowledge_base GROUP BY condo_id
    ) kb ON kb.condo_id = c.id
    ORDER BY c.created_at DESC
  `);
  res.json({ condos: rows });
});

router.post("/", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const { name, identifier } = req.body;
    const { rows } = await query(
      "INSERT INTO condos (name, identifier) VALUES ($1, $2) RETURNING *",
      [String(name).trim(), String(identifier).trim().toLowerCase().replace(/\s+/g, "-")]
    );
    res.json({ condo: { ...rows[0], doc_count: 0 } });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "Identificador já em uso." });
    console.error("create condo error:", e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
