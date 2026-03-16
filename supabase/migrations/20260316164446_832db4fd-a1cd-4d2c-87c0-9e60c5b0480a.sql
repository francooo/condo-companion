CREATE POLICY "anyone_authenticated_can_read_condos"
ON public.condos FOR SELECT
TO authenticated
USING (true);