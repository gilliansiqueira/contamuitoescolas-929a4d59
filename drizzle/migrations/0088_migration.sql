CREATE TABLE public.team_payroll_defaults (
  external_id text PRIMARY KEY,
  codigo_folha integer,
  nome_folha text,
  vr numeric,
  odonto numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_payroll_defaults TO authenticated;
GRANT ALL ON public.team_payroll_defaults TO service_role;
ALTER TABLE public.team_payroll_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll defaults read" ON public.team_payroll_defaults FOR SELECT TO authenticated USING (public.can_view_team_time());
CREATE POLICY "payroll defaults write" ON public.team_payroll_defaults FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.team_payroll_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL,
  kind text NOT NULL,
  competencia text,
  source_file text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ignored jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_payroll_uploads TO authenticated;
GRANT ALL ON public.team_payroll_uploads TO service_role;
ALTER TABLE public.team_payroll_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll uploads read" ON public.team_payroll_uploads FOR SELECT TO authenticated USING (public.can_view_team_time());
CREATE POLICY "payroll uploads write" ON public.team_payroll_uploads FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.team_payroll_month (
  mes text NOT NULL,
  external_id text NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mes, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_payroll_month TO authenticated;
GRANT ALL ON public.team_payroll_month TO service_role;
ALTER TABLE public.team_payroll_month ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll month read" ON public.team_payroll_month FOR SELECT TO authenticated USING (public.can_view_team_time());
CREATE POLICY "payroll month write" ON public.team_payroll_month FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.team_payroll_defaults (external_id, codigo_folha, nome_folha, vr, odonto) VALUES
('pf-1',24,'Ana Carolina da Silva Martins',80,NULL),
('pf-34',56,'Bruno Fernandes de Oliveira',NULL,NULL),
('pf-33',53,'Carlos Eduardo Camargo',80,NULL),
('pf-31',52,'Emanuele Miranda Sanchotene',80,NULL),
('pf-28',49,'Fernanda Priscila Barros da Silva',80,NULL),
('pf-2',12,'Franciliane Gomes de Oliveira',80,NULL),
('pf-30',51,'Geisiane Lopes da Silva',80,NULL),
('pf-3',36,'Geovanna Oliveira Nascimento',60,26.21),
('pf-19',40,'Gisele Cardoso',80,63.65),
('pf-4',13,'Gisley Ribeiro dos Santos',80,26.21),
('pf-27',46,'Hannah Ester Oliveira Nascimento',40,NULL),
('pf-26',44,'Ingrid de Paula Santos Lima',80,NULL),
('pf-20',43,'Isabella Morais Kretzchmar Zimermann',80,NULL),
('pf-5',5,'Isabelly Crisitina Goncalves Nicioli',80,63.65),
('pf-29',50,'Isis Crisitine Coelho da Silva',80,NULL),
('pf-35',55,'Rayssa Alves de Almeida',NULL,NULL),
('pf-18',39,'Rubia Stefani Ramos',80,26.21),
('pf-24',47,'Tamires Aparecida Morais dos Santos',80,NULL),
('pf-14',35,'Thauane Cristine Pinheiro',80,63.65);