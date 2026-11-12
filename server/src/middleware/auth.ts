import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import { query } from "../db.js";

export type MembershipStatus = "pending" | "approved" | "rejected" | "suspended" | null;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  condo_id: string | null;
  full_name: string | null;
  active: boolean;
  membership_status: MembershipStatus;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function loadUser(req: Request, res: Response): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  try {
    const payload = verifyToken(token);
    const { rows } = await query<AuthUser>(
      "SELECT id, email, role, condo_id, full_name, active, membership_status FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.active) {
      res.status(401).json({ error: "Conta inválida ou desativada" });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return null;
  }
}

/** Vínculo aprovado com um condomínio (ou administração da plataforma). */
export function hasApprovedMembership(user: AuthUser) {
  return user.role === "superadmin" || (Boolean(user.condo_id) && user.membership_status === "approved");
}

/**
 * Qualquer conta ativa, mesmo sem vínculo aprovado.
 * Usar só em rotas do próprio usuário (perfil, solicitação de vínculo).
 */
export async function requireAccount(req: Request, res: Response, next: NextFunction) {
  const user = await loadUser(req, res);
  if (!user) return;
  req.user = user;
  next();
}

/**
 * Conta ativa com vínculo aprovado. Padrão para tudo que lê ou escreve dados de um condomínio:
 * quem está aguardando aprovação, recusado ou suspenso não acessa o condomínio solicitado.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await loadUser(req, res);
  if (!user) return;
  if (!hasApprovedMembership(user)) {
    return res.status(403).json({ error: "Seu vínculo com o condomínio ainda não foi aprovado.", code: "membership_required" });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}
