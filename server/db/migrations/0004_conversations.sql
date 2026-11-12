-- Fase 3: conversas do morador com o assistente, histórico e preferências.

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id uuid NOT NULL REFERENCES condos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON conversations(user_id, condo_id, updated_at DESC);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  -- Só para respostas: como a pergunta foi tratada.
  outcome text CHECK (outcome IN ('answered','not_found','out_of_scope','error')),
  intent text,
  sources jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'assistant') = (outcome IS NOT NULL))
);
CREATE INDEX messages_conversation_idx ON messages(conversation_id, created_at);

-- Preferências da experiência (tamanho do texto, movimento reduzido…), por conta.
ALTER TABLE users ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}';
