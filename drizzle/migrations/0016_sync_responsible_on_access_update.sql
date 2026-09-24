CREATE TRIGGER sync_management_responsible_after_access_update
AFTER UPDATE OF school_id, user_id ON public.user_schools
FOR EACH ROW EXECUTE FUNCTION public.sync_school_management_responsible_trigger();