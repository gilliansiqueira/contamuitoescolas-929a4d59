
-- Create schools table
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  saldo_inicial_data TEXT
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read schools" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Anyone can insert schools" ON public.schools FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update schools" ON public.schools FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete schools" ON public.schools FOR DELETE USING (true);

-- Create financial_entries table
CREATE TABLE public.financial_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL CHECK (origem IN ('sponte', 'cheque', 'cartao', 'manual', 'fluxo', 'contas_pagar', 'simulacao')),
  origem_upload_id UUID,
  tipo_original TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_entries_school ON public.financial_entries(school_id);
CREATE INDEX idx_financial_entries_data ON public.financial_entries(data);
CREATE INDEX idx_financial_entries_upload ON public.financial_entries(origem_upload_id);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read entries" ON public.financial_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert entries" ON public.financial_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update entries" ON public.financial_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete entries" ON public.financial_entries FOR DELETE USING (true);

-- Create exclusion_rules table
CREATE TABLE public.exclusion_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  campo TEXT NOT NULL CHECK (campo IN ('descricao', 'categoria')),
  operador TEXT NOT NULL CHECK (operador IN ('contem', 'igual')),
  valor TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('ignorar', 'recategorizar')),
  nova_categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusion_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rules" ON public.exclusion_rules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rules" ON public.exclusion_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete rules" ON public.exclusion_rules FOR DELETE USING (true);

-- Create upload_records table
CREATE TABLE public.upload_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  tipo TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  record_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.upload_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read uploads" ON public.upload_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert uploads" ON public.upload_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete uploads" ON public.upload_records FOR DELETE USING (true);

-- Create type_classifications table
CREATE TABLE public.type_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  tipo_valor TEXT NOT NULL,
  entra_no_resultado BOOLEAN NOT NULL DEFAULT false,
  impacta_caixa BOOLEAN NOT NULL DEFAULT true,
  classificacao TEXT NOT NULL DEFAULT 'operacao' CHECK (classificacao IN ('receita', 'despesa', 'operacao', 'ignorar')),
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, tipo_valor)
);

ALTER TABLE public.type_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read classifications" ON public.type_classifications FOR SELECT USING (true);
CREATE POLICY "Anyone can insert classifications" ON public.type_classifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update classifications" ON public.type_classifications FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete classifications" ON public.type_classifications FOR DELETE USING (true);

-- Create payment_delay_rules table
CREATE TABLE public.payment_delay_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  forma_cobranca TEXT NOT NULL,
  prazo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, forma_cobranca)
);

ALTER TABLE public.payment_delay_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read delay rules" ON public.payment_delay_rules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert delay rules" ON public.payment_delay_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update delay rules" ON public.payment_delay_rules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete delay rules" ON public.payment_delay_rules FOR DELETE USING (true);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read audit log" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (true);
