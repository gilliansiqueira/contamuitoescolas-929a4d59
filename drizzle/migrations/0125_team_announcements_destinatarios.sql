ALTER TABLE public.team_announcements ADD COLUMN IF NOT EXISTS destinatarios uuid[];
DROP POLICY IF EXISTS "equipe le avisos" ON public.team_announcements;
CREATE POLICY "equipe le avisos" ON public.team_announcements FOR SELECT TO authenticated
USING (public.is_admin() AND (destinatarios IS NULL OR auth.uid() = ANY(destinatarios) OR public.can_manage_collaborators()));