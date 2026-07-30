import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import { query } from "../db.js";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  condo_id: string | null;
  full_name: string | null;
  active: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    const payload = verifyToken(token);
    const { rows } = await query<AuthUser>(
      "SELECT id, email, role, condo_id, full_name, active FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.active) {
      return res.status(401).json({ error: "Conta inválida ou desativada" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}
