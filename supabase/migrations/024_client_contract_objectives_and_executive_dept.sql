-- Allow Executive Department (department = 'executive') to see IT page and delete clients.
-- Add client contract upload, objectives (posts), and due date.

-- Tasks: allow Executive Department to SELECT
DROP POLICY IF EXISTS "IT tasks select" ON public.it_department_tasks;
CREATE POLICY "IT tasks select"
  ON public.it_department_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );

-- Task assignees: allow Executive Department to SELECT
DROP POLICY IF EXISTS "IT task assignees select executive" ON public.it_department_task_assignees;
CREATE POLICY "IT task assignees select executive"
  ON public.it_department_task_assignees FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (position = 'executive' OR department = 'executive'))
  );

-- Subtasks: allow Executive Department to SELECT
DROP POLICY IF EXISTS "IT subtasks select executive" ON public.it_department_subtasks;
CREATE POLICY "IT subtasks select executive"
  ON public.it_department_subtasks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (position = 'executive' OR department = 'executive'))
  );

-- Activity: allow Executive Department to SELECT
DROP POLICY IF EXISTS "IT activity select executive" ON public.it_department_activity;
CREATE POLICY "IT activity select executive"
  ON public.it_department_activity FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (position = 'executive' OR department = 'executive'))
  );

-- Comments: allow Executive Department to SELECT
DROP POLICY IF EXISTS "IT comments select executive" ON public.it_department_comments;
CREATE POLICY "IT comments select executive"
  ON public.it_department_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (position = 'executive' OR department = 'executive'))
  );

-- Clients: allow Executive Department to SELECT and DELETE (in addition to position = 'executive')
DROP POLICY IF EXISTS "IT clients select" ON public.it_department_clients;
CREATE POLICY "IT clients select"
  ON public.it_department_clients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );

DROP POLICY IF EXISTS "IT clients delete executive only" ON public.it_department_clients;
CREATE POLICY "IT clients delete executive only"
  ON public.it_department_clients FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (position = 'executive' OR department = 'executive')
    )
  );

-- Client contract (PDF/.docx), objectives (posts to finish), due date
ALTER TABLE public.it_department_clients
  ADD COLUMN IF NOT EXISTS contract_url TEXT,
  ADD COLUMN IF NOT EXISTS objectives_target INT,
  ADD COLUMN IF NOT EXISTS objectives_done INT,
  ADD COLUMN IF NOT EXISTS due_date DATE;

COMMENT ON COLUMN public.it_department_clients.contract_url IS 'Storage URL for contract file (PDF or .docx)';
COMMENT ON COLUMN public.it_department_clients.objectives_target IS 'Number of posts/objectives to finish';
COMMENT ON COLUMN public.it_department_clients.objectives_done IS 'Number of objectives completed';
COMMENT ON COLUMN public.it_department_clients.due_date IS 'Due date for client/contract';

-- Storage bucket for client contracts (create in Dashboard if this fails: name client-contracts, public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-contracts', 'client-contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Client contracts: IT and Executive (by position or department) can read/upload/update/delete
CREATE POLICY "Client contracts select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-contracts'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );

CREATE POLICY "Client contracts insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-contracts'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );

CREATE POLICY "Client contracts update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'client-contracts'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );

CREATE POLICY "Client contracts delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-contracts'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.department = 'it' OR p.department = 'executive' OR p.position = 'executive')
    )
  );
