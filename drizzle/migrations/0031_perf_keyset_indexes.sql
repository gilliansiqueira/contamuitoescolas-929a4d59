CREATE INDEX IF NOT EXISTS idx_realized_entries_school_id_id ON public.realized_entries (school_id, id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_school_id_id ON public.bank_transactions (school_id, id);
CREATE INDEX IF NOT EXISTS idx_bank_cashflow_entries_school_id_id ON public.bank_cashflow_entries (school_id, id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_splits_school_id_id ON public.bank_transaction_splits (school_id, id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_school_id_id ON public.chart_of_accounts (school_id, id);