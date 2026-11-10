import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { headerIdentity, validateStatementIdentity, decodeBankText } from '../_shared/bankIdentity.ts';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const schema = z.object({ schoolId: z.string().uuid(), accountId: z.string().uuid(), action: z.enum(['validate', 'confirm']), hash: z.string().regex(/^[a-f0-9]{64}$/), metadata: z.record(z.unknown()).optional(), rows: z.array(z.record(z.unknown())).max(20000).optional(), links: z.array(z.object({ id: z.string().uuid(), bankRef: z.string().max(255), replace: z.boolean().optional() })).max(20000).optional() });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  let uploaded: string | undefined;
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const caller = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } });
    const { data: user, error: authError } = await caller.auth.getUser();
    if (authError || !user.user) return response({ error: 'Sessão inválida. Entre novamente.' }, 401);
    const form = await req.formData();
    const parsed = schema.safeParse(JSON.parse(String(form.get('payload') ?? 'null')));
    const file = form.get('file');
    if (!parsed.success || !(file instanceof File) || file.size > 20 * 1024 * 1024) return response({ error: 'Arquivo ou solicitação inválidos (limite 20 MB).' }, 400);
    const input = parsed.data;
    const { data: allowed, error: permError } = await caller.rpc('bank_import_allowed', { _school: input.schoolId, _account: input.accountId });
    if (permError || !allowed) return response({ error: 'Sem autorização para importar nesta empresa/conta.' }, 403);
    const { data: account, error: accountError } = await caller.from('bank_accounts').select('*').eq('id', input.accountId).eq('school_id', input.schoolId).single();
    if (accountError || !account) return response({ error: 'Conta não vinculada à empresa selecionada.' }, 403);
    if (account.holder_entity_id) {
      const { data: entity, error } = await caller.from('company_entities').select('cnpj').eq('id', account.holder_entity_id).eq('school_id', input.schoolId).single();
      if (error || !entity) return response({ error: 'Vínculo do titular específico inválido.' }, 422);
      if (account.holder_document && account.holder_document.replace(/[ .\-/]/g, '') !== entity.cnpj.replace(/[ .\-/]/g, '')) return response({ error: 'Documento diverge do titular específico cadastrado.' }, 422);
      account.holder_document = entity.cnpj;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (digest !== input.hash) return response({ error: 'Arquivo mudou após a conferência. Selecione novamente.' }, 409);
    const ext = file.name.split('.').pop()?.toLowerCase();
    let text: string;
    if (ext === 'ofx' || ext === 'csv' || ext === 'txt') text = decodeBankText(bytes);
    else if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('npm:xlsx@0.18.5');
      const wb = XLSX.read(bytes, { type: 'array' });
      text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';' });
    } else if (ext === 'pdf') {
      // Fail closed when the server cannot independently read an original PDF header.
      return response({ error: 'PDF/OCR bloqueado nesta versão: use OFX ou planilha original com cabeçalho identificável. Leitura visual não comprova o destino.' }, 422);
    } else return response({ error: 'Formato não suportado.' }, 400);
    const identity = headerIdentity(text, ext === 'ofx');
    try { validateStatementIdentity(identity, account, input.schoolId); }
    catch (error) { return response({ error: `Destino: ${account.nome} (empresa selecionada). ${error instanceof Error ? error.message : 'Identidade incompatível.'}` }, 422); }
    if (input.action === 'validate') return response({ ok: true });
    const formato = ext === 'txt' ? 'csv' : ext === 'xls' ? 'xlsx' : ext;
    const path = `${input.schoolId}/${input.accountId}/${digest}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from('bank-statements').upload(path, bytes, { contentType: file.type || 'application/octet-stream' });
    if (uploadError) return response({ error: 'Não foi possível guardar o arquivo. Nada foi importado.' }, 503);
    uploaded = path;
    const { data, error } = await admin.rpc('commit_verified_bank_import', { _user: user.user.id, _school: input.schoolId, _account: input.accountId, _identity: identity, _meta: { ...input.metadata, formato, file_name: file.name, file_path: path, file_hash: digest }, _rows: input.rows ?? [], _links: input.links ?? [] });
    if (error) {
      // A lost RPC response is not evidence of rollback: read back the exact hash/destination.
      const { data: committed, error: readError } = await admin.from('bank_statement_imports').select('id,file_path').eq('school_id', input.schoolId).eq('account_id', input.accountId).eq('file_hash', digest).maybeSingle();
      if (committed?.file_path === path) { uploaded = undefined; return response({ ok: true, id: committed.id }); }
      if (readError) { uploaded = undefined; return response({ error: 'Resultado incerto. Confira o histórico antes de tentar novamente.' }, 503); }
      const deterministic = /^22|^23|^42|^P0001$/.test(error.code ?? '');
      if (!deterministic && !committed) { uploaded = undefined; return response({ error: 'Resultado incerto. Confira o histórico antes de tentar novamente.' }, 503); }
      const { error: cleanupError } = await admin.storage.from('bank-statements').remove([path]); uploaded = undefined;
      return response({ error: cleanupError ? 'Lote recusado; arquivo temporário aguarda limpeza. Nenhum movimento confirmado.' : 'Importação recusada. Confira cadastro, destino, período e arquivo. Nenhum lote foi confirmado.' }, 409);
    }
    uploaded = undefined;
    return response({ ok: true, id: data });
  } catch (error) {
    if (uploaded) { return response({ error: 'Resultado incerto. Confira o histórico antes de tentar novamente.' }, 503); }
    return response({ error: error instanceof Error && /cadastro|arquivo|Conta|Banco|Agência|Documento|Complete/.test(error.message) ? error.message : 'Não foi possível validar a importação.' }, 422);
  }
});