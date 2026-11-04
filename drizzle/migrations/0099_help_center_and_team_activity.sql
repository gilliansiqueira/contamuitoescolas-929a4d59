CREATE TABLE public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  tela text,
  titulo text NOT NULL,
  resumo text,
  conteudo text NOT NULL DEFAULT '',
  ordem int NOT NULL DEFAULT 0,
  trilha boolean NOT NULL DEFAULT true,
  versao int NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le ajuda" ON public.help_articles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "super edita ajuda" ON public.help_articles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "super altera ajuda" ON public.help_articles FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.help_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  versao int NOT NULL, titulo text, conteudo text,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_article_versions TO authenticated;
GRANT ALL ON public.help_article_versions TO service_role;
ALTER TABLE public.help_article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super le versoes" ON public.help_article_versions FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.help_article_version_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.conteudo IS DISTINCT FROM OLD.conteudo OR NEW.titulo IS DISTINCT FROM OLD.titulo THEN
    INSERT INTO public.help_article_versions(article_id,versao,titulo,conteudo,changed_by) VALUES (OLD.id,OLD.versao,OLD.titulo,OLD.conteudo,auth.uid());
    NEW.versao := OLD.versao + 1;
  END IF;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER help_article_version BEFORE UPDATE ON public.help_articles FOR EACH ROW EXECUTE FUNCTION public.help_article_version_trigger();

CREATE TABLE public.help_progress (
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
GRANT SELECT, INSERT, DELETE ON public.help_progress TO authenticated;
GRANT ALL ON public.help_progress TO service_role;
ALTER TABLE public.help_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proprio progresso" ON public.help_progress FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.help_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  pergunta text NOT NULL,
  resposta text,
  respondida boolean NOT NULL DEFAULT false,
  fontes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_questions TO authenticated;
GRANT ALL ON public.help_questions TO service_role;
ALTER TABLE public.help_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le perguntas" ON public.help_questions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "faz pergunta" ON public.help_questions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_admin());

CREATE TABLE public.team_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  school_id uuid,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_activity_events_user_time ON public.team_activity_events(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.team_activity_events TO authenticated;
GRANT ALL ON public.team_activity_events TO service_role;
ALTER TABLE public.team_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registra propria atividade" ON public.team_activity_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_admin() AND kind IN ('sino_aberto','meudia_aberto','aviso_clicado','aviso_visto','guia_lido','popup_entendi'));
CREATE POLICY "gestoras leem atividade" ON public.team_activity_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.team_supervision ts WHERE ts.supervisor_id = auth.uid() AND ts.member_id = team_activity_events.user_id));

CREATE TABLE public.team_alert_acks (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  alert_key text NOT NULL,
  dia date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, alert_key, dia)
);
GRANT SELECT, INSERT, DELETE ON public.team_alert_acks TO authenticated;
GRANT ALL ON public.team_alert_acks TO service_role;
ALTER TABLE public.team_alert_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proprios acks" ON public.team_alert_acks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());