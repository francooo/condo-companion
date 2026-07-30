import { Router } from "express";
import { query } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/residents", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const condoId = req.user!.condo_id;
  if (!condoId) return res.json({ residents: [] });
  const { rows } = await query(
    "SELECT id, full_name, role, active, created_at FROM users WHERE condo_id = $1 ORDER BY created_at DESC",
    [condoId]
  );
  res.json({ residents: rows });
});

router.post("/residents", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const { email, password, full_name, condo_id } = req.body;
    const targetCondoId = req.user!.role === "superadmin" ? condo_id : req.user!.condo_id;
    if (!targetCondoId) return res.status(400).json({ error: "condo_id é obrigatório" });

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, condo_id, role, full_name, active)
       VALUES ($1, $2, $3, 'resident', $4, true)
       RETURNING id`,
      [String(email).trim().toLowerCase(), passwordHash, targetCondoId, full_name]
    );
    res.json({ success: true, user_id: rows[0].id });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("create resident error:", e);
    res.status(400).json({ error: e.message });
  }
});

router.patch("/residents/:id", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const { active } = req.body;
  const params: unknown[] = [active, req.params.id];
  let sql = "UPDATE users SET active = $1 WHERE id = $2";
  if (req.user!.role !== "superadmin") {
    sql += " AND condo_id = $3";
    params.push(req.user!.condo_id);
  }
  const { rowCount } = await query(sql, params);
  if (rowCount === 0) return res.status(404).json({ error: "Morador não encontrado" });
  res.json({ success: true });
});

router.post("/admins", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const { email, password, full_name, condo_id } = req.body;
    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, condo_id, role, full_name, active)
       VALUES ($1, $2, $3, 'admin', $4, true)
       RETURNING id`,
      [String(email).trim().toLowerCase(), passwordHash, condo_id, full_name]
    );
    res.json({ success: true, user_id: rows[0].id });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("create admin error:", e);
    res.status(400).json({ error: e.message });
  }
});

router.post("/me/condo", requireAuth, async (req, res) => {
  try {
    const { identifier } = req.body;
    const { rows: condoRows } = await query("SELECT id, name FROM condos WHERE identifier = $1", [
      String(identifier).trim().toLowerCase(),
    ]);
    const condo = condoRows[0];
    if (!condo) return res.status(404).json({ error: "Condomínio não encontrado. Verifique o identificador." });

    const { rowCount } = await query(
      "UPDATE users SET condo_id = $1 WHERE id = $2 AND condo_id IS NULL",
      [condo.id, req.user!.id]
    );
    if (rowCount === 0) return res.status(400).json({ error: "Usuário já está vinculado a um condomínio." });

    res.json({ success: true, condo });
  } catch (e: any) {
    console.error("link condo error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
