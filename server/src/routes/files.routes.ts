import { Router } from "express";
import { query } from "../db.js";

/**
 * Imagens de identidade (logotipo e capa) servidas por URL, para uso direto em <img>.
 * São públicas por natureza (aparecem na busca de condomínios) e imutáveis: cada envio gera um id novo.
 * Documentos NÃO passam por aqui: o original só sai por /api/documents/:id/file, com autenticação.
 */
const router = Router();

router.get("/:id", async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(404).end();
    const { rows } = await query(`SELECT mime, data FROM files WHERE id = $1 AND kind IN ('logo', 'cover')`, [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    res.setHeader("Content-Type", rows[0].mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.send(rows[0].data);
  } catch (e) {
    console.error("get file error:", e);
    res.status(500).end();
  }
});

export default router;
