// Conector Asaas — SOMENTE LEITURA (apenas GET). Grava só em acquirer_* (provider='asaas').
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { normalizePayment, dedupeSales, diffSales, saleSignature, summarize, tokenKind, apiBase, type Sale } from './normalize.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const nowIso = () => new Date().toISOString();
const P = 'asaas';
const MAX_PAGES = 50; // 50 × 100 = 5.000 cobranças por leitura
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_credentials'), school_id: z.string().uuid(), token: z.string().min(10).max(500), start_date: date.optional() }),
  z.object({ action: z.literal('pilot'), school_id: z.string().uuid(), enabled: z.boolean() }),
  z.object({ action: z.literal('test'), school_id: z.string().uuid() }),
  z.object({ action: z.literal('preview'), school_id: z.string().uuid(), from: date, to: date }),
  z.object({ action: z.literal('sync'), school_id: z.string().uuid(), from: date, to: date }),
]);

async function aGet(base: string, token: string, path: string) {
  const r = await fetch(`${base}${path}`, { method: 'GET', headers: { access_token: token, 'User-Agent': 'ContaMuito', accept: 'application/json' } });
  const t = await r.text();
  if (!r.ok) {
    if (r.status === 401) throw new Error('Asaas recusou a chave (401). Confira se é a chave de API de produção da conta certa.');
    if (r.status === 403) throw new Error('Chave sem permissão para esta consulta no Asaas (403).');
    throw new Error(`Asaas respondeu ${r.status} em GET ${path.split('?')[0]}`);
  }
  return t ? JSON.parse(t) : null;
}
async function collect(base: string, token: string, from: string, to: string) {
  // deno-lint-ignore no-explicit-any
  const raw = new Map<string, any>(); let truncated = false;
  for (const field of ['paymentDate', 'dateCreated']) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ [`${field}[ge]`]: from, [`${field}[le]`]: to, limit: '100', offset: String(page * 100) });
      const r = await aGet(base, token, `/payments?${q}`);
      for (const p of r?.data ?? []) raw.set(String(p.id), p);
      if (!r?.hasMore) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }
  }
  return { sales: dedupeSales([...raw.values()].map(normalizePayment)), raw, truncated };
}
async function hash(s: string) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const errMsg = (e: unknown) => e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Dados inválidos' }, 400);
    const b = parsed.data;
    const [{ data: isSuper }, { data: sees }] = await Promise.all([userClient.rpc('is_super_admin'), userClient.rpc('admin_manages_school', { _school_id: b.school_id })]);
    if (!isSuper || !sees) return json({ error: 'No piloto, só a administração usa o conector Asaas.' }, 403);

    let { data: conn } = await admin.from('acquirer_connections').select('*').eq('school_id', b.school_id).eq('provider', P).maybeSingle();
    if (b.action === 'save_credentials') {
      const token = b.token.trim(); const kind = tokenKind(token);
      if (!kind) return json({ error: 'Chave não reconhecida. A chave de API do Asaas começa com $aact_.' }, 400);
      if (!conn) { const r = await admin.from('acquirer_connections').insert({ school_id: b.school_id, provider: P, created_by: u.user.id, start_date: b.start_date ?? null }).select('*').single(); if (r.error) throw r.error; conn = r.data; }
      const { error } = await admin.rpc('acquirer_set_token', { _conn: conn.id, _token: token, _kind: kind }); if (error) throw error;
      await admin.from('acquirer_connections').update({ start_date: b.start_date ?? conn.start_date, account_id: null, account_nickname: null, account_email: null, last_error: null, updated_at: nowIso() }).eq('id', conn.id);
      return json({ ok: true, token_kind: kind });
    }
    if (!conn) return json({ error: 'Cadastre primeiro a chave do Asaas.' }, 400);
    if (b.action === 'pilot') { await admin.from('acquirer_connections').update({ enabled: b.enabled, updated_at: nowIso() }).eq('id', conn.id); return json({ ok: true }); }

    const { data: token } = await admin.rpc('acquirer_get_token', { _conn: conn.id });
    if (!token) return json({ error: 'Chave não cadastrada.' }, 400);
    const base = apiBase(conn.token_kind);

    if (b.action === 'test') {
      try {
        const me = await aGet(base, token as string, '/myAccount/commercialInfo');
        await admin.from('acquirer_connections').update({ account_id: me?.cpfCnpj ? `***${String(me.cpfCnpj).slice(-4)}` : null, account_nickname: me?.companyName ?? me?.name ?? null, account_email: me?.email ?? null, last_test_at: nowIso(), last_error: null }).eq('id', conn.id);
        return json({ ok: true, conta: { nome: me?.companyName ?? me?.name } });
      } catch (e) { const msg = errMsg(e); await admin.from('acquirer_connections').update({ last_test_at: nowIso(), last_error: msg }).eq('id', conn.id); return json({ error: msg }, 400); }
    }

    if (b.from > b.to) return json({ error: 'Período inválido.' }, 400);
    if ((Date.parse(b.to) - Date.parse(b.from)) / 86400000 > 92) return json({ error: 'Use no máximo 92 dias por vez.' }, 400);
    if (conn.start_date && b.from < conn.start_date) return json({ error: `A data inicial não pode ser antes de ${conn.start_date}.` }, 400);

    const { data: run } = await admin.from('acquirer_sync_runs').insert({ school_id: b.school_id, connection_id: conn.id, action: b.action, date_from: b.from, date_to: b.to, created_by: u.user.id }).select('id').single();
    try {
      const { sales, raw, truncated } = await collect(base, token as string, b.from, b.to);
      const existing = new Map<string, string>();
      const ids = sales.map(s => s.external_id);
      for (let i = 0; i < ids.length; i += 500) {
        const { data: ex } = await admin.from('acquirer_sales').select('external_id,status,status_detail,valor_bruto,taxas,valor_liquido,valor_estornado,money_release_date,money_release_status').eq('school_id', b.school_id).eq('provider', P).in('external_id', ids.slice(i, i + 500));
        for (const r of ex ?? []) existing.set(r.external_id, saleSignature({ ...r, valor_bruto: Number(r.valor_bruto), taxas: Number(r.taxas), valor_liquido: r.valor_liquido == null ? null : Number(r.valor_liquido), valor_estornado: Number(r.valor_estornado), money_release_date: r.money_release_date ? String(r.money_release_date).slice(0, 10) : null } as Sale));
      }
      const norm = (s: Sale): Sale => ({ ...s, money_release_date: s.money_release_date ? s.money_release_date.slice(0, 10) : null });
      const d = diffSales(sales.map(norm), existing);
      const summary = { ...summarize(sales), truncado: truncated, novos: d.novos.length, atualizados: d.atualizados.length, iguais: d.iguais };
      if (b.action === 'sync') {
        const changed = [...d.novos, ...d.atualizados];
        for (let i = 0; i < changed.length; i += 200) {
          const chunk = changed.slice(i, i + 200);
          const { error: e1 } = await admin.from('acquirer_sales').upsert(chunk.map(s => ({ ...sales.find(x => x.external_id === s.external_id)!, school_id: b.school_id, connection_id: conn.id, provider: P, last_run_id: run!.id, updated_at: nowIso() })), { onConflict: 'school_id,provider,external_id' });
          if (e1) throw e1;
          const rRows = await Promise.all(chunk.map(async s => { const p = raw.get(s.external_id); return { school_id: b.school_id, connection_id: conn.id, provider: P, external_id: s.external_id, payload: p, payload_hash: await hash(JSON.stringify(p)), last_run_id: run!.id, updated_at: nowIso() }; }));
          const { error: e2 } = await admin.from('acquirer_raw_events').upsert(rRows, { onConflict: 'school_id,provider,external_id' });
          if (e2) throw e2;
        }
        await admin.from('acquirer_connections').update({ last_sync_at: nowIso(), last_ok_at: nowIso(), last_error: null }).eq('id', conn.id);
      }
      await admin.from('acquirer_sync_runs').update({ status: 'ok', fetched: sales.length, inserted: b.action === 'sync' ? d.novos.length : 0, updated: b.action === 'sync' ? d.atualizados.length : 0, unchanged: d.iguais, summary, finished_at: nowIso() }).eq('id', run!.id);
      return json({ ok: true, summary });
    } catch (e) {
      const msg = errMsg(e);
      await admin.from('acquirer_sync_runs').update({ status: 'erro', error: msg, finished_at: nowIso() }).eq('id', run!.id);
      await admin.from('acquirer_connections').update({ last_error: msg, last_sync_at: nowIso() }).eq('id', conn.id);
      return json({ error: msg }, 400);
    }
  } catch (e) { return json({ error: errMsg(e) }, 500); }
});
