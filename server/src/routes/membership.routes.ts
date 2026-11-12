import { Router } from "express";
import { query } from "../db.js";
import { requireAccount, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
const clean = (v: unknown, max = 80) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/** Erro do Postgres para UUID malformado: tratamos como "não encontrado". */
const isInvalidUuid = (e: any) => e?.code === "22P02";

/** Situação do vínculo do usuário logado, com o condomínio solicitado/vinculado. */
router.get("/me/membership", requireAccount, async (req, res) => {
  const { rows } = await query(
    `SELECT u.membership_status AS status, u.unit, u.block, u.requested_at, u.decided_at, u.decision_reason,
            u.terms_accepted_at IS NOT NULL AS terms_accepted,
            c.id AS condo_id, c.name AS condo_name, c.address, c.city, c.state
       FROM users u LEFT JOIN condos c ON c.id = u.condo_id
      WHERE u.id = $1`,
    [req.user!.id]
  );
  const r = rows[0];
  res.json({
    membership: {
      status: r.status,
      unit: r.unit,
      block: r.block,
      requested_at: r.requested_at,
      decided_at: r.decided_at,
      decision_reason: r.decision_reason,
      terms_accepted: r.terms_accepted,
      condo: r.condo_id ? { id: r.condo_id, name: r.condo_name, address: r.address, city: r.city, state: r.state } : null,
    },
  });
});

/**
 * Solicita vínculo com um condomínio. Não concede acesso: o vínculo fica "pending"
 * até a administração daquele condomínio aprovar.
 */
router.post("/me/membership-request", requireAccount, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "resident") {
      return res.status(400).json({ error: "Apenas moradores solicitam vínculo." });
    }
    if (user.membership_status === "pending" || user.membership_status === "approved" || user.membership_status === "suspended") {
      return res.status(409).json({ error: "Você já tem um vínculo ou uma solicitação em andamento." });
    }

    const condoId = clean(req.body.condo_id, 64);
    const unit = clean(req.body.unit, 40);
    if (!condoId || !unit) return res.status(400).json({ error: "Condomínio e unidade são obrigatórios." });

    const { rows: condoRows } = await query("SELECT id FROM condos WHERE id = $1 AND status = 'active'", [condoId]);
    if (!condoRows[0]) return res.status(404).json({ error: "Condomínio não encontrado." });

    const { rows: termsRows } = await query("SELECT terms_accepted_at FROM users WHERE id = $1", [user.id]);
    if (!termsRows[0].terms_accepted_at && req.body.accept_terms !== true) {
      return res.status(400).json({ error: "É preciso aceitar os termos de uso para solicitar acesso." });
    }

    await query(
      `UPDATE users
          SET condo_id = $2, membership_status = 'pending', unit = $3, block = $4, invite_code = $5,
              requested_at = now(), decided_at = NULL, decided_by = NULL, decision_reason = NULL,
              terms_accepted_at = COALESCE(terms_accepted_at, now())
        WHERE id = $1`,
      [user.id, condoId, unit, clean(req.body.block, 40), clean(req.body.invite_code, 40)]
    );
    res.json({ success: true });
  } catch (e: any) {
    if (isInvalidUuid(e)) return res.status(404).json({ error: "Condomínio não encontrado." });
    console.error("membership request error:", e);
    res.status(500).json({ error: e.message });
  }
});

/** Cancela uma solicitação pendente (ou limpa uma recusa) para escolher outro condomínio. */
router.delete("/me/membership-request", requireAccount, async (req, res) => {
  const { rowCount } = await query(
    `UPDATE users
        SET condo_id = NULL, membership_status = NULL, unit = NULL, block = NULL, invite_code = NULL,
            requested_at = NULL, decided_at = NULL, decided_by = NULL, decision_reason = NULL
      WHERE id = $1 AND role = 'resident' AND membership_status IN ('pending', 'rejected')`,
    [req.user!.id]
  );
  if (rowCount === 0) return res.status(409).json({ error: "Não há solicitação para cancelar." });
  res.json({ success: true });
});

/**
 * Fila de solicitações. A administração do condomínio vê apenas o próprio condomínio;
 * a administração da plataforma vê todos (ou filtra por ?condo_id=).
 */
router.get("/access-requests", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const status = REQUEST_STATUSES.includes(req.query.status as any) ? String(req.query.status) : "pending";
  const params: unknown[] = [status];
  let where = "u.role = 'resident' AND u.membership_status = $1 AND u.requested_at IS NOT NULL";

  if (req.user!.role === "superadmin") {
    if (typeof req.query.condo_id === "string") {
      params.push(req.query.condo_id);
      where += ` AND u.condo_id = $${params.length}`;
    }
  } else {
    params.push(req.user!.condo_id);
    where += ` AND u.condo_id = $${params.length}`;
  }

  if (typeof req.query.condo_id === "string" && !/^[0-9a-f-]{36}$/i.test(req.query.condo_id)) {
    return res.json({ requests: [] });
  }
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.unit, u.block, u.invite_code, u.membership_status AS status,
            u.requested_at, u.decided_at, u.decision_reason, c.id AS condo_id, c.name AS condo_name
       FROM users u JOIN condos c ON c.id = u.condo_id
      WHERE ${where}
      ORDER BY ${status === "pending" ? "u.requested_at ASC" : "u.decided_at DESC NULLS LAST"}
      LIMIT 200`,
    params
  );
  res.json({ requests: rows });
});

async function decide(req: any, res: any, status: "approved" | "rejected") {
  try {
    await applyDecision(req, res, status);
  } catch (e: any) {
    if (isInvalidUuid(e)) return res.status(404).json({ error: "Solicitação não encontrada." });
    console.error("access request decision error:", e);
    res.status(500).json({ error: e.message });
  }
}

async function applyDecision(req: any, res: any, status: "approved" | "rejected") {
  const reason = status === "rejected" ? clean(req.body?.reason, 500) : null;
  const params: unknown[] = [req.params.id, status, req.user!.id, reason];
  let scope = "";
  if (req.user!.role !== "superadmin") {
    params.push(req.user!.condo_id);
    scope = ` AND condo_id = $${params.length}`;
  }
  const { rowCount } = await query(
    `UPDATE users SET membership_status = $2, decided_at = now(), decided_by = $3, decision_reason = $4
      WHERE id = $1 AND role = 'resident' AND membership_status = 'pending'${scope}`,
    params
  );
  if (rowCount === 0) return res.status(404).json({ error: "Solicitação não encontrada ou já analisada." });
  res.json({ success: true });
}

router.post("/access-requests/:id/approve", requireAuth, requireRole("admin", "superadmin"), (req, res) => decide(req, res, "approved"));
router.post("/access-requests/:id/reject", requireAuth, requireRole("admin", "superadmin"), (req, res) => decide(req, res, "rejected"));

export default router;
