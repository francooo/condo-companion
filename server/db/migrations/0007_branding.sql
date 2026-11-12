-- Fase 6: identidade visual de cada condomínio.

ALTER TABLE condos
  -- Nome mostrado no app; `name` continua sendo o nome de cadastro.
  ADD COLUMN display_name text,
  ADD COLUMN primary_color text CHECK (primary_color ~ '^#[0-9A-F]{6}$'),
  ADD COLUMN secondary_color text CHECK (secondary_color ~ '^#[0-9A-F]{6}$'),
  ADD COLUMN logo_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  ADD COLUMN cover_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  ADD COLUMN branding_updated_at timestamptz,
  ADD COLUMN branding_updated_by uuid REFERENCES users(id) ON DELETE SET NULL;
