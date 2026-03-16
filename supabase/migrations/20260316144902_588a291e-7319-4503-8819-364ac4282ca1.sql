
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Condos table
CREATE TABLE public.condos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  identifier TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.condos ENABLE ROW LEVEL SECURITY;

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  condo_id UUID REFERENCES public.condos(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'resident',
  full_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Financial records table
CREATE TABLE public.financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id UUID NOT NULL REFERENCES public.condos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'expense',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- 4. Knowledge base table with vector embeddings
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id UUID NOT NULL REFERENCES public.condos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding extensions.vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Condos: superadmin can do everything, others can read their own
CREATE POLICY "superadmin_all_condos" ON public.condos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  );

CREATE POLICY "users_read_own_condo" ON public.condos
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT condo_id FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- Profiles: users can read own profile, admins can read/update condo profiles
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "admins_read_condo_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "admins_update_condo_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "superadmin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  );

-- Financial records: admins can insert/read for their condo, residents can read
CREATE POLICY "admins_manage_financial" ON public.financial_records
  FOR ALL TO authenticated
  USING (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "residents_read_financial" ON public.financial_records
  FOR SELECT TO authenticated
  USING (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "superadmin_all_financial" ON public.financial_records
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  );

-- Knowledge base: admins can manage, residents can read their condo
CREATE POLICY "admins_manage_knowledge" ON public.knowledge_base
  FOR ALL TO authenticated
  USING (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "residents_read_knowledge" ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (
    condo_id IN (
      SELECT p.condo_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "superadmin_all_knowledge" ON public.knowledge_base
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin')
  );

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'resident',
    true
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- get_my_profile RPC
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id UUID,
  condo_id UUID,
  role TEXT,
  full_name TEXT,
  active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.condo_id, p.role, p.full_name, p.active
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- match_knowledge_base RPC for vector similarity search
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding TEXT,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5,
  filter_condo_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding::extensions.vector) AS similarity
  FROM public.knowledge_base kb
  WHERE
    (filter_condo_id IS NULL OR kb.condo_id = filter_condo_id)
    AND 1 - (kb.embedding <=> query_embedding::extensions.vector) > match_threshold
  ORDER BY kb.embedding <=> query_embedding::extensions.vector
  LIMIT match_count;
END;
$$;
