-- Allow Executive and Executive Department to UPDATE it_department_clients
-- (so edited objectives, due date, contract persist after refresh)

DROP POLICY IF EXISTS "IT clients update" ON public.it_department_clients;
CREATE POLICY "IT clients update"
  ON public.it_department_clients FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );
