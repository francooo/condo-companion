import { Router, type Request, type Response } from "express";
import { query } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import { logActivity, type ActivityType } from "../lib/activity.js";

const router = Router();

const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/** Admin fica no próprio condomínio; o administrador da plataforma informa `condo_id`. */
function scopeFor(user: AuthUser, requested: unknown): string | null {
  if (user.role === "superadmin") return isUuid(requested) ? String(requested) : null;
  return user.condo_id;
}

const RESIDENT_FIELDS = `u.id, u.full_name, u.email, u.phone, u.unit, u.block, u.role, u.active, u.membership_status,
  u.created_at, u.requested_at, u.decided_at, u.decision_reason, COALESCE(u.approved_at, u.created_at) AS member_since`;

/**
 * Pessoas do condomínio: aprovadas, suspensas e aguardando análise.
 * Pedidos recusados ficam só na fila de solicitações.
 */
router.get("/residents", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const condoId = scopeFor(req.user!, req.query.condo_id);
  if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
  const { rows } = await query(
    `SELECT ${RESIDENT_FIELDS}
       FROM users u
      WHERE u.condo_id = $1 AND u.membership_status IN ('approved', 'suspended', 'pending')
      ORDER BY u.full_name NULLS LAST, u.email`,
    [condoId]
  );
  res.json({ residents: rows });
});

/** Carrega uma pessoa do condomínio no escopo de quem pergunta; fora dele, "não encontrado". */
async function loadMember(user: AuthUser, id: string) {
  if (!isUuid(id)) return null;
  const { rows } = await query(
    `SELECT ${RESIDENT_FIELDS}, u.condo_id, c.name AS condo_name, d.full_name AS decided_by_name
       FROM users u
       JOIN condos c ON c.id = u.condo_id
       LEFT JOIN users d ON d.id = u.decided_by
      WHERE u.id = $1 AND u.membership_status IS NOT NULL`,
    [id]
  );
  const member = rows[0];
  if (!member) return null;
  if (user.role !== "superadmin" && member.condo_id !== user.condo_id) return null;
  return member;
}

router.get("/residents/:id", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const member = await loadMember(req.user!, req.params.id);
    if (!member) return res.status(404).json({ error: "Morador não encontrado." });
    // Histórico deste vínculo: só eventos do condomínio atual da pessoa.
    const { rows: events } = await query(
      `SELECT e.id, e.type, e.payload, e.created_at, a.full_name AS actor_name, (e.actor_id = e.subject_user_id) AS by_self
         FROM activity_events e LEFT JOIN users a ON a.id = e.actor_id
        WHERE e.subject_user_id = $1 AND e.condo_id = $2 AND e.type LIKE 'membership.%'
        ORDER BY e.created_at DESC
        LIMIT 100`,
      [member.id, member.condo_id]
    );
    res.json({ resident: member, events });
  } catch (e) {
    console.error("get resident error:", e);
    res.status(500).json({ error: "Não foi possível carregar o morador." });
  }
});

type Transition = {
  from: string[];
  type: ActivityType;
  /** SQL do SET (parâmetros: $1 id, $2 autor, $3 motivo; "reactivate" usa $1–$2 e "remove" só $1). */
  set: string;
  conflict: string;
};

const TRANSITIONS: Record<"suspend" | "reactivate" | "remove", Transition> = {
  suspend: {
    from: ["approved"],
    type: "membership.suspended",
    set: `membership_status = 'suspended', decided_at = now(), decided_by = $2, decision_reason = $3`,
    conflict: "Só é possível suspender um morador com acesso ativo.",
  },
  reactivate: {
    from: ["suspended"],
    type: "membership.reactivated",
    set: `membership_status = 'approved', active = true, decided_at = now(), decided_by = $2, decision_reason = NULL,
          approved_at = COALESCE(approved_at, now())`,
    conflict: "Só é possível reativar um morador suspenso.",
  },
  remove: {
    from: ["approved", "suspended"],
    type: "membership.removed",
    // A conta continua existindo: a pessoa pode solicitar vínculo com outro condomínio.
    set: `condo_id = NULL, membership_status = NULL, unit = NULL, block = NULL, invite_code = NULL,
          requested_at = NULL, decided_at = NULL, decided_by = NULL, decision_reason = NULL, approved_at = NULL`,
    conflict: "Só é possível remover um morador vinculado.",
  },
};

async function transition(req: Request, res: Response, action: keyof typeof TRANSITIONS) {
  try {
    const user = req.user!;
    const t = TRANSITIONS[action];
    const member = await loadMember(user, req.params.id);
    if (!member) return res.status(404).json({ error: "Morador não encontrado." });
    if (member.role !== "resident") return res.status(403).json({ error: "Administradores do condomínio são geridos pela plataforma." });
    if (member.id === user.id) return res.status(403).json({ error: "Você não pode alterar o próprio vínculo." });
    if (!t.from.includes(member.membership_status)) return res.status(409).json({ error: t.conflict });

    const reason = clean(req.body?.reason, 500);
    // Cada SET usa só os parâmetros de que precisa (o Postgres recusa parâmetro sem uso e sem tipo).
    const params = action === "remove" ? [member.id] : action === "reactivate" ? [member.id, user.id] : [member.id, user.id, reason];
    const { rowCount } = await query(
      `UPDATE users SET ${t.set} WHERE id = $1 AND membership_status = ANY($${params.length + 1}::text[])`,
      [...params, t.from]
    );
    if (!rowCount) return res.status(409).json({ error: t.conflict });

    await logActivity({
      condoId: member.condo_id,
      actorId: user.id,
      subjectUserId: member.id,
      type: t.type,
      payload: reason ? { reason } : {},
    });
    if (action === "remove") return res.json({ resident: null });
    res.json({ resident: await loadMember(user, member.id) });
  } catch (e) {
    console.error(`resident ${action} error:`, e);
    res.status(500).json({ error: "Não foi possível atualizar o vínculo." });
  }
}

router.post("/residents/:id/suspend", requireAuth, requireRole("admin", "superadmin"), (req, res) => transition(req, res, "suspend"));
router.post("/residents/:id/reactivate", requireAuth, requireRole("admin", "superadmin"), (req, res) => transition(req, res, "reactivate"));
router.post("/residents/:id/remove", requireAuth, requireRole("admin", "superadmin"), (req, res) => transition(req, res, "remove"));

/** Cadastro direto pela administração: a conta já nasce com vínculo aprovado. */
router.post("/residents", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const condoId = scopeFor(req.user!, req.body.condo_id);
    if (!condoId) return res.status(400).json({ error: "Informe o condomínio (condo_id)." });
    const email = clean(req.body.email, 160)?.toLowerCase();
    const fullName = clean(req.body.full_name, 120);
    const password = String(req.body.password ?? "");
    const unit = clean(req.body.unit, 40);
    if (!email || !fullName) return res.status(400).json({ error: "Nome e e-mail são obrigatórios." });
    if (password.length < 6) return res.status(400).json({ error: "A senha inicial precisa de ao menos 6 caracteres." });
    if (!unit) return res.status(400).json({ error: "Informe a unidade do morador." });

    const { rows } = await query(
      `INSERT INTO users (email, password_hash, condo_id, role, full_name, active, membership_status, unit, block,
                          decided_at, decided_by, approved_at)
       VALUES ($1, $2, $3, 'resident', $4, true, 'approved', $5, $6, now(), $7, now())
       RETURNING id`,
      [email, await hashPassword(password), condoId, fullName, unit, clean(req.body.block, 40), req.user!.id]
    );
    await logActivity({
      condoId,
      actorId: req.user!.id,
      subjectUserId: rows[0].id,
      type: "membership.added",
      payload: { unit, block: clean(req.body.block, 40) },
    });
    res.status(201).json({ success: true, user_id: rows[0].id });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    if (code === "23503") return res.status(404).json({ error: "Condomínio não encontrado." });
    console.error("create resident error:", e);
    res.status(500).json({ error: "Não foi possível cadastrar o morador." });
  }
});

router.post("/admins", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const { email, password, full_name, condo_id } = req.body;
    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, condo_id, role, full_name, active, approved_at)
       VALUES ($1, $2, $3, 'admin', $4, true, now())
       RETURNING id`,
      [String(email).trim().toLowerCase(), passwordHash, condo_id, full_name]
    );
    res.json({ success: true, user_id: rows[0].id });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("create admin error:", e);
    res.status(400).json({ error: (e as Error).message });
  }
});

export default router;
