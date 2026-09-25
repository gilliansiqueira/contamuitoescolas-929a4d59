CREATE OR REPLACE FUNCTION public.bank_import_refresh_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.school_data_sources WHERE school_id = NEW.school_id AND status IN ('em_conferencia','ativo')) THEN
    PERFORM public.refresh_bank_cashflow_status(NEW.school_id);
  END IF;
  RETURN NULL;
END; $function$;
DROP TRIGGER IF EXISTS bank_import_refresh_status ON public.bank_statement_imports;
CREATE TRIGGER bank_import_refresh_status AFTER INSERT OR UPDATE OF periodo_fim ON public.bank_statement_imports
FOR EACH ROW EXECUTE FUNCTION public.bank_import_refresh_status();
SELECT public.refresh_bank_cashflow_status(school_id) FROM public.school_data_sources WHERE status IN ('em_conferencia','ativo');