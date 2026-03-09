-- Departments (Executive, Admin, IT, ESL) assigned by HR on Total Employees.
-- Clients IT Department: tasks, clients, assignees, subtasks, activity, comments.

-- Department assignment on profile (HR assigns on Total Employees page)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_department_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_department_check
  CHECK (department IS NULL OR department IN ('executive', 'admin', 'it', 'esl'));

COMMENT ON COLUMN public.profiles.department IS 'Assigned by HR: executive, admin, it, esl. Used for IT to see Clients IT Department page.';

-- Allow CEO/Executive/HR to update any profile (for department and other admin fields)
CREATE POLICY "Profiles update by admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.position IN ('ceo', 'executive', 'hr')
    )
  )
  WITH CHECK (true);

-- Clients (for IT Department task monitoring)
CREATE TABLE IF NOT EXISTS public.it_department_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.it_department_clients ENABLE ROW LEVEL SECURITY;

-- Only IT department members can manage clients
CREATE POLICY "IT clients select"
  ON public.it_department_clients FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT clients insert"
  ON public.it_department_clients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT clients update"
  ON public.it_department_clients FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT clients delete"
  ON public.it_department_clients FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );

-- Tasks (ClickUp-style: status, assignees, due date, priority, client)
CREATE TABLE IF NOT EXISTS public.it_department_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed')),
  priority TEXT CHECK (priority IS NULL OR priority IN ('low', 'normal', 'high', 'urgent')),
  due_date DATE,
  client_id UUID REFERENCES public.it_department_clients(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_it_tasks_status ON public.it_department_tasks(status);
CREATE INDEX idx_it_tasks_client ON public.it_department_tasks(client_id);
CREATE INDEX idx_it_tasks_updated ON public.it_department_tasks(updated_at DESC);

ALTER TABLE public.it_department_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT tasks select"
  ON public.it_department_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT tasks insert"
  ON public.it_department_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT tasks update"
  ON public.it_department_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
CREATE POLICY "IT tasks delete"
  ON public.it_department_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );

-- Task assignees (many-to-many)
CREATE TABLE IF NOT EXISTS public.it_department_task_assignees (
  task_id UUID NOT NULL REFERENCES public.it_department_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.it_department_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT task assignees all"
  ON public.it_department_task_assignees FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );

-- Subtasks
CREATE TABLE IF NOT EXISTS public.it_department_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.it_department_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_it_subtasks_task ON public.it_department_subtasks(task_id);

ALTER TABLE public.it_department_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT subtasks all"
  ON public.it_department_subtasks FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );

-- Activity log (for task detail panel)
CREATE TABLE IF NOT EXISTS public.it_department_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.it_department_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_it_activity_task ON public.it_department_activity(task_id);

ALTER TABLE public.it_department_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT activity all"
  ON public.it_department_activity FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );

-- Comments
CREATE TABLE IF NOT EXISTS public.it_department_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.it_department_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_it_comments_task ON public.it_department_comments(task_id);

ALTER TABLE public.it_department_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT comments all"
  ON public.it_department_comments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND department = 'it')
  );
