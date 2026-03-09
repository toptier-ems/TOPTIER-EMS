-- Executives can see Clients IT Department; only executives can remove clients.

-- Clients: executives can SELECT; only executives can DELETE (IT keeps INSERT/UPDATE)
DROP POLICY IF EXISTS "IT clients select" ON public.it_department_clients;
CREATE POLICY "IT clients select"
  ON public.it_department_clients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.position = 'executive')
    )
  );

DROP POLICY IF EXISTS "IT clients delete" ON public.it_department_clients;
CREATE POLICY "IT clients delete executive only"
  ON public.it_department_clients FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position = 'executive')
  );

-- Tasks: executives can SELECT (and see the page data)
DROP POLICY IF EXISTS "IT tasks select" ON public.it_department_tasks;
CREATE POLICY "IT tasks select"
  ON public.it_department_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.position = 'executive')
    )
  );

-- Task assignees: executives can SELECT
DROP POLICY IF EXISTS "IT task assignees all" ON public.it_department_task_assignees;
CREATE POLICY "IT task assignees it"
  ON public.it_department_task_assignees FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT task assignees select executive"
  ON public.it_department_task_assignees FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position = 'executive')
  );

-- Subtasks: executives can SELECT
DROP POLICY IF EXISTS "IT subtasks all" ON public.it_department_subtasks;
CREATE POLICY "IT subtasks it"
  ON public.it_department_subtasks FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT subtasks select executive"
  ON public.it_department_subtasks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position = 'executive')
  );

-- Activity: executives can SELECT (for "what happened yesterday")
DROP POLICY IF EXISTS "IT activity all" ON public.it_department_activity;
CREATE POLICY "IT activity it"
  ON public.it_department_activity FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT activity select executive"
  ON public.it_department_activity FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position = 'executive')
  );

-- Comments: executives can SELECT
DROP POLICY IF EXISTS "IT comments all" ON public.it_department_comments;
CREATE POLICY "IT comments it"
  ON public.it_department_comments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT comments select executive"
  ON public.it_department_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position = 'executive')
  );
