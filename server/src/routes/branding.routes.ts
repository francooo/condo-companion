import express, { Router, type Request, type Response } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logActivity } from "../lib/activity.js";
import { MAX_IMAGE_BYTES, brandingColumns, normalizeColor, sniffImage, toBranding } from "../lib/branding.js";

/** Personalização visual do condomínio: nome de exibição, cores, logotipo e capa. */
const router = Router();

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const IMAGE_SLOTS = { logo: "logo_file_id", cover: "cover_file_id" } as const;
type Slot = keyof typeof IMAGE_SLOTS;

/** Admin só personaliza o próprio condomínio; a plataforma, qualquer um. Fora do escopo = 404. */
function inScope(req: Request) {
  const id = req.params.id;
  if (!isUuid(id)) return null;
  if (req.user!.role === "superadmin" || req.user!.condo_id === id) return id;
  return null;
}

async function loadBranding(condoId: string) {
  const { rows } = await query(
    `SELECT c.id, c.name, ${brandingColumns("c")}, c.branding_updated_at, u.full_name AS branding_updated_by_name
       FROM condos c LEFT JOIN users u ON u.id = c.branding_updated_by
      WHERE c.id = $1`,
    [condoId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    condo_id: r.id,
    name: r.name,
    ...toBranding(r),
    updated_at: r.branding_updated_at,
    updated_by_name: r.branding_updated_by_name,
  };
}

const notFound = (res: Response) => res.status(404).json({ error: "Condomínio não encontrado." });

router.get("/:id/branding", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const id = inScope(req);
    const branding = id && (await loadBranding(id));
    if (!branding) return notFound(res);
    res.json({ branding });
  } catch (e) {
    console.error("get branding error:", e);
    res.status(500).json({ error: "Não foi possível carregar a personalização." });
  }
});

router.put("/:id/branding", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const id = inScope(req);
    if (!id) return notFound(res);
    const primary = normalizeColor(req.body?.primary_color);
    const secondary = normalizeColor(req.body?.secondary_color);
    if (primary === undefined || secondary === undefined) return res.status(400).json({ error: "Use cores no formato #RRGGBB." });
    const display = String(req.body?.display_name ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null;

    const { rowCount } = await query(
      `UPDATE condos SET display_name = $2, primary_color = $3, secondary_color = $4,
              branding_updated_at = now(), branding_updated_by = $5
        WHERE id = $1`,
      [id, display, primary, secondary, req.user!.id]
    );
    if (!rowCount) return notFound(res);
    await logActivity({ condoId: id, actorId: req.user!.id, type: "branding.updated" });
    res.json({ branding: await loadBranding(id) });
  } catch (e) {
    console.error("update branding error:", e);
    res.status(500).json({ error: "Não foi possível salvar a personalização." });
  }
});

/** Envia logotipo ou capa (PNG, JPEG ou WebP, até 2 MB). O arquivo anterior é apagado. */
router.put(
  "/:id/branding/:slot",
  requireAuth,
  requireRole("admin", "superadmin"),
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  async (req: Request, res: Response) => {
    try {
      const id = inScope(req);
      if (!id) return notFound(res);
      const slot = req.params.slot as Slot;
      if (!(slot in IMAGE_SLOTS)) return res.status(404).json({ error: "Imagem desconhecida." });
      const data = req.body;
      if (!Buffer.isBuffer(data) || data.length === 0) return res.status(400).json({ error: "Arquivo vazio." });
      const mime = sniffImage(data);
      if (!mime) return res.status(400).json({ error: "Use uma imagem PNG, JPEG ou WebP." });

      const column = IMAGE_SLOTS[slot];
      const { rows: prev } = await query(`SELECT ${column} AS file_id FROM condos WHERE id = $1`, [id]);
      if (!prev[0]) return notFound(res);
      const { rows } = await query(`INSERT INTO files (condo_id, kind, mime, size, data) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
        id,
        slot,
        mime,
        data.length,
        data,
      ]);
      await query(`UPDATE condos SET ${column} = $2, branding_updated_at = now(), branding_updated_by = $3 WHERE id = $1`, [
        id,
        rows[0].id,
        req.user!.id,
      ]);
      if (prev[0].file_id) await query(`DELETE FROM files WHERE id = $1`, [prev[0].file_id]);
      await logActivity({ condoId: id, actorId: req.user!.id, type: "branding.updated", payload: { image: slot } });
      res.json({ branding: await loadBranding(id) });
    } catch (e) {
      console.error("upload branding image error:", e);
      res.status(500).json({ error: "Não foi possível enviar a imagem." });
    }
  }
);

router.delete("/:id/branding/:slot", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const id = inScope(req);
    if (!id) return notFound(res);
    const slot = req.params.slot as Slot;
    if (!(slot in IMAGE_SLOTS)) return res.status(404).json({ error: "Imagem desconhecida." });
    const column = IMAGE_SLOTS[slot];
    const { rows } = await query(
      `UPDATE condos c SET ${column} = NULL, branding_updated_at = now(), branding_updated_by = $2
         FROM (SELECT ${column} AS old FROM condos WHERE id = $1) o
        WHERE c.id = $1 RETURNING o.old`,
      [id, req.user!.id]
    );
    if (!rows[0]) return notFound(res);
    if (rows[0].old) await query(`DELETE FROM files WHERE id = $1`, [rows[0].old]);
    res.json({ branding: await loadBranding(id) });
  } catch (e) {
    console.error("delete branding image error:", e);
    res.status(500).json({ error: "Não foi possível remover a imagem." });
  }
});

/** Volta à identidade padrão do Condo App: limpa nome de exibição, cores e imagens. */
router.post("/:id/branding/restore", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  try {
    const id = inScope(req);
    if (!id) return notFound(res);
    const { rows } = await query(
      `UPDATE condos c SET display_name = NULL, primary_color = NULL, secondary_color = NULL,
              logo_file_id = NULL, cover_file_id = NULL, branding_updated_at = now(), branding_updated_by = $2
         FROM (SELECT logo_file_id AS logo, cover_file_id AS cover FROM condos WHERE id = $1) o
        WHERE c.id = $1 RETURNING o.logo, o.cover`,
      [id, req.user!.id]
    );
    if (!rows[0]) return notFound(res);
    const old = [rows[0].logo, rows[0].cover].filter(Boolean);
    if (old.length) await query(`DELETE FROM files WHERE id = ANY($1::uuid[])`, [old]);
    await logActivity({ condoId: id, actorId: req.user!.id, type: "branding.restored" });
    res.json({ branding: await loadBranding(id) });
  } catch (e) {
    console.error("restore branding error:", e);
    res.status(500).json({ error: "Não foi possível restaurar o padrão." });
  }
});

export default router;
