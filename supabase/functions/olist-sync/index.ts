// Integração Olist ERP: envia para a Olist os lançamentos lidos do banco (Inter), na conta bancária ligada.
// Dá baixa em conta em aberto quando há candidato único; senão cria lançamento no Caixa da Olist.
// Nunca altera dados financeiros da plataforma (SSOT intacta). Segredos criptografados, lidos só aqui.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { suggestCategory, pickOpenBill, isOperation, addDays, toBr, findExisting, dailyDiff, type Tx, type OpenBill, type ModelItem, type OlistCaixa } from './push.ts';

const API = 'https://api.tiny.com.br/public-api/v3';
const AUTH = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect';
const URL_ = Deno.env.get('SUPABASE_URL')!;
const REDIRECT = `${URL_}/functions/v1/olist-sync`;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const nowIso = () => new Date().toISOString();

type Secrets = { client_id: string | null; client_secret: string | null; refresh_token: string | null };
async function secrets(connId: string): Promise<Secrets> {
  const { data, error } = await admin.rpc('erp_get_secrets', { _conn: connId });
  if (error) throw error;
  return ((data ?? [])[0] ?? { client_id: null, client_secret: null, refresh_token: null }) as Secrets;
}
async function tokenRequest(params: Record<string, string>) {
  const r = await fetch(`${AUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Olist recusou a autorização (${r.status}): ${t.slice(0, 200)}`);
  return JSON.parse(t) as { access_token: string; refresh_token: string };
}
/** Renova o acesso (o refresh da Olist dura 1 dia; cada leitura gera um novo). */
// deno-lint-ignore no-explicit-any
async function accessToken(conn: any): Promise<string> {
  const s = await secrets(conn.id);
  if (!s.client_id || !s.client_secret) throw new Error('Cadastre o Client ID e o Client Secret do aplicativo da Olist.');
  if (!s.refresh_token) throw new Error('Autorize o acesso à Olist (botão "Autorizar na Olist").');
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', client_id: s.client_id, client_secret: s.client_secret, refresh_token: s.refresh_token });
    await admin.rpc('erp_set_secret', { _conn: conn.id, _field: 'refresh_token', _value: t.refresh_token });
    return t.access_token;
  } catch (e) {
    await admin.from('erp_connections').update({ authorized: false }).eq('id', conn.id);
    throw new Error(`A autorização da Olist expirou: clique em "Autorizar na Olist" de novo. ${e instanceof Error ? e.message : ''}`);
  }
}
async function olist(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Olist respondeu ${r.status} em ${method} ${path.split('?')[0]}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
// deno-lint-ignore no-explicit-any
async function listAll(token: string, path: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  for (let off = 0; off < 5000; off += 100) {
    const r = await olist(token, 'GET', `${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${off}`);
    const itens = r?.itens ?? [];
    out.push(...itens);
    if (itens.length < 100) break;
  }
  return out;
}

const isoDate = (d: string) => { const s = String(d ?? '').slice(0, 10); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };
/** Lançamentos do Caixa da Olist na conta, num intervalo de datas. */
async function listCaixa(token: string, contaId: number, from: string, to: string): Promise<OlistCaixa[]> {
  const rows = await listAll(token, `/caixa?idContaFinanceira=${contaId}&dataInicial=${from}&dataFinal=${to}`);
  return rows.map(r => ({ id: Number(r.id), data: isoDate(r.data), valor: Math.abs(Number(r.valor)), tipo: String(r.tipo) }))
    .filter(r => r.data >= from && r.data <= to);
}
async function ourIds(connId: string): Promise<Set<number>> {
  const { data } = await admin.from('erp_push_log').select('olist_id').eq('connection_id', connId).eq('acao', 'caixa').not('olist_id', 'is', null).in('status', ['enviado', 'a_classificar']);
  return new Set((data ?? []).map(r => Number(r.olist_id)));
}

// Lançamentos de Caixa e baixas usam o id da "conta financeira" (/contas-financeiras), não o de /contas-bancarias.
// Corrige vínculos antigos pelo nome quando o id salvo não existe entre as contas financeiras.
// deno-lint-ignore no-explicit-any
async function fixLinks(connId: string, contas: any[]) {
  if (!contas.length) return;
  const ids = new Set(contas.map(c => Number(c.id)));
  const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const { data: links } = await admin.from('erp_account_links').select('id, olist_conta_id, olist_conta_nome').eq('connection_id', connId);
  for (const l of links ?? []) {
    if (ids.has(Number(l.olist_conta_id))) continue;
    const m = contas.filter(c => norm(c.descricao) === norm(l.olist_conta_nome));
    if (m.length === 1) await admin.from('erp_account_links').update({ olist_conta_id: m[0].id, updated_at: nowIso() }).eq('id', l.id);
  }
}

// deno-lint-ignore no-explicit-any
async function runPush(conn: any, opts: { retry?: boolean } = {}) {
  if (opts.retry) await admin.from('erp_push_log').delete().eq('connection_id', conn.id).eq('status', 'erro');
  const token = await accessToken(conn);
  await fixLinks(conn.id, await listAll(token, '/contas-financeiras').catch(() => []));
  const { data: links } = await admin.from('erp_account_links').select('*').eq('connection_id', conn.id);
  if (!links?.length) throw new Error('Ligue ao menos uma conta bancária a uma conta da Olist.');
  const { data: maps } = await admin.from('erp_category_map').select('model_item_id, olist_categoria_id').eq('school_id', conn.school_id);
  const catOf = new Map((maps ?? []).filter(m => m.olist_categoria_id).map(m => [m.model_item_id, Number(m.olist_categoria_id)]));
  let enviados = 0, aClassificar = 0, erros = 0, simulados = 0, reclass = 0, jaExistia = 0;

  // 1) Reclassificação: lançamentos enviados como "A classificar" que a equipe já classificou.
  if (!conn.test_mode) {
    const { data: pend } = await admin.from('erp_push_log').select('id, bank_transaction_id, olist_id, acao').eq('connection_id', conn.id).eq('status', 'a_classificar').limit(200);
    if (pend?.length) {
      const { data: txs } = await admin.from('bank_transactions').select('id, model_item_id').in('id', pend.map(p => p.bank_transaction_id));
      for (const p of pend) {
        const item = txs?.find(t => t.id === p.bank_transaction_id)?.model_item_id;
        const cat = item ? catOf.get(item) : undefined;
        if (!cat || p.acao !== 'caixa' || !p.olist_id) continue;
        try {
          await olist(token, 'PUT', `/caixa/${p.olist_id}`, { categoria: { id: cat } });
          await admin.from('erp_push_log').update({ status: 'enviado', model_item_id: item, olist_categoria_id: cat, categoria_origem: 'item', updated_at: nowIso() }).eq('id', p.id);
          reclass++;
        } catch (e) { await admin.from('erp_push_log').update({ erro: e instanceof Error ? e.message : String(e), updated_at: nowIso() }).eq('id', p.id); }
      }
    }
  }

  // 2) Lançamentos novos.
  const since = addDays(new Date().toISOString().slice(0, 10), -365);
  const { data: hist } = await admin.from('bank_transactions').select('descricao, tipo, model_item_id')
    .eq('school_id', conn.school_id).eq('is_forecast', false).not('model_item_id', 'is', null).gte('data', since).limit(20000);
  for (const link of links) {
    const { data: done } = await admin.from('erp_push_log').select('bank_transaction_id').eq('connection_id', conn.id).limit(50000);
    const doneSet = new Set((done ?? []).map(d => d.bank_transaction_id));
    const { data: raw } = await admin.from('bank_transactions').select('id, data, descricao, descricao_editada, valor, tipo, model_item_id, manual_pair_id')
      .eq('account_id', link.bank_account_id).eq('is_forecast', false).gte('data', link.start_date).order('data').limit(5000);
    const txs: Tx[] = (raw ?? []).filter(t => !doneSet.has(t.id) && !t.manual_pair_id && (t.tipo === 'entrada' || t.tipo === 'saida'))
      .slice(0, 150).map(t => ({ id: t.id, data: t.data, descricao: t.descricao_editada || t.descricao, valor: Math.abs(Number(t.valor)), tipo: t.tipo, model_item_id: t.model_item_id }));
    if (!txs.length) continue;
    const itemIds = [...new Set([...txs.map(t => t.model_item_id), ...(hist ?? []).map(h => h.model_item_id)].filter(Boolean))] as string[];
    const { data: items } = itemIds.length ? await admin.from('financial_model_template_items').select('id, entra_no_resultado, impacta_caixa').in('id', itemIds) : { data: [] };
    const itemMap = new Map((items ?? []).map((i: ModelItem) => [i.id, i]));
    const minD = addDays(txs[0].data, -3), maxD = addDays(txs[txs.length - 1].data, 7);
    const open: Record<'entrada' | 'saida', OpenBill[]> = { entrada: [], saida: [] };
    const used = new Set<number>();
    for (const t of ['saida', 'entrada'] as const) {
      if (!txs.some(x => x.tipo === t)) continue;
      const path = t === 'saida' ? '/contas-pagar' : '/contas-receber';
      for (const sit of ['aberto', 'atrasadas']) {
        open[t].push(...(await listAll(token, `${path}?situacao=${sit}&dataInicialVencimento=${minD}&dataFinalVencimento=${maxD}`)));
      }
    }

    const caixa = await listCaixa(token, Number(link.olist_conta_id), addDays(txs[0].data, -1), addDays(txs[txs.length - 1].data, 1));
    const ours = await ourIds(conn.id);
    const usedCx = new Set<number>();
    for (const tx of txs) {
      const exist = findExisting(tx, caixa, usedCx, ours);
      if (exist) {
        usedCx.add(exist);
        await admin.from('erp_push_log').upsert({ school_id: conn.school_id, connection_id: conn.id, bank_transaction_id: tx.id, data: tx.data, descricao: tx.descricao, valor: tx.valor, tipo: tx.tipo,
          acao: 'caixa', categoria_origem: 'ja_existia', status: conn.test_mode ? 'simulado_existia' : 'ja_existia', olist_id: exist, erro: null, updated_at: nowIso() }, { onConflict: 'bank_transaction_id' });
        jaExistia++; continue;
      }
      const sug = suggestCategory(tx, (hist ?? []) as never);
      const item = sug.modelItemId ? itemMap.get(sug.modelItemId) : undefined;
      const op = isOperation(item);
      let cat = sug.modelItemId ? catOf.get(sug.modelItemId) : undefined;
      const unclassified = !op && !cat;
      if (unclassified && conn.pending_categoria_id) cat = Number(conn.pending_categoria_id);
      const billId = op ? null : pickOpenBill(tx, open[tx.tipo], used);
      if (billId) used.add(billId);
      const base = { school_id: conn.school_id, connection_id: conn.id, bank_transaction_id: tx.id, data: tx.data, descricao: tx.descricao, valor: tx.valor, tipo: tx.tipo,
        acao: billId ? 'baixa' : 'caixa', categoria_origem: op ? 'operacao' : (unclassified ? 'a_classificar' : sug.origem), model_item_id: sug.modelItemId, olist_categoria_id: cat ?? null };
      if (conn.test_mode) {
        await admin.from('erp_push_log').upsert({ ...base, status: 'simulado', olist_id: billId }, { onConflict: 'bank_transaction_id' });
        simulados++; continue;
      }
      try {
        let olistId: number | null = billId;
        const hist_ = `${tx.descricao} (extrato ${toBr(tx.data)})`.slice(0, 250);
        if (billId) {
          const path = tx.tipo === 'saida' ? `/contas-pagar/${billId}/baixar` : `/contas-receber/${billId}/baixar`;
          await olist(token, 'POST', path, {
            [tx.tipo === 'saida' ? 'contaOrigem' : 'contaDestino']: { id: Number(link.olist_conta_id) },
            data: toBr(tx.data), valorPago: tx.valor, historico: hist_, ...(cat ? { categoria: { id: cat } } : {}),
          });
        } else {
          const r = await olist(token, 'POST', '/caixa', {
            historico: hist_, data: tx.data, valor: tx.valor, tipo: tx.tipo === 'saida' ? 'D' : 'C',
            conta: { id: Number(link.olist_conta_id) }, ...(cat ? { categoria: { id: cat } } : {}),
          });
          olistId = r?.id ?? null;
        }
        await admin.from('erp_push_log').upsert({ ...base, status: unclassified ? 'a_classificar' : 'enviado', olist_id: olistId, erro: null, updated_at: nowIso() }, { onConflict: 'bank_transaction_id' });
        if (unclassified) aClassificar++; else enviados++;
      } catch (e) {
        await admin.from('erp_push_log').upsert({ ...base, status: 'erro', erro: e instanceof Error ? e.message : String(e), updated_at: nowIso() }, { onConflict: 'bank_transaction_id' });
        erros++;
      }
    }
  }
  await admin.from('erp_connections').update({ last_push_at: nowIso(), ...(erros ? { last_error: `${erros} lançamento(s) com erro no envio` } : { last_error: null, last_ok_at: nowIso() }) }).eq('id', conn.id);
  return { enviados, aClassificar, erros, simulados, reclass, jaExistia };
}

/** Desfaz duplicados criados por nós: apaga só lançamentos nossos que já existiam na Olist (lançados por outros). */
// deno-lint-ignore no-explicit-any
async function dedupCleanup(conn: any, dryRun: boolean) {
  const token = await accessToken(conn);
  const { data: logs } = await admin.from('erp_push_log').select('id, bank_transaction_id, data, valor, tipo, descricao, olist_id').eq('connection_id', conn.id).eq('acao', 'caixa').in('status', ['enviado', 'a_classificar']).not('olist_id', 'is', null).order('data');
  const { data: links } = await admin.from('erp_account_links').select('olist_conta_id').eq('connection_id', conn.id);
  if (!logs?.length || !links?.length) return { apagar: [], manter: 0 };
  const ours = new Set(logs.map(l => Number(l.olist_id)));
  const from = addDays(logs[0].data, -1), to = addDays(logs[logs.length - 1].data, 1);
  const caixa: OlistCaixa[] = [];
  for (const l of links) caixa.push(...await listCaixa(token, Number(l.olist_conta_id), from, to));
  const used = new Set<number>();
  const apagar: { descricao: string; data: string; valor: number; tipo: string; olist_id: number; existente: number }[] = [];
  let manter = 0;
  for (const l of logs) {
    const ex = findExisting({ data: l.data, valor: Number(l.valor), tipo: l.tipo }, caixa, used, ours);
    if (!ex) { manter++; continue; }
    used.add(ex);
    apagar.push({ descricao: l.descricao, data: l.data, valor: Number(l.valor), tipo: l.tipo, olist_id: Number(l.olist_id), existente: ex });
    if (!dryRun) {
      try { await olist(token, 'DELETE', `/caixa/${l.olist_id}`); }
      catch (e) { if (!/\b404\b/.test(String(e))) throw e; }
      await admin.from('erp_push_log').update({ status: 'ja_existia', categoria_origem: 'ja_existia', olist_id: ex, erro: null, updated_at: nowIso() }).eq('id', l.id);
    }
  }
  return { apagar, manter };
}

/** Compara, dia a dia, o extrato do banco com o Caixa da Olist na conta ligada (desde a data de início). */
// deno-lint-ignore no-explicit-any
async function reconcile(conn: any) {
  const token = await accessToken(conn);
  const { data: links } = await admin.from('erp_account_links').select('*').eq('connection_id', conn.id);
  const out = [];
  for (const l of links ?? []) {
    const to = new Date().toISOString().slice(0, 10);
    const { data: raw } = await admin.from('bank_transactions').select('data, valor, tipo, manual_pair_id').eq('account_id', l.bank_account_id).eq('is_forecast', false).gte('data', l.start_date).lte('data', to).limit(10000);
    const bank = (raw ?? []).filter(t => !t.manual_pair_id && (t.tipo === 'entrada' || t.tipo === 'saida')).map(t => ({ data: t.data, valor: Math.abs(Number(t.valor)), tipo: t.tipo as 'entrada' | 'saida' }));
    const caixa = await listCaixa(token, Number(l.olist_conta_id), l.start_date, to);
    const sum = (a: number[]) => +a.reduce((x, y) => x + y, 0).toFixed(2);
    const movBanco = sum(bank.map(b => b.tipo === 'saida' ? -b.valor : b.valor));
    const movOlist = sum(caixa.filter(c => c.tipo !== 'S').map(c => c.tipo === 'D' ? -c.valor : c.valor));
    out.push({ conta: l.olist_conta_nome, desde: l.start_date, movBanco, movOlist, diferenca: +(movBanco - movOlist).toFixed(2), dias: dailyDiff(bank, caixa) });
  }
  return { contas: out };
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_app'), school_id: z.string().uuid(), client_id: z.string().min(3).max(300).optional(), client_secret: z.string().min(3).max(300).optional() }),
  z.object({ action: z.literal('authorize'), school_id: z.string().uuid(), return_url: z.string().url().max(500) }),
  z.object({ action: z.literal('settings'), school_id: z.string().uuid(), enabled: z.boolean(), test_mode: z.boolean(), pending_categoria_id: z.number().int().nullable(), pending_categoria_nome: z.string().max(200).nullable() }),
  z.object({ action: z.literal('catalog'), school_id: z.string().uuid() }),
  z.object({ action: z.literal('save_link'), school_id: z.string().uuid(), bank_account_id: z.string().uuid(), olist_conta_id: z.number().int().nullable(), olist_conta_nome: z.string().max(200).nullable(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal('save_map'), school_id: z.string().uuid(), items: z.array(z.object({ model_item_id: z.string().uuid(), olist_categoria_id: z.number().int().nullable(), olist_categoria_nome: z.string().max(200).nullable() })).max(500) }),
  z.object({ action: z.literal('dedup_cleanup'), school_id: z.string().uuid(), dry_run: z.boolean() }),
  z.object({ action: z.literal('reconcile'), school_id: z.string().uuid() }),
  z.object({ action: z.literal('push'), school_id: z.string().uuid(), retry: z.boolean().optional() }),
  z.object({ action: z.literal('cron') }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Retorno da autorização da Olist.
    if (req.method === 'GET') {
      const u = new URL(req.url);
      const code = u.searchParams.get('code'), state = u.searchParams.get('state');
      if (!code || !state) return new Response('Parâmetros ausentes', { status: 400 });
      const { data: conn } = await admin.from('erp_connections').select('*').eq('oauth_state', state).maybeSingle();
      if (!conn) return new Response('Autorização expirada. Volte à plataforma e tente de novo.', { status: 400 });
      const back = conn.oauth_return_url || '/';
      try {
        const s = await secrets(conn.id);
        const t = await tokenRequest({ grant_type: 'authorization_code', client_id: s.client_id!, client_secret: s.client_secret!, redirect_uri: REDIRECT, code });
        await admin.rpc('erp_set_secret', { _conn: conn.id, _field: 'refresh_token', _value: t.refresh_token });
        await admin.from('erp_connections').update({ authorized: true, oauth_state: null, last_error: null, updated_at: nowIso() }).eq('id', conn.id);
        return Response.redirect(`${back}${back.includes('?') ? '&' : '?'}olist=ok`, 302);
      } catch (e) {
        await admin.from('erp_connections').update({ last_error: e instanceof Error ? e.message : String(e), oauth_state: null }).eq('id', conn.id);
        return Response.redirect(`${back}${back.includes('?') ? '&' : '?'}olist=erro`, 302);
      }
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    if (b.action === 'cron') {
      const { data: ok } = await admin.rpc('bank_api_check_cron', { _token: req.headers.get('x-cron-token') ?? '' });
      if (!ok) return json({ error: 'unauthorized' }, 401);
      const { data: conns } = await admin.from('erp_connections').select('*').eq('enabled', true).eq('authorized', true);
      const out: unknown[] = [];
      for (const c of conns ?? []) {
        try { out.push({ school: c.school_id, ...(await runPush(c)) }); }
        catch (e) { const msg = e instanceof Error ? e.message : String(e); await admin.from('erp_connections').update({ last_error: msg, last_push_at: nowIso() }).eq('id', c.id); out.push({ school: c.school_id, erro: msg }); }
      }
      return json({ ok: true, out });
    }

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const [{ data: isAdmin }, { data: isSuper }, { data: sees }] = await Promise.all([
      userClient.rpc('is_admin'), userClient.rpc('is_super_admin'), userClient.rpc('admin_manages_school', { _school_id: b.school_id }),
    ]);
    if (!isAdmin || !sees) return json({ error: 'Sem acesso a esta empresa' }, 403);
    const superOnly = ['save_app', 'authorize', 'settings', 'save_link', 'dedup_cleanup'];
    if (superOnly.includes(b.action) && !isSuper) return json({ error: 'Só a administração pode configurar a integração com a Olist.' }, 403);

    let { data: conn } = await admin.from('erp_connections').select('*').eq('school_id', b.school_id).maybeSingle();
    if (!conn && b.action === 'save_app') {
      const r = await admin.from('erp_connections').insert({ school_id: b.school_id, created_by: u.user.id }).select('*').single();
      if (r.error) throw r.error; conn = r.data;
    }
    if (!conn) return json({ error: 'Cadastre primeiro o aplicativo da Olist.' }, 400);

    if (b.action === 'save_app') {
      if (b.client_id) await admin.rpc('erp_set_secret', { _conn: conn.id, _field: 'client_id', _value: b.client_id.trim() });
      if (b.client_secret) await admin.rpc('erp_set_secret', { _conn: conn.id, _field: 'client_secret', _value: b.client_secret.trim() });
      const s = await secrets(conn.id);
      await admin.from('erp_connections').update({ has_credentials: !!(s.client_id && s.client_secret), updated_at: nowIso() }).eq('id', conn.id);
      return json({ ok: true, redirect_uri: REDIRECT });
    }
    if (b.action === 'authorize') {
      const s = await secrets(conn.id);
      if (!s.client_id) return json({ error: 'Cadastre o Client ID antes.' }, 400);
      const state = crypto.randomUUID();
      await admin.from('erp_connections').update({ oauth_state: state, oauth_return_url: b.return_url }).eq('id', conn.id);
      const url = `${AUTH}/auth?client_id=${encodeURIComponent(s.client_id)}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=openid&response_type=code&state=${state}`;
      return json({ ok: true, url });
    }
    if (b.action === 'settings') {
      if (b.enabled && !conn.authorized) return json({ error: 'Autorize a Olist antes de ligar.' }, 400);
      if (conn.test_mode && !b.test_mode) await admin.from('erp_push_log').delete().eq('connection_id', conn.id).eq('status', 'simulado');
      await admin.from('erp_connections').update({ enabled: b.enabled, test_mode: b.test_mode, pending_categoria_id: b.pending_categoria_id, pending_categoria_nome: b.pending_categoria_nome, updated_at: nowIso() }).eq('id', conn.id);
      await admin.from('school_features').delete().eq('school_id', b.school_id).eq('feature_key', 'olist_erp');
      await admin.from('school_features').insert({ school_id: b.school_id, feature_key: 'olist_erp', enabled: b.enabled });
      return json({ ok: true });
    }
    if (b.action === 'catalog') {
      const token = await accessToken(conn);
      const [categorias, contas] = await Promise.all([listAll(token, '/categorias-receita-despesa'), listAll(token, '/contas-financeiras').catch(() => [])]);
      await fixLinks(conn.id, contas);
      const { data: used } = await admin.from('bank_transactions').select('model_item_id').eq('school_id', b.school_id).not('model_item_id', 'is', null).limit(20000);
      const ids = [...new Set((used ?? []).map(x => x.model_item_id))];
      const { data: items } = ids.length ? await admin.from('financial_model_template_items').select('id, name, tipo, entra_no_resultado, impacta_caixa').in('id', ids) : { data: [] };
      return json({ ok: true, categorias: categorias.map(c => ({ id: c.id, descricao: c.descricao, grupo: c.grupo ?? null })), contas: contas.map(c => ({ id: c.id, descricao: c.descricao })), items: items ?? [] });
    }
    if (b.action === 'save_link') {
      const { data: acc } = await admin.from('bank_accounts').select('id, is_virtual').eq('id', b.bank_account_id).eq('school_id', b.school_id).maybeSingle();
      if (!acc || acc.is_virtual) return json({ error: 'Conta não encontrada' }, 400);
      if (!b.olist_conta_id) { await admin.from('erp_account_links').delete().eq('bank_account_id', b.bank_account_id); return json({ ok: true }); }
      const { error } = await admin.from('erp_account_links').upsert({ connection_id: conn.id, school_id: b.school_id, bank_account_id: b.bank_account_id, olist_conta_id: b.olist_conta_id, olist_conta_nome: b.olist_conta_nome, start_date: b.start_date, updated_at: nowIso() }, { onConflict: 'bank_account_id' });
      if (error) throw error;
      return json({ ok: true });
    }
    if (b.action === 'save_map') {
      const rows = b.items.map(i => ({ school_id: b.school_id, ...i, updated_by: u.user.id, updated_at: nowIso() }));
      if (rows.length) { const { error } = await admin.from('erp_category_map').upsert(rows, { onConflict: 'school_id,model_item_id' }); if (error) throw error; }
      return json({ ok: true });
    }
    if (b.action === 'dedup_cleanup') return json({ ok: true, ...(await dedupCleanup(conn, b.dry_run)) });
    if (b.action === 'reconcile') return json({ ok: true, ...(await reconcile(conn)) });
    if (b.action === 'push') {
      if (!conn.enabled) return json({ error: 'A integração com a Olist está desligada.' }, 400);
      return json({ ok: true, ...(await runPush(conn, { retry: b.retry })) });
    }
    return json({ error: 'ação inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
