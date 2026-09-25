ALTER POLICY fe_select ON public.financial_entries USING ((select public.is_admin()) OR public.user_has_school_access((select auth.uid()), school_id));
ALTER POLICY re_select ON public.realized_entries USING ((select public.is_admin()) OR public.user_has_school_access((select auth.uid()), school_id));
ALTER POLICY coa_select ON public.chart_of_accounts USING ((select public.is_admin()) OR public.user_has_school_access((select auth.uid()), school_id));
ALTER POLICY hm_select ON public.historical_monthly USING ((select public.is_admin()) OR public.user_has_school_access((select auth.uid()), school_id));
ALTER POLICY kv_select ON public.kpi_values USING ((select public.is_admin()) OR public.user_has_school_access((select auth.uid()), school_id));
ALTER POLICY "Admins read splits" ON public.bank_transaction_splits USING ((select public.is_admin()));
ALTER POLICY "Admins manage bank transactions" ON public.bank_transactions USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
ALTER POLICY bce_select ON public.bank_cashflow_entries USING ((select public.is_admin()) OR (public.user_has_school_access((select auth.uid()), school_id) AND EXISTS (SELECT 1 FROM public.school_data_sources d WHERE d.school_id = bank_cashflow_entries.school_id AND d.status = 'ativo')));