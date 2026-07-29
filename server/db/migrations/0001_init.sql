CREATE TABLE condos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  identifier text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  google_id text UNIQUE,
  condo_id uuid REFERENCES condos(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'resident' CHECK (role IN ('superadmin','admin','resident')),
  full_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);
CREATE INDEX users_condo_id_idx ON users(condo_id);

CREATE TABLE financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id uuid NOT NULL REFERENCES condos(id) ON DELETE CASCADE,
  date date NOT NULL,
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('income','expense')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX financial_records_condo_date_idx ON financial_records(condo_id, date DESC);

CREATE TABLE knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id uuid NOT NULL REFERENCES condos(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(content,'') || ' ' || coalesce(metadata->>'summary',''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_base_condo_id_idx ON knowledge_base(condo_id);
CREATE INDEX knowledge_base_search_idx ON knowledge_base USING GIN(search_vector);
