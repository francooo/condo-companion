import { Router } from "express";
import { query } from "../db.js";
import { requireAccount } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";
import { loadPublicUser } from "./auth.routes.js";
import { sanitizePreferences } from "../lib/chat-utils.js";

/** Dados da própria conta: perfil, senha e preferências da experiência. Vale mesmo sem vínculo aprovado. */
const router = Router();

const MIN_PASSWORD = 6;
router.patch("/me", requireAccount, async (req, res) => {
  try {
    const sets: string[] = [];
    const params: unknown[] = [req.user!.id];
    if (req.body.full_name !== undefined) {
      const name = String(req.body.full_name ?? "").trim().slice(0, 120);
      if (name.length < 2) return res.status(400).json({ error: "Informe seu nome completo." });
      params.push(name);
      sets.push(`full_name = $${params.length}`);
    }
    if (req.body.phone !== undefined) {
      const phone = String(req.body.phone ?? "").trim().slice(0, 30);
      if (phone && phone.replace(/\D/g, "").length < 10) return res.status(400).json({ error: "Celular inválido." });
      params.push(phone || null);
      sets.push(`phone = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: "Nada para atualizar." });
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1`, params);
    res.json({ user: await loadPublicUser(req.user!.id) });
  } catch (e) {
    console.error("update me error:", e);
    res.status(500).json({ error: "Não foi possível salvar o perfil." });
  }
});

router.post("/me/password", requireAccount, async (req, res) => {
  try {
    const current = String(req.body.current_password ?? "");
    const next = String(req.body.new_password ?? "");
    if (next.length < MIN_PASSWORD) return res.status(400).json({ error: `A nova senha precisa de ao menos ${MIN_PASSWORD} caracteres.` });

    const { rows } = await query<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
    const hash = rows[0]?.password_hash;
    // Conta criada pelo Google não tem senha: a primeira é definida sem a atual.
    if (hash && !(await verifyPassword(current, hash))) return res.status(400).json({ error: "A senha atual não confere." });

    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.user!.id, await hashPassword(next)]);
    res.json({ success: true });
  } catch (e) {
    console.error("change password error:", e);
    res.status(500).json({ error: "Não foi possível alterar a senha." });
  }
});

router.patch("/me/preferences", requireAccount, async (req, res) => {
  try {
    const prefs = sanitizePreferences(req.body);
    if (!prefs) return res.status(400).json({ error: "Preferências inválidas." });
    await query(`UPDATE users SET preferences = preferences || $2::jsonb WHERE id = $1`, [req.user!.id, JSON.stringify(prefs)]);
    res.json({ user: await loadPublicUser(req.user!.id) });
  } catch (e) {
    console.error("update preferences error:", e);
    res.status(500).json({ error: "Não foi possível salvar as preferências." });
  }
});

export default router;
