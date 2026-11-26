DO $$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['get_management_portfolio','get_management_daily_status','get_management_reconciliation_backlog'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=f;
    IF position('team_supervision' in d) = 0 THEN
      d := replace(d, 'sms.responsible_user_id = auth.uid()', 'sms.responsible_user_id = auth.uid() OR sms.responsible_user_id IN (SELECT ts.member_id FROM public.team_supervision ts WHERE ts.supervisor_id = auth.uid())');
      EXECUTE d;
    END IF;
  END LOOP;
END $$;