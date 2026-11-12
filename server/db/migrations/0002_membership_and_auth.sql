-- Fase 1: vínculo com aprovação, dados de cadastro e recuperação de senha.

-- Endereço do condomínio (busca pública por nome/endereço/bairro) e status
ALTER TABLE condos
  ADD COLUMN address text,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Vínculo do usuário com o condomínio passa a exigir aprovação.
-- membership_status é NULL quando não há condomínio solicitado.
ALTER TABLE users
  ADD COLUMN phone text,
  ADD COLUMN unit text,
  ADD COLUMN block text,
  ADD COLUMN invite_code text,
  ADD COLUMN membership_status text DEFAULT 'approved'
    CHECK (membership_status IN ('pending', 'approved', 'rejected', 'suspended')),
  ADD COLUMN requested_at timestamptz,
  ADD COLUMN decided_at timestamptz,
  ADD COLUMN decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN decision_reason text,
  ADD COLUMN terms_accepted_at timestamptz;

-- Contas existentes já vinculadas continuam aprovadas; as sem condomínio ficam sem vínculo.
UPDATE users SET membership_status = NULL WHERE condo_id IS NULL AND role <> 'superadmin';

ALTER TABLE users
  ADD CONSTRAINT users_membership_consistency
  CHECK (role = 'superadmin' OR (condo_id IS NULL) = (membership_status IS NULL));

CREATE INDEX users_condo_membership_idx ON users(condo_id, membership_status);

CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets(user_id, created_at DESC);
