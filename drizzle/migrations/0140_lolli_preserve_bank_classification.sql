DO $migration$
DECLARE definition text;
BEGIN
SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE proname='apply_bank_default_model_item' AND pronamespace='public'::regnamespace;
IF position('lolli_origin_upload_id' in definition)=0 THEN
 definition:=replace(definition,'BEGIN
  IF TG_TABLE_NAME', 'BEGIN
  IF TG_TABLE_NAME = ''bank_transactions'' THEN
    IF NEW.lolli_origin_upload_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.lolli_bank_source b WHERE b.origem_upload_id=NEW.lolli_origin_upload_id AND b.school_id=NEW.school_id AND b.source_table=''bank_transactions'' AND b.source_id=NEW.id::text AND b.original->>''account_id''=NEW.account_id::text AND b.original->>''data''=NEW.data AND abs((b.original->>''valor'')::numeric)=NEW.valor) THEN RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME');
 IF position('lolli_origin_upload_id' in definition)=0 THEN RAISE EXCEPTION 'Função original não corresponde à estrutura esperada'; END IF;
 EXECUTE definition;
END IF;
END $migration$;