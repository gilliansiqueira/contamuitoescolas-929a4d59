// Integração Banco Inter — SOMENTE LEITURA (saldo e extrato).
// Nenhuma chamada de pagamento/PIX é feita. Credenciais ficam criptografadas no banco e só esta função as lê.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { X509Certificate } from 'npm:@peculiar/x509@1.12.3';
import { z } from 'npm:zod@3.23.8';
import { mapInterTx, splitNew, syncWindow, gapStart, type InterTx } from './mapping.ts';

const BASE = 'https://cdpj.partners.bancointer.com.br';
const SCOPE = 'extrato.read';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const spToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const br = (iso: string) => iso.split('-').reverse().join('/');
async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

type Creds = { client_id: string; client_secret: string; cert: string; key: string };
// deno-lint-ignore no-explicit-any
function interClient(c: Creds): any {
  // deno-lint-ignore no-explicit-any
  return (Deno as any).createHttpClient({ cert: c.cert, key: c.key, certChain: c.cert, privateKey: c.key });
}
async function interToken(c: Creds, client: unknown): Promise<string> {
  const r = await fetch(`${BASE}/oauth/v2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, grant_type: 'client_credentials', scope: SCOPE }),
    // deno-lint-ignore no-explicit-any
    client,
  } as any);
  const t = await r.text();
  if (!r.ok) throw new Error(`Inter recusou o acesso (${r.status}). Confira se a integração está ativa com a permissão "Consultar extrato e saldo". ${t.slice(0, 200)}`);
  return JSON.parse(t).access_token;
}
async function interGet(path: string, token: string, client: unknown, conta?: string | null) {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (conta) h['x-conta-corrente'] = conta;
  // deno-lint-ignore no-explicit-any
  const r = await fetch(`${BASE}${path}`, { headers: h, client } as any);
  const t = await r.text();
  if (!r.ok) throw new Error(`Inter respondeu ${r.status} em ${path.split('?')[0]}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

// deno-lint-ignore no-explicit-any
async function runSync(conn: any, origem: 'noturna' | 'comercial' | 'manual', acao: 'sync' | 'teste', who: { id?: string; email?: string }) {
  const { data: cr, error: ce } = await admin.rpc('bank_api_get_credentials', { _conn: conn.id });
  const creds = (cr ?? [])[0] as Creds | undefined;
  const log = async (row: Record<string, unknown>) => {
    await admin.from('bank_api_sync_runs').insert({ connection_id: conn.id, school_id: conn.school_id, acao, origem, user_id: who.id ?? null, user_email: who.email ?? null, ...row });
  };
  if (ce || !creds) { await log({ ok: false, erro: 'Credenciais não cadastradas' }); throw new Error('Credenciais não cadastradas'); }
  const client = interClient(creds);
  const today = spToday();
  // Último lançamento real da conta antes da janela normal (OFX, PDF ou leitura anterior) — fecha buracos entre extratos.
  // Se já houve leitura pela API, o buraco possível fica antes da leitura mais antiga.
  const { data: firstApi } = await admin.from('bank_statement_imports').select('periodo_inicio').eq('account_id', conn.bank_account_id)
    .eq('formato', 'api_inter').order('periodo_inicio', { ascending: true }).limit(1).maybeSingle();
  const { data: lastTx } = await admin.from('bank_transactions').select('data').eq('account_id', conn.bank_account_id)
    .eq('is_forecast', false).lt('data', firstApi?.periodo_inicio ?? today).order('data', { ascending: false }).limit(1).maybeSingle();
  const { data: lastAny } = await admin.from('bank_transactions').select('data').eq('account_id', conn.bank_account_id)
    .eq('is_forecast', false).lt('data', today).order('data', { ascending: false }).limit(1).maybeSingle();
  const win = syncWindow(today, conn.start_date, origem, gapStart(lastTx?.data ?? null, firstApi?.periodo_inicio ?? null, lastAny?.data ?? null));
  try {
    const token = await interToken(creds, client);
    const saldoResp = await interGet(`/banking/v2/saldo?dataSaldo=${today}`, token, client, conn.conta_corrente);
    const saldo = Math.round(Number(saldoResp?.disponivel ?? 0) * 100) / 100;
    if (acao === 'teste') {
      await admin.from('bank_api_connections').update({ last_error: null, last_saldo: saldo, last_ok_at: new Date().toISOString(), last_sync_at: new Date().toISOString() }).eq('id', conn.id);
      await log({ ok: true, saldo });
      return { saldo };
    }
    if (win.inicio > win.fim) throw new Error('A data de início ainda não chegou.');
    const txs: InterTx[] = [];
    for (let p = 0, total = 1; p < total && p < 100; p++) {
      const r = await interGet(`/banking/v2/extrato/completo?dataInicio=${win.inicio}&dataFim=${win.fim}&pagina=${p}&tamanhoPagina=1000`, token, client, conn.conta_corrente);
      txs.push(...(r?.transacoes ?? []));
      total = Number(r?.totalPaginas ?? 1);
    }
    const mapped = txs.map(mapInterTx).filter((m): m is NonNullable<typeof m> => !!m && m.data >= conn.start_date);
    const { data: existing, error: ee } = await admin.from('bank_transactions').select('data, tipo, valor, bank_ref')
      .eq('account_id', conn.bank_account_id).eq('is_forecast', false).gte('data', win.inicio).lte('data', win.fim).limit(10000);
    if (ee) throw ee;
    const { novos, jaExistiam } = splitNew(mapped, existing ?? []);

    // Sem nada novo e com o mesmo saldo da última leitura de hoje: não cria outro registro no histórico.
    const { data: last } = await admin.from('bank_statement_imports').select('id, periodo_fim, saldo_final_informado')
      .eq('account_id', conn.bank_account_id).eq('formato', 'api_inter').order('created_at', { ascending: false }).limit(1).maybeSingle();
    let importId: string | null = null;
    if (novos.length || !last || last.periodo_fim !== win.fim || Number(last.saldo_final_informado) !== saldo) {
      const ent = novos.filter(n => n.tipo === 'entrada').reduce((s, n) => s + n.valor, 0);
      const sai = novos.filter(n => n.tipo === 'saida').reduce((s, n) => s + n.valor, 0);
      const { data: imp, error: ie } = await admin.from('bank_statement_imports').insert({
        school_id: conn.school_id, account_id: conn.bank_account_id,
        file_name: `API Banco Inter (${br(win.inicio)} a ${br(win.fim)})`, file_path: null,
        file_hash: `api-inter-${crypto.randomUUID()}`, formato: 'api_inter', periodo_inicio: win.inicio, periodo_fim: win.fim,
        total_linhas: mapped.length, inseridas: novos.length, duplicadas: jaExistiam,
        total_entradas: Math.round(ent * 100) / 100, total_saidas: Math.round(sai * 100) / 100,
        imported_by: who.id ?? null, saldo_final_informado: saldo,
      }).select('id').single();
      if (ie) throw ie;
      importId = imp.id;
      for (let i = 0; i < novos.length; i += 500) {
        const rows = await Promise.all(novos.slice(i, i + 500).map(async n => ({
          school_id: conn.school_id, account_id: conn.bank_account_id, import_id: imp.id, data: n.data, descricao: n.descricao,
          valor: n.valor, tipo: n.tipo, bank_ref: n.bankRef, dedup_hash: await sha256(`${conn.bank_account_id}|ref|${n.bankRef}`), is_forecast: false,
        })));
        const { error } = await admin.from('bank_transactions').upsert(rows, { onConflict: 'account_id,dedup_hash', ignoreDuplicates: true });
        if (error) { await admin.from('bank_statement_imports').delete().eq('id', imp.id); throw error; }
      }
    }
    const now = new Date().toISOString();
    await admin.from('bank_api_connections').update({ last_error: null, last_saldo: saldo, last_ok_at: now, last_sync_at: now }).eq('id', conn.id);
    await log({ ok: true, periodo_inicio: win.inicio, periodo_fim: win.fim, lidas: mapped.length, inseridas: novos.length, ja_existiam: jaExistiam, saldo, import_id: importId });
    return { lidas: mapped.length, inseridas: novos.length, jaExistiam, saldo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('bank_api_connections').update({ last_error: msg, last_sync_at: new Date().toISOString() }).eq('id', conn.id);
    await log({ ok: false, periodo_inicio: win.inicio, periodo_fim: win.fim, erro: msg });
    throw new Error(msg);
  } finally { try { client.close(); } catch { /* */ } }
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_config'), school_id: z.string().uuid(), bank_account_id: z.string().uuid(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), conta_corrente: z.string().max(30).optional().nullable(), enabled: z.boolean() }),
  z.object({ action: z.literal('save_credentials'), connection_id: z.string().uuid(), client_id: z.string().min(5).max(200), client_secret: z.string().min(5).max(200), cert: z.string().min(50).max(20000), key: z.string().min(50).max(20000) }),
  z.object({ action: z.literal('test'), connection_id: z.string().uuid() }),
  z.object({ action: z.literal('sync'), connection_id: z.string().uuid() }),
  z.object({ action: z.literal('cron'), origem: z.enum(['noturna', 'comercial']) }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    if (b.action === 'cron') {
      const { data: ok } = await admin.rpc('bank_api_check_cron', { _token: req.headers.get('x-cron-token') ?? '' });
      if (!ok) return json({ error: 'unauthorized' }, 401);
      const { data: conns } = await admin.from('bank_api_connections').select('*').eq('enabled', true).eq('has_credentials', true);
      const out: unknown[] = [];
      for (const c of conns ?? []) {
        const [{ data: f }, { data: s }] = await Promise.all([
          admin.from('school_features').select('enabled').eq('school_id', c.school_id).eq('feature_key', 'inter_api').maybeSingle(),
          admin.from('schools').select('ativo').eq('id', c.school_id).maybeSingle(),
        ]);
        if (!f?.enabled || s?.ativo === false) continue;
        try { out.push({ id: c.id, ...(await runSync(c, b.origem, 'sync', { email: 'agendamento' })) }); }
        catch (e) { out.push({ id: c.id, erro: e instanceof Error ? e.message : String(e) }); }
      }
      return json({ ok: true, out });
    }

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const who = { id: u.user.id, email: u.user.email ?? undefined };
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([userClient.rpc('is_admin'), userClient.rpc('is_super_admin')]);
    if (!isAdmin) return json({ error: 'Sem permissão' }, 403);
    const canSee = async (schoolId: string) => {
      // Mesma regra da plataforma: super_admin vê tudo; admin precisa da empresa na carteira (ou escopo 'all') e não restrita.
      const { data } = await userClient.rpc('admin_manages_school', { _school_id: schoolId });
      return !!data;
    };

    if (b.action === 'save_config') {
      if (!isSuper) return json({ error: 'Só a administração pode ligar ou configurar a integração.' }, 403);
      if (!(await canSee(b.school_id))) return json({ error: 'Sem acesso a esta empresa' }, 403);
      const { data: acc } = await admin.from('bank_accounts').select('id, banco, nome, is_virtual').eq('id', b.bank_account_id).eq('school_id', b.school_id).maybeSingle();
      if (!acc || acc.is_virtual) return json({ error: 'Conta não encontrada' }, 400);
      if (!/inter/i.test(`${acc.banco} ${acc.nome}`)) return json({ error: 'Esta conta não está cadastrada como Banco Inter.' }, 400);
      const { data: conn, error } = await admin.from('bank_api_connections').upsert({
        school_id: b.school_id, bank_account_id: b.bank_account_id, start_date: b.start_date, conta_corrente: b.conta_corrente || null,
        enabled: b.enabled, created_by: who.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'bank_account_id' }).select('id').single();
      if (error) throw error;
      const { data: anyOn } = await admin.from('bank_api_connections').select('id').eq('school_id', b.school_id).eq('enabled', true).limit(1);
      await admin.from('school_features').delete().eq('school_id', b.school_id).eq('feature_key', 'inter_api');
      await admin.from('school_features').insert({ school_id: b.school_id, feature_key: 'inter_api', enabled: !!anyOn?.length });
      await admin.from('bank_api_sync_runs').insert({ connection_id: conn.id, school_id: b.school_id, acao: b.enabled ? 'ligar' : 'desligar', origem: 'manual', ok: true, periodo_inicio: b.start_date, user_id: who.id, user_email: who.email });
      return json({ ok: true, id: conn.id });
    }

    const { data: conn } = await admin.from('bank_api_connections').select('*').eq('id', b.connection_id).maybeSingle();
    if (!conn || !(await canSee(conn.school_id))) return json({ error: 'Conexão não encontrada' }, 404);

    if (b.action === 'save_credentials') {
      if (!isSuper) return json({ error: 'Só a administração pode cadastrar credenciais.' }, 403);
      let expires: string | null = null;
      try { expires = new X509Certificate(b.cert.trim()).notAfter.toISOString(); }
      catch { return json({ error: 'O certificado (.crt) não foi reconhecido. Envie o arquivo .crt gerado pelo Inter.' }, 400); }
      if (!/PRIVATE KEY/.test(b.key)) return json({ error: 'A chave (.key) não foi reconhecida.' }, 400);
      const { error } = await admin.rpc('bank_api_set_credentials', { _conn: conn.id, _client_id: b.client_id.trim(), _client_secret: b.client_secret.trim(), _cert: b.cert.trim(), _key: b.key.trim(), _cert_expires: expires });
      if (error) throw error;
      await admin.from('bank_api_sync_runs').insert({ connection_id: conn.id, school_id: conn.school_id, acao: 'credenciais', origem: 'manual', ok: true, user_id: who.id, user_email: who.email });
      return json({ ok: true, cert_expires_at: expires });
    }
    if (b.action === 'test') return json({ ok: true, ...(await runSync(conn, 'manual', 'teste', who)) });
    if (b.action === 'sync') {
      if (!conn.enabled) return json({ error: 'A integração está desligada nesta conta.' }, 400);
      return json({ ok: true, ...(await runSync(conn, 'manual', 'sync', who)) });
    }
    return json({ error: 'ação inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
