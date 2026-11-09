// Conector Mercado Pago — SOMENTE LEITURA (apenas GET na API do Mercado Pago).
// Grava só nas tabelas acquirer_*; nunca em bank_transactions, Olist/erp_* ou regras de lançamento.
// Token criptografado no backend; nunca é devolvido ao navegador nem escrito em log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { normalizePayment, dedupeSales, diffSales, saleSignature, summarize, windows, brtBegin, brtEnd, tokenKind, type Sale } from './normalize.ts';

const API = 'https://api.mercadopago.com';
const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const nowIso = () => new Date().toISOString();
const FEATURE = 'mercadopago_conector';
const MAX_PAGES = 40; // 40 × 50 = 2.000 pagamentos por janela

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_credentials'), school_id: z.string().uuid(), token: z.string().min(10).max(500), start_date: date.optional() }),
  z.object({ action: z.literal('pilot'), school_id: z.string().uuid(), enabled: z.boolean() }),
  z.object({ action: z.literal('test'), school_id: z.string().uuid() }),
  z.object({ action: z.literal('preview'), school_id: z.string().uuid(), from: date, to: date }),
  z.object({ action: z.literal('sync'), school_id: z.string().uuid(), from: date, to: date }),
  z.object({ action: z.literal('reports'), school_id: z.string().uuid() }),
  z.object({ action: z.literal('olist_audit'), school_id: z.string().uuid() }),
]);

/** Só GET. Mensagens de erro sem token. */
async function mpGet(token: string, path: string) {
  const r = await fetch(`${API}${path}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  if (!r.ok) {
    if (r.status === 401) throw new Error('Mercado Pago recusou o token (401). Confira se é o Access Token de produção da conta certa.');
    if (r.status === 403) throw new Error('Token sem permissão para esta consulta no Mercado Pago (403).');
    throw new Error(`Mercado Pago respondeu ${r.status} em GET ${path.split('?')[0]}`);
  }
  return t ? JSON.parse(t) : null;
}

/** Busca paginada por janela de datas; `range` = date_created (vendas) ou date_last_updated (estornos/atualizações). */
async function fetchPayments(token: string, from: string, to: string, range: 'date_created' | 'date_last_updated') {
  // deno-lint-ignore no-explicit-any
  const raw: any[] = []; let truncated = false;
  for (const w of windows(from, to, 15)) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ sort: range, criteria: 'asc', range, begin_date: brtBegin(w.from), end_date: brtEnd(w.to), limit: '50', offset: String(page * 50) });
      const r = await mpGet(token, `/v1/payments/search?${q}`);
      const results = r?.results ?? [];
      raw.push(...results);
      if (results.length < 50) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }
  }
  return { raw, truncated };
}

async function collect(token: string, from: string, to: string) {
  const a = await fetchPayments(token, from, to, 'date_created');
  const b = await fetchPayments(token, from, to, 'date_last_updated');
  // deno-lint-ignore no-explicit-any
  const byId = new Map<string, any>();
  for (const p of [...a.raw, ...b.raw]) byId.set(String(p.id), p);
  const sales = dedupeSales([...byId.values()].map(normalizePayment));
  return { sales, rawById: byId, truncated: a.truncated || b.truncated };
}

async function hash(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}

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

    const [{ data: isAdmin }, { data: isSuper }, { data: sees }] = await Promise.all([
      userClient.rpc('is_admin'), userClient.rpc('is_super_admin'), userClient.rpc('admin_manages_school', { _school_id: b.school_id }),
    ]);
    if (!isAdmin || !sees) return json({ error: 'Sem acesso a esta empresa' }, 403);
    // Piloto: tudo restrito à administração (super admin).
    if (!isSuper) return json({ error: 'No piloto, só a administração usa o conector Mercado Pago.' }, 403);

    let { data: conn } = await admin.from('acquirer_connections').select('*').eq('school_id', b.school_id).eq('provider', 'mercadopago').maybeSingle();

    if (b.action === 'olist_audit') return json({ ok: true, ...(await olistAudit(b.school_id)) });

    if (b.action === 'save_credentials') {
      const token = b.token.trim();
      const kind = tokenKind(token);
      if (!kind) return json({ error: 'Token não reconhecido. Use o Access Token (começa com APP_USR- em produção).' }, 400);
      if (!conn) {
        const r = await admin.from('acquirer_connections').insert({ school_id: b.school_id, provider: 'mercadopago', created_by: u.user.id, start_date: b.start_date ?? null }).select('*').single();
        if (r.error) throw r.error; conn = r.data;
      }
      const { error } = await admin.rpc('acquirer_set_token', { _conn: conn.id, _token: token, _kind: kind });
      if (error) throw error;
      await admin.from('acquirer_connections').update({ start_date: b.start_date ?? conn.start_date, account_id: null, account_nickname: null, account_email: null, last_error: null, updated_at: nowIso() }).eq('id', conn.id);
      return json({ ok: true, token_kind: kind });
    }
    if (!conn) return json({ error: 'Cadastre primeiro o token do Mercado Pago.' }, 400);

    if (b.action === 'pilot') {
      await admin.from('acquirer_connections').update({ enabled: b.enabled, updated_at: nowIso() }).eq('id', conn.id);
      await admin.from('school_features').delete().eq('school_id', b.school_id).eq('feature_key', FEATURE);
      await admin.from('school_features').insert({ school_id: b.school_id, feature_key: FEATURE, enabled: b.enabled });
      return json({ ok: true });
    }

    const { data: token } = await admin.rpc('acquirer_get_token', { _conn: conn.id });
    if (!token) return json({ error: 'Token não cadastrado.' }, 400);

    if (b.action === 'test') {
      try {
        const me = await mpGet(token as string, '/users/me');
        await admin.from('acquirer_connections').update({ account_id: String(me?.id ?? ''), account_nickname: me?.nickname ?? null, account_email: me?.email ?? null, last_test_at: nowIso(), last_error: null }).eq('id', conn.id);
        return json({ ok: true, conta: { id: me?.id, nickname: me?.nickname, site: me?.site_id }, token_kind: conn.token_kind });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from('acquirer_connections').update({ last_test_at: nowIso(), last_error: msg }).eq('id', conn.id);
        return json({ error: msg }, 400);
      }
    }

    if (b.action === 'reports') {
      // Só lista relatórios que já existem; não gera nem agenda nada.
      const [release, settlement] = await Promise.all([
        mpGet(token as string, '/v1/account/release_report/list').catch((e) => ({ erro: e.message })),
        mpGet(token as string, '/v1/account/settlement_report/list').catch((e) => ({ erro: e.message })),
      ]);
      const pick = (x: any) => Array.isArray(x) ? x.slice(0, 30).map((r: any) => ({ file_name: r.file_name, begin_date: r.begin_date, end_date: r.end_date, created_from: r.created_from, date_created: r.date_created })) : x;
      return json({ ok: true, liberacoes: pick(release), conciliacao: pick(settlement) });
    }

    if (b.from > b.to) return json({ error: 'Período inválido.' }, 400);
    const days = (Date.parse(b.to) - Date.parse(b.from)) / 86400000;
    if (days > 92) return json({ error: 'Use no máximo 92 dias por vez.' }, 400);
    if (conn.start_date && b.from < conn.start_date) return json({ error: `A data inicial não pode ser antes de ${conn.start_date}.` }, 400);

    const { data: run } = await admin.from('acquirer_sync_runs').insert({ school_id: b.school_id, connection_id: conn.id, action: b.action, date_from: b.from, date_to: b.to, created_by: u.user.id }).select('id').single();
    try {
      const { sales, rawById, truncated } = await collect(token as string, b.from, b.to);
      const { data: ex } = await admin.from('acquirer_sales').select('external_id,status,status_detail,valor_bruto,taxas,valor_liquido,valor_estornado,money_release_date,money_release_status,date_last_updated').eq('school_id', b.school_id).eq('provider', 'mercadopago').in('external_id', sales.map(s => s.external_id).slice(0, 5000));
      const existing = new Map<string, string>();
      for (const r of ex ?? []) existing.set(r.external_id, saleSignature({ ...r, valor_bruto: Number(r.valor_bruto), taxas: Number(r.taxas), valor_liquido: r.valor_liquido == null ? null : Number(r.valor_liquido), valor_estornado: Number(r.valor_estornado), money_release_date: r.money_release_date ? new Date(r.money_release_date).toISOString() : null, date_last_updated: r.date_last_updated ? new Date(r.date_last_updated).toISOString() : null } as Sale));
      const norm = (s: Sale): Sale => ({ ...s, money_release_date: s.money_release_date ? new Date(s.money_release_date).toISOString() : null, date_last_updated: s.date_last_updated ? new Date(s.date_last_updated).toISOString() : null });
      const d = diffSales(sales.map(norm), existing);
      const summary = { ...summarize(sales), truncado: truncated, novos: d.novos.length, atualizados: d.atualizados.length, iguais: d.iguais };

      if (b.action === 'sync') {
        const changed = [...d.novos, ...d.atualizados];
        for (let i = 0; i < changed.length; i += 200) {
          const chunk = changed.slice(i, i + 200);
          const sRows = chunk.map(s => ({ ...sales.find(x => x.external_id === s.external_id)!, school_id: b.school_id, connection_id: conn.id, provider: 'mercadopago', last_run_id: run!.id, updated_at: nowIso() }));
          const { error: e1 } = await admin.from('acquirer_sales').upsert(sRows, { onConflict: 'school_id,provider,external_id' });
          if (e1) throw e1;
          const rRows = await Promise.all(chunk.map(async s => { const p = rawById.get(s.external_id); const txt = JSON.stringify(p); return { school_id: b.school_id, connection_id: conn.id, provider: 'mercadopago', external_id: s.external_id, payload: p, payload_hash: await hash(txt), last_run_id: run!.id, updated_at: nowIso() }; }));
          const { error: e2 } = await admin.from('acquirer_raw_events').upsert(rRows, { onConflict: 'school_id,provider,external_id' });
          if (e2) throw e2;
        }
        await admin.from('acquirer_connections').update({ last_sync_at: nowIso(), last_ok_at: nowIso(), last_error: null }).eq('id', conn.id);
      }
      await admin.from('acquirer_sync_runs').update({ status: 'ok', fetched: sales.length, inserted: b.action === 'sync' ? d.novos.length : 0, updated: b.action === 'sync' ? d.atualizados.length : 0, unchanged: d.iguais, summary, finished_at: nowIso() }).eq('id', run!.id);
      const amostra = b.action === 'preview' ? sales.slice(0, 50).map(s => ({ id: s.external_id, data: s.date_created, canal: s.canal, status: s.status, metodo: s.payment_method, bruto: s.valor_bruto, taxas: s.taxas, liquido: s.valor_liquido })) : undefined;
      return json({ ok: true, summary, amostra });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from('acquirer_sync_runs').update({ status: 'erro', error: msg, finished_at: nowIso() }).eq('id', run!.id);
      await admin.from('acquirer_connections').update({ last_error: msg, last_sync_at: nowIso() }).eq('id', conn.id);
      return json({ error: msg }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/** Auditoria da Olist só pelo que já está gravado na plataforma — não chama a Olist (não renova o token). */
async function olistAudit(schoolId: string) {
  const { data: c } = await admin.from('erp_connections').select('id,provider,enabled,test_mode,has_credentials,authorized,last_push_at,last_ok_at,last_error').eq('school_id', schoolId).maybeSingle();
  const { data: links } = await admin.from('erp_account_links').select('olist_conta_id,olist_conta_nome,start_date').eq('school_id', schoolId);
  const { data: log } = await admin.from('erp_push_log').select('acao,status,descricao').eq('school_id', schoolId).limit(5000);
  const porStatus: Record<string, number> = {}; const porAcao: Record<string, number> = {}; let mencionaMp = 0;
  for (const r of log ?? []) { porStatus[r.status] = (porStatus[r.status] ?? 0) + 1; porAcao[r.acao] = (porAcao[r.acao] ?? 0) + 1; if (/mercado ?pago|mercadopago|mp \*|meli|mercado ?livre/i.test(r.descricao ?? '')) mencionaMp++; }
  return {
    conexao: c, contas_ligadas: links ?? [], envios: { total: (log ?? []).length, porStatus, porAcao, lancamentos_com_texto_mercado_pago: mencionaMp },
    limites: 'A API pública da Olist não mostra a configuração da conciliação Mercado Pago (gateway do e-commerce) nem se a integração do Mercado Livre está ligada. Conferir na Olist: Configurações › Integrações (e-commerce/Mercado Pago e Mercado Livre) e Finanças › Conciliação. A conciliação do Mercado Pago na Olist cobre o gateway do e-commerce, não o marketplace Mercado Livre.',
  };
}
