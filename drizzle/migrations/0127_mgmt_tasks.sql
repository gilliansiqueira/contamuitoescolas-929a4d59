CREATE OR REPLACE FUNCTION public.can_use_mgmt_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND permission = 'gestao_tarefas')
$$;

CREATE OR REPLACE FUNCTION public.mgmt_task_members()
RETURNS TABLE(user_id uuid, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text FROM public.user_permissions p JOIN auth.users u ON u.id = p.user_id
  WHERE p.permission = 'gestao_tarefas' AND public.can_use_mgmt_tasks() ORDER BY u.email
$$;

CREATE TABLE public.mgmt_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  assignee_id uuid NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  due_date date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','andamento','concluida')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mgmt_tasks TO authenticated;
GRANT ALL ON public.mgmt_tasks TO service_role;
ALTER TABLE public.mgmt_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestão usa tarefas" ON public.mgmt_tasks FOR ALL TO authenticated
  USING (public.can_use_mgmt_tasks()) WITH CHECK (public.can_use_mgmt_tasks());
CREATE POLICY "Empresa restrita" ON public.mgmt_tasks AS RESTRICTIVE FOR ALL TO authenticated
  USING (school_id IS NULL OR public.can_see_school(school_id))
  WITH CHECK (school_id IS NULL OR public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.mgmt_task_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status <> 'concluida') THEN NEW.completed_at := now();
  ELSIF NEW.status <> 'concluida' THEN NEW.completed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mgmt_task_stamp BEFORE INSERT OR UPDATE ON public.mgmt_tasks FOR EACH ROW EXECUTE FUNCTION public.mgmt_task_stamp();

CREATE TABLE public.mgmt_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.mgmt_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.mgmt_task_comments TO authenticated;
GRANT ALL ON public.mgmt_task_comments TO service_role;
ALTER TABLE public.mgmt_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestão lê comentários" ON public.mgmt_task_comments FOR SELECT TO authenticated
  USING (public.can_use_mgmt_tasks() AND EXISTS (SELECT 1 FROM public.mgmt_tasks t WHERE t.id = task_id));
CREATE POLICY "Gestão comenta" ON public.mgmt_task_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_use_mgmt_tasks() AND user_id = auth.uid());
CREATE POLICY "Apaga o próprio" ON public.mgmt_task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());