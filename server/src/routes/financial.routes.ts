import { Router } from "express";
import { query, pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/categories", requireAuth, async (req, res) => {
  const { rows } = await query(
    "SELECT DISTINCT category FROM financial_records WHERE condo_id = $1 ORDER BY category",
    [req.user!.condo_id]
  );
  res.json({ categories: rows.map((r: any) => r.category) });
});

router.get("/", requireAuth, async (req, res) => {
  const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "15"), 10) || 15));
  const category = req.query.category && req.query.category !== "all" ? String(req.query.category) : null;

  const params: unknown[] = [req.user!.condo_id];
  let where = "WHERE condo_id = $1";
  if (category) {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }

  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM financial_records ${where}`, params);
  params.push(pageSize, page * pageSize);
  const { rows } = await query(
    `SELECT * FROM financial_records ${where} ORDER BY date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ records: rows, total: countRows[0].count });
});

router.post("/bulk", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const condoId = req.user!.condo_id;
  if (!condoId) return res.status(400).json({ error: "Usuário não vinculado a um condomínio." });

  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "Nenhum registro para importar." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of records) {
      await client.query(
        `INSERT INTO financial_records (condo_id, date, category, description, amount, type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [condoId, r.date, r.category, r.description, r.amount, r.type]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, count: records.length });
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("bulk financial insert error:", e);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
