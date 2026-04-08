
CREATE TABLE public.school_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  lucratividade NUMERIC DEFAULT NULL,
  inadimplencia NUMERIC DEFAULT NULL,
  media_alunos_turma NUMERIC DEFAULT NULL,
  alunos_modalidade NUMERIC DEFAULT NULL,
  evasao NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, month)
);

ALTER TABLE public.school_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read school_kpis" ON public.school_kpis FOR SELECT USING (true);
CREATE POLICY "Anyone can insert school_kpis" ON public.school_kpis FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update school_kpis" ON public.school_kpis FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete school_kpis" ON public.school_kpis FOR DELETE USING (true);
