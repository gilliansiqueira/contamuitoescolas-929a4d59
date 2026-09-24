CREATE OR REPLACE FUNCTION public.audit_management_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row jsonb; v_old jsonb; v_school_id uuid; v_month text; v_id uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_school_id := (v_row->>'school_id')::uuid; v_month := v_row->>'month'; v_id := (v_row->>'id')::uuid;
  -- Empresa sendo excluída: o histórico dela também é removido, então não registra
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_school_id) THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.management_activity_history (school_id, month, entity_type, entity_id, action, old_data, new_data, changed_by)
  VALUES (v_school_id, v_month, TG_TABLE_NAME, v_id, lower(TG_OP), v_old, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row END, auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $function$;