-- Fase 4: histórico de vínculo (e base da "atividade recente") e data de aprovação estável.

CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id uuid REFERENCES condos(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Pessoa afetada (ex.: o morador aprovado). Some junto com a conta.
  subject_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_condo_idx ON activity_events(condo_id, created_at DESC);
CREATE INDEX activity_events_subject_idx ON activity_events(subject_user_id, created_at DESC);

-- "Membro desde": não muda quando o acesso é suspenso ou reativado.
ALTER TABLE users ADD COLUMN approved_at timestamptz;
UPDATE users
   SET approved_at = COALESCE(decided_at, created_at)
 WHERE membership_status IN ('approved', 'suspended');

-- Backfill do histórico com o que já se sabe de cada vínculo.
INSERT INTO activity_events (condo_id, actor_id, subject_user_id, type, payload, created_at)
SELECT condo_id, id, id, 'membership.requested', jsonb_build_object('unit', unit, 'block', block), requested_at
  FROM users
 WHERE requested_at IS NOT NULL AND condo_id IS NOT NULL;

INSERT INTO activity_events (condo_id, actor_id, subject_user_id, type, payload, created_at)
SELECT condo_id, decided_by, id, 'membership.' || membership_status,
       CASE WHEN decision_reason IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('reason', decision_reason) END,
       decided_at
  FROM users
 WHERE decided_at IS NOT NULL AND condo_id IS NOT NULL AND membership_status IN ('approved', 'rejected');
