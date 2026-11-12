import { Router } from "express";
import { query } from "../db.js";
import { requireAccount, requireAuth, requireRole } from "../middleware/auth.js";
import { brandingColumns, fileUrl, toBranding } from "../lib/branding.js";
import { logActivity } from "../lib/activity.js";
import { loadAgent, loadReadiness } from "../lib/agent.js";

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

const UF = /^[A-Z]{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida os campos do cadastro. Devolve os valores limpos ou a mensagem de erro. */
function parseCondo(body: Record<string, unknown>) {
  const name = clean(body.name, 120);
  if (!name) return { error: "Informe o nome do condomínio." };
  const state = clean(body.state, 2)?.toUpperCase() ?? null;
  if (state && !UF.test(state)) return { error: "Estado deve ser a sigla com 2 letras (ex.: SP)." };
  const cnpjDigits = String(body.cnpj ?? "").replace(/\D/g, "");
  if (cnpjDigits && cnpjDigits.length !== 14) return { error: "CNPJ deve ter 14 dígitos." };
  const email = clean(body.contact_email, 160)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) return { error: "E-mail de contato inválido." };
  const phoneDigits = String(body.contact_phone ?? "").replace(/\D/g, "");
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) return { error: "Telefone de contato inválido." };
  return {
    value: {
      name,
      cnpj: cnpjDigits ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : null,
      address: clean(body.address),
      city: clean(body.city, 80),
      state,
      description: clean(body.description, 500),
      contact_name: clean(body.contact_name, 120),
      contact_email: email,
      contact_phone: clean(body.contact_phone, 30),
    },
  };
}

const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

router.post("/", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const { value, error } = parseCondo(req.body ?? {});
    if (!value) return res.status(400).json({ error });
    const identifier = slugify(String(req.body.identifier || value.name));
    if (!identifier) return res.status(400).json({ error: "Identificador inválido." });

    const { rows } = await query(
      `INSERT INTO condos (name, identifier, cnpj, address, city, state, description, contact_name, contact_email, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [value.name, identifier, value.cnpj, value.address, value.city, value.state, value.description, value.contact_name, value.contact_email, value.contact_phone]
    );
    await logActivity({ condoId: rows[0].id, actorId: req.user!.id, type: "condo.created", payload: { name: value.name } });
    res.status(201).json({ condo: await loadCondoDetail(rows[0].id) });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") return res.status(400).json({ error: "Identificador já em uso." });
    console.error("create condo error:", e);
    res.status(500).json({ error: "Não foi possível cadastrar o condomínio." });
  }
});

/** Cadastro, identidade e números de um condomínio. */
async function loadCondoDetail(id: string) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.identifier, c.cnpj, c.address, c.city, c.state, c.description, c.contact_name,
            c.contact_email, c.contact_phone, c.status, c.created_at, c.updated_at,
            ${brandingColumns("c")},
            (SELECT COUNT(*)::int FROM users u WHERE u.condo_id = c.id AND u.role = 'resident' AND u.membership_status = 'approved') AS resident_count,
            (SELECT COUNT(*)::int FROM users u WHERE u.condo_id = c.id AND u.membership_status = 'pending') AS pending_count,
            (SELECT COUNT(*)::int FROM users u WHERE u.condo_id = c.id AND u.role = 'admin') AS admin_count,
            (SELECT COUNT(*)::int FROM documents d WHERE d.condo_id = c.id) AS doc_count,
            (SELECT COUNT(*)::int FROM conversations v WHERE v.condo_id = c.id AND v.created_at > now() - interval '30 days') AS conversations_30d
       FROM condos c WHERE c.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  const agent = await loadAgent(id);
  const readiness = await loadReadiness(id, agent?.enabled ?? false);
  const { display_name, primary_color, secondary_color, logo_file_id, cover_file_id, ...rest } = r;
  return {
    ...rest,
    branding: toBranding({ display_name, primary_color, secondary_color, logo_file_id, cover_file_id }),
    agent: { name: agent?.name, enabled: readiness.enabled, status: readiness.status, documents_available: readiness.counts.available },
  };
}

/** Admin vê o próprio condomínio; a plataforma, qualquer um. */
router.get("/:id", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id) || (req.user!.role !== "superadmin" && req.user!.condo_id !== id)) {
      return res.status(404).json({ error: "Condomínio não encontrado." });
    }
    const condo = await loadCondoDetail(id);
    if (!condo) return res.status(404).json({ error: "Condomínio não encontrado." });
    res.json({ condo });
  } catch (e) {
    console.error("get condo error:", e);
    res.status(500).json({ error: "Não foi possível carregar o condomínio." });
  }
});

router.put("/:id", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(404).json({ error: "Condomínio não encontrado." });
    const { value, error } = parseCondo(req.body ?? {});
    if (!value) return res.status(400).json({ error });
    const status = req.body.status === undefined ? null : String(req.body.status);
    if (status && status !== "active" && status !== "inactive") return res.status(400).json({ error: "Situação inválida." });

    const { rowCount } = await query(
      `UPDATE condos SET name = $2, cnpj = $3, address = $4, city = $5, state = $6, description = $7,
              contact_name = $8, contact_email = $9, contact_phone = $10, status = COALESCE($11, status), updated_at = now()
        WHERE id = $1`,
      [id, value.name, value.cnpj, value.address, value.city, value.state, value.description, value.contact_name, value.contact_email, value.contact_phone, status]
    );
    if (!rowCount) return res.status(404).json({ error: "Condomínio não encontrado." });
    await logActivity({ condoId: id, actorId: req.user!.id, type: "condo.updated", payload: status ? { status } : {} });
    res.json({ condo: await loadCondoDetail(id) });
  } catch (e) {
    console.error("update condo error:", e);
    res.status(500).json({ error: "Não foi possível salvar o condomínio." });
  }
});

/** Administradores (síndicos) do condomínio. */
router.get("/:id/admins", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: "Condomínio não encontrado." });
    const { rows } = await query(
      `SELECT id, full_name, email, phone, active, created_at FROM users
        WHERE condo_id = $1 AND role = 'admin' ORDER BY full_name NULLS LAST, email`,
      [req.params.id]
    );
    res.json({ admins: rows });
  } catch (e) {
    console.error("list condo admins error:", e);
    res.status(500).json({ error: "Não foi possível carregar os administradores." });
  }
});

export default router;
