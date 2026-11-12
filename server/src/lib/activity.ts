import { query } from "../db.js";

export type ActivityType =
  | "membership.requested"
  | "membership.cancelled"
  | "membership.approved"
  | "membership.rejected"
  | "membership.suspended"
  | "membership.reactivated"
  | "membership.removed"
  | "membership.added";

/**
 * Registra um evento no histórico. Falhar aqui não deve desfazer a ação principal
 * (que já foi gravada): o erro só é registrado no log.
 */
export async function logActivity(event: {
  condoId: string | null;
  actorId?: string | null;
  subjectUserId?: string | null;
  type: ActivityType;
  payload?: Record<string, unknown>;
}) {
  try {
    await query(
      `INSERT INTO activity_events (condo_id, actor_id, subject_user_id, type, payload) VALUES ($1, $2, $3, $4, $5)`,
      [event.condoId, event.actorId ?? null, event.subjectUserId ?? null, event.type, JSON.stringify(event.payload ?? {})]
    );
  } catch (e) {
    console.error("activity log error:", e);
  }
}
