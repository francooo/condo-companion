import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { query } from "../db.js";
import { hashPassword, verifyPassword, signToken, signState, verifyState } from "../lib/auth.js";
import { buildGoogleAuthUrl, exchangeCodeForProfile } from "../lib/google-oauth.js";
import { frontendUrl, sendMail } from "../lib/mail.js";
import { requireAccount } from "../middleware/auth.js";

const router = Router();

const MIN_PASSWORD = 6;
const RESET_TTL_MINUTES = 60;

/** Dados do usuário expostos ao cliente (inclui o nome do condomínio vinculado/solicitado). */
export async function loadPublicUser(id: string) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.condo_id, u.role, u.full_name, u.active, u.phone, u.unit, u.block,
            u.membership_status, u.preferences, (u.password_hash IS NOT NULL) AS has_password, c.name AS condo_name
       FROM users u LEFT JOIN condos c ON c.id = u.condo_id
      WHERE u.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

const normalizeEmail = (email: unknown) => String(email ?? "").trim().toLowerCase();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

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
       RETURNING id, role, condo_id`,
      [normalizeEmail(email), passwordHash, full_name || "Superadmin"]
    );

    const token = signToken({ sub: rows[0].id, role: rows[0].role, condo_id: rows[0].condo_id });
    res.json({ token, user: await loadPublicUser(rows[0].id) });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("bootstrap-superadmin error:", e);
    res.status(500).json({ error: e.message });
  }
});

/** Login por e-mail e senha. O condomínio vem do vínculo da conta; não é informado no login. */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const { rows } = await query("SELECT id, role, condo_id, password_hash, active FROM users WHERE email = $1", [
      normalizeEmail(email),
    ]);
    const user = rows[0];
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }
    if (!user.active) return res.status(403).json({ error: "Sua conta está desativada. Contate a administração do condomínio." });

    const token = signToken({ sub: user.id, role: user.role, condo_id: user.condo_id });
    res.json({ token, user: await loadPublicUser(user.id) });
  } catch (e: any) {
    console.error("login error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Cadastro de morador. A conta nasce sem vínculo: o condomínio é escolhido depois,
 * em uma solicitação que a administração precisa aprovar.
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, full_name, phone, accept_terms } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }
    if (String(password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: `A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.` });
    }
    if (accept_terms !== true) {
      return res.status(400).json({ error: "É preciso aceitar os termos de uso para criar a conta." });
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, condo_id, role, full_name, phone, active, membership_status, terms_accepted_at)
       VALUES ($1, $2, NULL, 'resident', $3, $4, true, NULL, now())
       RETURNING id, role, condo_id`,
      [normalizeEmail(email), passwordHash, String(full_name).trim(), phone ? String(phone).trim() : null]
    );

    const token = signToken({ sub: rows[0].id, role: rows[0].role, condo_id: rows[0].condo_id });
    res.json({ token, user: await loadPublicUser(rows[0].id) });
  } catch (e: any) {
    if (e.code === "23505") return res.status(400).json({ error: "E-mail já cadastrado." });
    console.error("signup error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/me", requireAccount, async (req, res) => {
  res.json({ user: await loadPublicUser(req.user!.id) });
});

/** Sempre responde 200, exista ou não a conta, para não revelar quais e-mails estão cadastrados. */
router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: "Informe seu e-mail." });

    const { rows } = await query("SELECT id, full_name, active FROM users WHERE email = $1", [email]);
    const user = rows[0];

    if (user?.active) {
      // Evita disparos repetidos: no máximo um link por minuto por conta.
      const { rows: recent } = await query(
        "SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 minute'",
        [user.id]
      );
      if (recent.length === 0) {
        const token = randomBytes(32).toString("hex");
        await query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
          [user.id, hashToken(token), String(RESET_TTL_MINUTES)]
        );
        const link = `${frontendUrl()}/redefinir-senha/${token}`;
        await sendMail({
          to: email,
          subject: "Redefinição de senha · Condo App",
          text:
            `Olá${user.full_name ? `, ${user.full_name}` : ""}!\n\n` +
            `Recebemos um pedido para redefinir a senha da sua conta. Use o link abaixo em até ${RESET_TTL_MINUTES} minutos:\n\n` +
            `${link}\n\nSe você não fez este pedido, ignore este e-mail.`,
        });
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error("forgot-password error:", e);
    res.status(500).json({ error: "Não foi possível processar a solicitação agora. Tente novamente." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
    if (String(password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: `A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.` });
    }

    const { rows } = await query(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [hashToken(String(token))]
    );
    const reset = rows[0];
    if (!reset) return res.status(400).json({ error: "Link inválido ou expirado. Solicite uma nova recuperação." });

    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), reset.user_id]);
    // Invalida este e quaisquer outros links pendentes da mesma conta.
    await query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [reset.user_id]);

    res.json({ success: true });
  } catch (e: any) {
    console.error("reset-password error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/google", (_req, res) => {
  res.redirect(buildGoogleAuthUrl(signState({})));
});

router.get("/google/callback", async (req, res) => {
  const front = frontendUrl();
  try {
    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string") {
      throw new Error("Parâmetros inválidos");
    }

    verifyState(state);
    const profile = await exchangeCodeForProfile(code);
    if (!profile.emailVerified) throw new Error("E-mail do Google não verificado");

    let { rows } = await query("SELECT id, role, condo_id, active FROM users WHERE google_id = $1", [profile.googleId]);
    let user = rows[0];

    if (!user) {
      ({ rows } = await query("SELECT id, role, condo_id, active FROM users WHERE email = $1", [profile.email]));
      user = rows[0];

      if (user) {
        await query("UPDATE users SET google_id = $1 WHERE id = $2", [profile.googleId, user.id]);
      } else {
        // Conta nova sem vínculo: o morador escolhe o condomínio e aguarda aprovação.
        ({ rows } = await query(
          // Os termos são aceitos depois, na solicitação de vínculo.
          `INSERT INTO users (email, google_id, condo_id, role, full_name, active, membership_status)
           VALUES ($1, $2, NULL, 'resident', $3, true, NULL)
           RETURNING id, role, condo_id, active`,
          [profile.email, profile.googleId, profile.name]
        ));
        user = rows[0];
      }
    }

    if (!user.active) throw new Error("Sua conta está desativada. Contate a administração do condomínio.");

    const token = signToken({ sub: user.id, role: user.role, condo_id: user.condo_id });
    res.redirect(`${front}/auth/callback#token=${token}`);
  } catch (e: any) {
    console.error("google callback error:", e);
    res.redirect(`${front}/login?error=${encodeURIComponent(e.message || "Erro ao entrar com Google")}`);
  }
});

export default router;
