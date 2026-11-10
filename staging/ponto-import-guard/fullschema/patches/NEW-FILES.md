Arquivos novos na promoção (cópias idênticas da pasta staging; validate.ts precisa ser o MESMO nos dois lados para o hash bater):
- src/lib/teamTime/importGuard/validate.ts      <- staging/ponto-import-guard/validate.ts
- src/lib/teamTime/importGuard/importClient.ts  <- staging/ponto-import-guard/importClient.ts
- supabase/functions/pontofopag-sync/validate.ts     <- staging/ponto-import-guard/validate.ts
- supabase/functions/pontofopag-sync/importGuard.ts  <- staging/ponto-import-guard/edge-patch.ts
- migration aditiva                                   <- staging/ponto-import-guard/rpc.sql
Ações já existentes da função (link_user, set_employee_hidden, sincronização pela API) ficam inalteradas no diff.
