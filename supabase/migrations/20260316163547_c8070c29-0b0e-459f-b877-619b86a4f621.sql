CREATE POLICY "users_set_own_condo"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() AND condo_id IS NULL)
WITH CHECK (id = auth.uid());