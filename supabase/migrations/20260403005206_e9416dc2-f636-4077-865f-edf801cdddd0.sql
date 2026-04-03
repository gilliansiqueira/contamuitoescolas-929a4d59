
-- Plano de Contas (Chart of Accounts) per school
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'despesa',
  grupo TEXT NOT NULL DEFAULT '',
  nivel INTEGER NOT NULL DEFAULT 1,
  pai_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chart_of_accounts" ON public.chart_of_accounts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert chart_of_accounts" ON public.chart_of_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chart_of_accounts" ON public.chart_of_accounts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete chart_of_accounts" ON public.chart_of_accounts FOR DELETE USING (true);

-- Lançamentos Realizados (Realized Entries) per school
CREATE TABLE public.realized_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'despesa',
  conta_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  conta_codigo TEXT NOT NULL DEFAULT '',
  conta_nome TEXT NOT NULL DEFAULT '',
  complemento TEXT NOT NULL DEFAULT '',
  origem_arquivo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.realized_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read realized_entries" ON public.realized_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert realized_entries" ON public.realized_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update realized_entries" ON public.realized_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete realized_entries" ON public.realized_entries FOR DELETE USING (true);
