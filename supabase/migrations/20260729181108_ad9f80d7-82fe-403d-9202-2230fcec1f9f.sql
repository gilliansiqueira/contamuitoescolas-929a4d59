CREATE TABLE public.projection_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projection_notes TO authenticated;
GRANT SELECT ON public.projection_notes TO anon;
GRANT ALL ON public.projection_notes TO service_role;

ALTER TABLE public.projection_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projection_notes_select" ON public.projection_notes
FOR SELECT TO authenticated
USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id) OR public.is_demo_school(school_id));

CREATE POLICY "projection_notes_select_anon" ON public.projection_notes
FOR SELECT TO anon
USING (public.is_demo_school(school_id));

CREATE POLICY "projection_notes_insert" ON public.projection_notes
FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));

CREATE POLICY "projection_notes_update" ON public.projection_notes
FOR UPDATE TO authenticated
USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id))
WITH CHECK (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));

CREATE POLICY "projection_notes_delete" ON public.projection_notes
FOR DELETE TO authenticated
USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));

CREATE TRIGGER projection_notes_touch_updated_at
BEFORE UPDATE ON public.projection_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();