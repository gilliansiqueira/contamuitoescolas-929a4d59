CREATE TABLE public.team_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT '🚨 Atenção equipe!',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_announcement_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.team_announcements(id) ON DELETE CASCADE,
  rotulo text NOT NULL,
  data date NOT NULL,
  ordem int NOT NULL DEFAULT 0
);
CREATE TABLE public.team_announcement_dismissals (
  user_id uuid NOT NULL,
  dia date NOT NULL,
  PRIMARY KEY (user_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_announcements, public.team_announcement_deadlines, public.team_announcement_dismissals TO authenticated;
GRANT ALL ON public.team_announcements, public.team_announcement_deadlines, public.team_announcement_dismissals TO service_role;
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcement_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le avisos" ON public.team_announcements FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "gestoras editam avisos" ON public.team_announcements FOR ALL TO authenticated USING (public.can_manage_collaborators()) WITH CHECK (public.can_manage_collaborators());
CREATE POLICY "equipe le prazos" ON public.team_announcement_deadlines FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "gestoras editam prazos" ON public.team_announcement_deadlines FOR ALL TO authenticated USING (public.can_manage_collaborators()) WITH CHECK (public.can_manage_collaborators());
CREATE POLICY "proprio entendi" ON public.team_announcement_dismissals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
WITH a AS (INSERT INTO public.team_announcements (titulo) VALUES ('🚨 Atenção equipe!') RETURNING id)
INSERT INTO public.team_announcement_deadlines (announcement_id, rotulo, data, ordem)
SELECT id, 'as projeções', DATE '2026-10-30', 0 FROM a UNION ALL SELECT id, 'o texto e o relatório', DATE '2026-11-06', 1 FROM a;