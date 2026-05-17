CREATE POLICY "anon_can_read_condos"
ON public.condos
FOR SELECT
TO anon
USING (true);