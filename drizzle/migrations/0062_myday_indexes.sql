CREATE INDEX IF NOT EXISTS idx_bank_imports_account_fim ON public.bank_statement_imports (account_id, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_bank_imports_school_fim ON public.bank_statement_imports (school_id, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_payable_ack_school ON public.payable_acknowledgements (school_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_import_data ON public.bank_transactions (import_id, data);