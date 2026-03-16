
-- Create helper functions to avoid RLS recursion
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
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_condo_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT condo_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Fix profiles RLS policies to avoid recursion
DROP POLICY IF EXISTS "superadmin_all_profiles" ON public.profiles;
CREATE POLICY "superadmin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "admins_read_condo_profiles" ON public.profiles;
CREATE POLICY "admins_read_condo_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (condo_id = public.get_my_condo_id() AND public.get_my_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "admins_update_condo_profiles" ON public.profiles;
CREATE POLICY "admins_update_condo_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (condo_id = public.get_my_condo_id() AND public.get_my_role() = 'admin')
  WITH CHECK (condo_id = public.get_my_condo_id() AND public.get_my_role() = 'admin');

-- Fix condos RLS policies
DROP POLICY IF EXISTS "superadmin_all_condos" ON public.condos;
CREATE POLICY "superadmin_all_condos" ON public.condos
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "users_read_own_condo" ON public.condos;
CREATE POLICY "users_read_own_condo" ON public.condos
  FOR SELECT TO authenticated
  USING (id = public.get_my_condo_id());

-- Fix financial_records RLS policies
DROP POLICY IF EXISTS "superadmin_all_financial" ON public.financial_records;
CREATE POLICY "superadmin_all_financial" ON public.financial_records
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "admins_manage_financial" ON public.financial_records;
CREATE POLICY "admins_manage_financial" ON public.financial_records
  FOR ALL TO authenticated
  USING (condo_id = public.get_my_condo_id() AND public.get_my_role() = 'admin')
  WITH CHECK (condo_id = public.get_my_condo_id() AND public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "residents_read_financial" ON public.financial_records;
CREATE POLICY "residents_read_financial" ON public.financial_records
  FOR SELECT TO authenticated
  USING (condo_id = public.get_my_condo_id());

-- Fix knowledge_base RLS policies
DROP POLICY IF EXISTS "superadmin_all_knowledge" ON public.knowledge_base;
CREATE POLICY "superadmin_all_knowledge" ON public.knowledge_base
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "admins_manage_knowledge" ON public.knowledge_base;
CREATE POLICY "admins_manage_knowledge" ON public.knowledge_base
  FOR ALL TO authenticated
  USING (condo_id = public.get_my_condo_id() AND public.get_my_role() = 'admin')
  WITH CHECK (condo_id = public.get_my_condo_id() AND public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "residents_read_knowledge" ON public.knowledge_base;
CREATE POLICY "residents_read_knowledge" ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (condo_id = public.get_my_condo_id());
