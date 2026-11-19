ALTER TABLE public.financial_entries DROP CONSTRAINT financial_entries_origem_check;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_origem_check CHECK (origem = ANY (ARRAY['sponte','cheque','cartao','manual','fluxo','contas_pagar','simulacao','recorrente']));
ALTER TABLE public.financial_entries DROP CONSTRAINT financial_entries_source_kind_check;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_source_kind_check CHECK (source_kind = ANY (ARRAY['import','manual','manual_edit','forecast_rule']));