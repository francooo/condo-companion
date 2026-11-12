-- Fase 7: cadastro completo do condomínio e índices para indicadores de uso.

ALTER TABLE condos
  ADD COLUMN cnpj text,
  ADD COLUMN description text,
  ADD COLUMN contact_name text,
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX conversations_condo_created_idx ON conversations(condo_id, created_at DESC);
CREATE INDEX messages_created_idx ON messages(created_at);
