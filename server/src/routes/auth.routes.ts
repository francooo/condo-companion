import { Router } from "express";
import { query } from "../db";
import { hashPassword, verifyPassword, signToken, signState, verifyState } from "../lib/auth";
import { buildGoogleAuthUrl, exchangeCodeForProfile } from "../lib/google-oauth";
import { requireAuth } from "../middleware/auth";

const router = Router();

function publicUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    condo_id: row.condo_id,
    role: row.role,
    full_name: row.full_name,
    active: row.active,
  };
}

router.post("/bootstrap-superadmin", async (req, res) => {
  try {
    const { rows: countRows } = await query("SELECT COUNT(*)::int AS count FROM users");
    if (countRows[0].count > 0) {
      return res.status(403).json({ error: "Setup já realizado. Já existem usuários no sistema." });
    }

    const { email, password, full_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, role, full_name, active)
       VALUES ($1, $2, 'superadmin', $3, true)
       RETURNING id, email, condo_id, role, full_name, active`,
      [String(email).trim().toLowerCase(), passwordHash, full_name || "Superadmin"]
    );

    const user = rows[0];
    const token = signToken({ sub: user.id, role: user.role, condo_id: user.condo_id });
    res.json({ token, user: publicUser(user) });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("bootstrap-superadmin error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, condo_identifier } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const { rows } = await query("SELECT * FROM users WHERE email = $1", [
      String(email).trim().toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "E-mail ou senha inválidos." });
    if (!user.active) return res.status(403).json({ error: "Sua conta está desativada. Contate o síndico." });

    if (user.role !== "superadmin") {
      if (!condo_identifier || !String(condo_identifier).trim()) {
        return res.status(400).json({ error: "Informe o identificador do condomínio." });
      }

      const { rows: condoRows } = await query("SELECT id, name FROM condos WHERE identifier = $1", [
        String(condo_identifier).trim().toLowerCase(),
      ]);
      const condo = condoRows[0];
      if (!condo) return res.status(404).json({ error: "Condomínio não encontrado. Verifique o identificador." });
      if (user.condo_id !== condo.id) {
        return res.status(403).json({ error: "Você não pertence a este condomínio." });
      }
    }

    const token = signToken({ sub: user.id, role: user.role, condo_id: user.condo_id });
    res.json({ token, user: publicUser(user) });
  } catch (e: any) {
    console.error("login error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { email, password, full_name, condo_identifier } = req.body;
    if (!email || !password || !condo_identifier) {
      return res.status(400).json({ error: "E-mail, senha e identificador do condomínio são obrigatórios." });
    }

    const { rows: condoRows } = await query("SELECT id FROM condos WHERE identifier = $1", [
      String(condo_identifier).trim().toLowerCase(),
    ]);
    const condo = condoRows[0];
    if (!condo) return res.status(404).json({ error: "Condomínio não encontrado." });

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, condo_id, role, full_name, active)
       VALUES ($1, $2, $3, 'resident', $4, true)
       RETURNING id, email, condo_id, role, full_name, active`,
      [String(email).trim().toLowerCase(), passwordHash, condo.id, full_name || null]
    );

    const user = rows[0];
    const token = signToken({ sub: user.id, role: user.role, condo_id: user.condo_id });
    res.json({ token, user: publicUser(user) });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("signup error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = req.user!;
  let condoName: string | null = null;
  if (user.condo_id) {
    const { rows } = await query("SELECT name FROM condos WHERE id = $1", [user.condo_id]);
    condoName = rows[0]?.name ?? null;
  }
  res.json({ user: { ...publicUser(user), condo_name: condoName } });
});

router.get("/google", (req, res) => {
  const condoIdentifier = typeof req.query.condo_identifier === "string" ? req.query.condo_identifier : undefined;
  const state = signState({ condo_identifier: condoIdentifier });
  res.redirect(buildGoogleAuthUrl(state));
});

router.get("/google/callback", async (req, res) => {
  const frontendUrl = process.env.CORS_ORIGIN?.split(",")[0] ?? "http://localhost:8080";
  try {
    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string") {
      throw new Error("Parâmetros inválidos");
    }

    const { condo_identifier } = verifyState<{ condo_identifier?: string }>(state);
    const profile = await exchangeCodeForProfile(code);
    if (!profile.emailVerified) throw new Error("E-mail do Google não verificado");

    let { rows } = await query("SELECT * FROM users WHERE google_id = $1", [profile.googleId]);
    let user = rows[0];

    if (!user) {
      ({ rows } = await query("SELECT * FROM users WHERE email = $1", [profile.email]));
      user = rows[0];

      if (user) {
        await query("UPDATE users SET google_id = $1 WHERE id = $2", [profile.googleId, user.id]);
      } else {
        let condoId: string | null = null;
        if (condo_identifier) {
          const { rows: condoRows } = await query("SELECT id FROM condos WHERE identifier = $1", [
            condo_identifier.trim().toLowerCase(),
          ]);
          condoId = condoRows[0]?.id ?? null;
        }
        ({ rows } = await query(
          `INSERT INTO users (email, google_id, condo_id, role, full_name, active)
           VALUES ($1, $2, $3, 'resident', $4, true)
           RETURNING *`,
          [profile.email, profile.googleId, condoId, profile.name]
        ));
        user = rows[0];
      }
    }

    if (!user.active) throw new Error("Sua conta está desativada. Contate o síndico.");

    const token = signToken({ sub: user.id, role: user.role, condo_id: user.condo_id });
    res.redirect(`${frontendUrl}/auth/callback#token=${token}`);
  } catch (e: any) {
    console.error("google callback error:", e);
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(e.message || "Erro ao entrar com Google")}`);
  }
});

export default router;
