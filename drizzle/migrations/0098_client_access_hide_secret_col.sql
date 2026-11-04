REVOKE SELECT ON public.client_access_entries, public.client_access_history FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.client_access_entries, public.client_access_history, public.client_access_views FROM authenticated, anon;
GRANT SELECT (id,school_id,grupo,servico,url,login,extras,observacao,ordem,archived_at,created_by,created_at,updated_by,updated_at) ON public.client_access_entries TO authenticated;
GRANT SELECT (id,entry_id,school_id,acao,servico,url,login,extras,observacao,grupo,changed_by,changed_at) ON public.client_access_history TO authenticated;