
-- 1. Create condos table
CREATE TABLE public.condos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  identifier text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.condos ENABLE ROW LEVEL SECURITY;

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  condo_id uuid REFERENCES public.condos(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'resident' CHECK (role IN ('superadmin', 'admin', 'resident')),
  full_name text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Add condo_id to knowledge_base
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS condo_id uuid REFERENCES public.condos(id) ON DELETE CASCADE;

-- 4. Add condo_id to financial_records
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS condo_id uuid REFERENCES public.condos(id) ON DELETE CASCADE;

-- 5. Security definer function to get user profile without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(id uuid, condo_id uuid, role text, full_name text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.condo_id, p.role, p.full_name, p.active
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- 6. Security definer: check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  )
$$;

-- 7. Security definer: get user's condo_id
CREATE OR REPLACE FUNCTION public.get_my_condo_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT condo_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 8. Security definer: check if user is admin of their condo
CREATE OR REPLACE FUNCTION public.is_condo_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- 9. Drop existing RLS policies on knowledge_base
DROP POLICY IF EXISTS "Anyone can delete knowledge_base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Anyone can insert knowledge_base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Anyone can read knowledge_base" ON public.knowledge_base;

-- 10. Drop existing RLS policies on financial_records
DROP POLICY IF EXISTS "Anyone can delete financial_records" ON public.financial_records;
DROP POLICY IF EXISTS "Anyone can insert financial_records" ON public.financial_records;
DROP POLICY IF EXISTS "Anyone can read financial_records" ON public.financial_records;

-- 11. RLS for condos
CREATE POLICY "Superadmin full access condos" ON public.condos FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Users read own condo" ON public.condos FOR SELECT TO authenticated
  USING (id = public.get_my_condo_id());

-- Allow anon to read condos for login slug lookup
CREATE POLICY "Anyone can lookup condos" ON public.condos FOR SELECT TO anon
  USING (true);

-- 12. RLS for profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Superadmin full access profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Admin reads profiles of own condo" ON public.profiles FOR SELECT TO authenticated
  USING (condo_id = public.get_my_condo_id() AND public.is_condo_admin());

CREATE POLICY "Admin manages profiles of own condo" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (condo_id = public.get_my_condo_id() AND public.is_condo_admin());

CREATE POLICY "Admin updates profiles of own condo" ON public.profiles FOR UPDATE TO authenticated
  USING (condo_id = public.get_my_condo_id() AND public.is_condo_admin())
  WITH CHECK (condo_id = public.get_my_condo_id() AND public.is_condo_admin());

-- 13. RLS for knowledge_base (condo isolation)
CREATE POLICY "Users read own condo knowledge" ON public.knowledge_base FOR SELECT TO authenticated
  USING (condo_id = public.get_my_condo_id() OR public.is_superadmin());

CREATE POLICY "Admin inserts knowledge" ON public.knowledge_base FOR INSERT TO authenticated
  WITH CHECK (condo_id = public.get_my_condo_id() AND (public.is_condo_admin() OR public.is_superadmin()));

CREATE POLICY "Admin deletes knowledge" ON public.knowledge_base FOR DELETE TO authenticated
  USING (condo_id = public.get_my_condo_id() AND (public.is_condo_admin() OR public.is_superadmin()));

-- 14. RLS for financial_records (condo isolation)
CREATE POLICY "Users read own condo financials" ON public.financial_records FOR SELECT TO authenticated
  USING (condo_id = public.get_my_condo_id() OR public.is_superadmin());

CREATE POLICY "Admin inserts financials" ON public.financial_records FOR INSERT TO authenticated
  WITH CHECK (condo_id = public.get_my_condo_id() AND (public.is_condo_admin() OR public.is_superadmin()));

CREATE POLICY "Admin deletes financials" ON public.financial_records FOR DELETE TO authenticated
  USING (condo_id = public.get_my_condo_id() AND (public.is_condo_admin() OR public.is_superadmin()));

-- 15. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16. Update match_knowledge_base to support condo_id filtering
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding text,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 5,
  filter_condo_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding::vector) AS similarity
  FROM public.knowledge_base kb
  WHERE 1 - (kb.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_condo_id IS NULL OR kb.condo_id = filter_condo_id)
  ORDER BY kb.embedding <=> query_embedding::vector
  LIMIT match_count;
$$;
