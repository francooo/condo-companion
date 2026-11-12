-- Fase 5: configuração do assistente de cada condomínio.

CREATE TABLE agent_settings (
  condo_id uuid PRIMARY KEY REFERENCES condos(id) ON DELETE CASCADE,
  -- NULL = usar o padrão (ex.: "Assistente <condomínio>").
  name text,
  greeting text,
  personality text,
  language text NOT NULL DEFAULT 'pt-BR' CHECK (language IN ('pt-BR', 'en', 'es')),
  tone text NOT NULL DEFAULT 'amigavel' CHECK (tone IN ('amigavel', 'formal', 'objetivo')),
  suggestions text[] NOT NULL DEFAULT '{}',
  avatar_icon text NOT NULL DEFAULT 'sparkles' CHECK (avatar_icon IN ('sparkles', 'building', 'message', 'bot', 'key', 'home')),
  -- Liberado aos moradores. Condomínios novos começam desligados.
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Condomínios que já existem continuam com o assistente funcionando como antes.
INSERT INTO agent_settings (condo_id, enabled) SELECT id, true FROM condos;
