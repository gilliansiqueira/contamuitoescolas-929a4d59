ALTER TABLE public.school_data_sources ADD COLUMN IF NOT EXISTS opening_balance numeric;
UPDATE public.school_data_sources s SET opening_balance = x.total
FROM (SELECT b.school_id, SUM(b.saldo_conta + b.saldo_aplicado) total
      FROM public.bank_account_balances b JOIN public.school_data_sources d ON d.school_id=b.school_id
      WHERE b.data = (to_date(d.start_month||'-01','YYYY-MM-DD') - 1)::text GROUP BY b.school_id) x
WHERE s.school_id = x.school_id AND s.status = 'ativo';
COMMENT ON COLUMN public.school_data_sources.opening_balance IS 'Saldo do banco (conta+aplicado) no dia anterior a start_month; âncora do saldo quando status=ativo.';
COMMENT ON COLUMN public.school_data_sources.opening_adjustment IS 'DEPRECATED: substituído por opening_balance';