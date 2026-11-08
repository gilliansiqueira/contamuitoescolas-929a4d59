import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, KeyRound, RefreshCw, Link2, Tags } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BankAccount } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, fmtDateTime } from './shared';

const db = supabase as any;
const sel = 'h-8 rounded-md border border-input bg-background px-2 text-xs';
const REDIRECT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/olist-sync`;

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('olist-sync', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = typeof j.error === 'string' ? j.error : 'Dados inválidos'; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Dados inválidos');
  return data;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  enviado: { label: 'Enviado', cls: 'bg-success/15 text-success' },
  a_classificar: { label: 'A classificar', cls: 'bg-warning/15 text-warning' },
  erro: { label: 'Erro', cls: 'bg-destructive/15 text-destructive' },
  simulado: { label: 'Teste', cls: 'bg-muted text-muted-foreground' },
  ja_existia: { label: 'Já existia na Olist', cls: 'bg-muted text-muted-foreground' },
  simulado_existia: { label: 'Teste: já existia', cls: 'bg-muted text-muted-foreground' },
};
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Traduz a resposta técnica da Olist num motivo curto e acionável. */
function friendlyErro(e: string): string {
  const m = [...e.matchAll(/"campo":"([^"]*)","mensagem":"([^"]+)"/g)];
  if (/conta\.id|contaOrigem|contaDestino/.test(e) && /inv[aá]lid/i.test(e)) return 'Conta da Olist inválida — escolha de novo em Contas e categorias.';
  if (/categoria/.test(e) && /inv[aá]lid/i.test(e)) return 'Categoria da Olist inválida — revise o De/Para.';
  if (/\b401\b/.test(e)) return 'Autorização vencida — clique em Autorizar na Olist.';
  if (/\b403\b/.test(e)) return 'Sem permissão no aplicativo da Olist (Caixa / Contas).';
  if (m.length) return m.map(x => x[2]).join('; ');
  return e.slice(0, 80);
}

/** Integração Olist ERP: envia para a Olist os lançamentos lidos do banco. */
export function OlistErpPanel({ schoolId, accounts }: { schoolId: string; accounts: BankAccount[] }) {
  const { isSuperAdmin } = useAuth() as any;
  const qc = useQueryClient();
  const { data: conn } = useQuery({
    queryKey: ['erp_connections', schoolId],
    queryFn: async () => { const { data } = await db.from('erp_connections').select('id,enabled,test_mode,has_credentials,authorized,pending_categoria_id,pending_categoria_nome,last_push_at,last_ok_at,last_error').eq('school_id', schoolId).maybeSingle(); return data as any; },
  });
  const { data: links = [] } = useQuery({
    queryKey: ['erp_account_links', schoolId],
    queryFn: async () => { const { data } = await db.from('erp_account_links').select('*').eq('school_id', schoolId); return (data ?? []) as any[]; },
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['erp_push_log', schoolId],
    queryFn: async () => { const { data } = await db.from('erp_push_log').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(40); return (data ?? []) as any[]; },
    enabled: !!conn,
  });
  const refresh = () => ['erp_connections', 'erp_account_links', 'erp_push_log'].forEach(k => qc.invalidateQueries({ queryKey: [k, schoolId] }));
  const [busy, setBusy] = useState<string | null>(null);
  const [app, setApp] = useState<{ id: string; secret: string } | null>(null);
  const [catalog, setCatalog] = useState<{ categorias: any[]; contas: any[]; items: any[] } | null>(null);
  const [mapDraft, setMapDraft] = useState<Record<string, string>>({});
  const [cleanup, setCleanup] = useState<{ apagar: any[]; manter: number } | null>(null);
  const [recon, setRecon] = useState<{ contas: any[] } | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, { conta: string; start: string }>>({});

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('olist');
    if (p === 'ok') toast.success('Olist autorizada.'); else if (p === 'erro') toast.error('A Olist não confirmou a autorização. Veja o erro no painel.');
  }, []);

  if (!isSuperAdmin && !conn?.enabled) return null;

  const run = async (id: string, body: Record<string, unknown>, ok?: (d: any) => string) => {
    setBusy(id);
    try { const d = await call({ school_id: schoolId, ...body }); if (ok) toast.success(ok(d)); refresh(); return d; }
    catch (e: any) { toast.error(e.message ?? 'Erro'); refresh(); }
    finally { setBusy(null); }
  };
  const loadCatalog = async () => {
    const d = await run('catalog', { action: 'catalog' });
    if (!d) return;
    setCatalog(d);
    const { data: maps } = await db.from('erp_category_map').select('model_item_id, olist_categoria_id').eq('school_id', schoolId);
    setMapDraft(Object.fromEntries((maps ?? []).map((m: any) => [m.model_item_id, m.olist_categoria_id ? String(m.olist_categoria_id) : ''])));
    setLinkDraft(Object.fromEntries(accounts.filter(a => a.ativa && !(a as any).is_virtual).map(a => {
      const l = links.find(x => x.bank_account_id === a.id);
      return [a.id, { conta: l ? String(l.olist_conta_id) : '', start: l?.start_date ?? new Date().toISOString().slice(0, 10) }];
    })));
  };
  const suggestMap = () => {
    if (!catalog) return;
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    setMapDraft(d => {
      const n = { ...d };
      for (const it of catalog.items) if (!n[it.id]) { const c = catalog.categorias.find(c => norm(c.descricao) === norm(it.name)); if (c) n[it.id] = String(c.id); }
      return n;
    });
  };
  const catName = (id: string) => catalog?.categorias.find(c => String(c.id) === id)?.descricao ?? null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground"><Send className="h-4 w-4 text-primary" />Integração Olist ERP (envio automático)</h3>
      <p className="mb-3 text-xs text-muted-foreground">Cada lançamento lido do banco vai para a conta bancária ligada na Olist: dá baixa na conta em aberto quando encontra uma única com o mesmo valor (vencimento até 7 dias depois ou 3 antes); senão lança no Caixa da Olist. A categoria vem da escolhida aqui ou do histórico; sem segurança, vai como "A classificar". Nada disso altera os números da plataforma.</p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-1.5 font-semibold ${conn?.enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{conn?.enabled ? (conn.test_mode ? 'Ligada em modo teste' : 'Ligada') : 'Desligada'}</span>
        <span className="text-muted-foreground">Aplicativo {conn?.has_credentials ? 'cadastrado' : 'não cadastrado'} · {conn?.authorized ? 'autorizada' : 'não autorizada'}</span>
        {conn?.last_push_at && <span className="text-muted-foreground">· último envio {fmtDateTime(conn.last_push_at)}</span>}
      </div>
      {conn?.last_error && <p className="mt-1 text-xs text-destructive">{conn.last_error}</p>}
      {recon && (
        <div className="mt-3 rounded-lg border border-border p-3 text-xs">
          <div className="mb-1 flex justify-between font-semibold">Banco × Olist (movimento desde a data de início)<button className="text-muted-foreground" onClick={() => setRecon(null)}>fechar</button></div>
          {recon.contas.map((c: any) => (
            <div key={c.conta} className="mb-2">
              <p>{c.conta} desde {c.desde.split('-').reverse().join('/')}: banco {brl(c.movBanco)} · Olist {brl(c.movOlist)} · <span className={Math.abs(c.diferenca) > 0.009 ? 'font-semibold text-destructive' : 'font-semibold text-success'}>diferença {brl(c.diferenca)}</span></p>
              {c.dias.length > 0 && <table className="mt-1 w-full"><thead><tr className="text-muted-foreground"><th className="text-left">Dia</th><th className="text-right">Banco</th><th className="text-right">Olist</th><th className="text-right">Diferença</th></tr></thead>
                <tbody>{c.dias.map((d: any) => <tr key={d.data}><td>{d.data.split('-').reverse().join('/')}</td><td className="text-right">{brl(d.banco)}</td><td className="text-right">{brl(d.olist)}</td><td className="text-right text-destructive">{brl(d.diferenca)}</td></tr>)}</tbody></table>}
            </div>
          ))}
        </div>
      )}
      {cleanup && (
        <div className="mt-3 rounded-lg border border-destructive/40 p-3 text-xs">
          <p className="mb-1 font-semibold">{cleanup.apagar.length} lançamento(s) criados pela plataforma já existiam na Olist e serão apagados · {cleanup.manter} faltavam lá e ficam.</p>
          <div className="max-h-48 overflow-auto">{cleanup.apagar.map((a: any) => <div key={a.olist_id}>{a.data.split('-').reverse().join('/')} · {a.descricao} · {brl(a.valor)} ({a.tipo})</div>)}</div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive" disabled={!cleanup.apagar.length || busy === 'clean2'} onClick={async () => { const d = await run('clean2', { action: 'dedup_cleanup', dry_run: false }, d => `${d.apagar.length} duplicado(s) apagado(s) na Olist.`); if (d) setCleanup(null); }}>Apagar estes na Olist</Button>
            <Button size="sm" variant="outline" onClick={() => setCleanup(null)}>Cancelar</Button>
          </div>
        </div>
      )}


      <div className="mt-3 flex flex-wrap gap-2">
        {isSuperAdmin && <Button size="sm" variant="outline" onClick={() => setApp({ id: '', secret: '' })}><KeyRound className="mr-1 h-3.5 w-3.5" />Aplicativo Olist</Button>}
        {isSuperAdmin && conn?.has_credentials && (
          <Button size="sm" variant="outline" disabled={busy === 'auth'} onClick={async () => { const d = await run('auth', { action: 'authorize', return_url: window.location.href.split('?')[0] }); if (d?.url) window.location.href = d.url; }}>Autorizar na Olist</Button>
        )}
        {isSuperAdmin && conn?.authorized && <Button size="sm" variant="outline" disabled={busy === 'catalog'} onClick={loadCatalog}><Tags className="mr-1 h-3.5 w-3.5" />Contas e categorias</Button>}
        {conn?.authorized && <Button size="sm" variant="outline" disabled={busy === 'recon'} onClick={async () => { const d = await run('recon', { action: 'reconcile' }); if (d) setRecon(d); }}>Conferir com a Olist</Button>}
        {isSuperAdmin && conn?.authorized && <Button size="sm" variant="outline" disabled={busy === 'clean'} onClick={async () => { const d = await run('clean', { action: 'dedup_cleanup', dry_run: true }); if (d) setCleanup(d); }}>Desfazer duplicados</Button>}
        {conn?.enabled && <Button size="sm" disabled={busy === 'push'} onClick={() => run('push', { action: 'push' }, d => conn.test_mode ? `Teste: ${d.simulados} lançamento(s) simulados.` : `${d.enviados} enviado(s), ${d.aClassificar} a classificar, ${d.jaExistia ?? 0} já existiam, ${d.erros} com erro.`)}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${busy === 'push' ? 'animate-spin' : ''}`} />Enviar agora</Button>}
        {conn?.enabled && logs.some(l => l.status === 'erro') && <Button size="sm" variant="outline" disabled={busy === 'retry'} onClick={() => run('retry', { action: 'push', retry: true }, d => `Reenvio: ${d.enviados + d.aClassificar} ok, ${d.erros} com erro.`)}>Reenviar com erro</Button>}
      </div>

      {isSuperAdmin && conn?.authorized && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-muted/30 p-3 text-xs">
          <label className="flex items-center gap-2"><Switch checked={!!conn.enabled} onCheckedChange={v => run('set', { action: 'settings', enabled: v, test_mode: conn.test_mode, pending_categoria_id: conn.pending_categoria_id, pending_categoria_nome: conn.pending_categoria_nome }, () => 'Salvo.')} />Ligada</label>
          <label className="flex items-center gap-2"><Switch checked={!!conn.test_mode} onCheckedChange={v => run('set', { action: 'settings', enabled: conn.enabled, test_mode: v, pending_categoria_id: conn.pending_categoria_id, pending_categoria_nome: conn.pending_categoria_nome }, () => v ? 'Modo teste ligado.' : 'Envio real ligado.')} />Modo teste (só mostra o que seria enviado)</label>
          <span className="text-muted-foreground">Categoria "A classificar" na Olist: <b>{conn.pending_categoria_nome ?? 'nenhuma (envia sem categoria)'}</b></span>
        </div>
      )}

      {catalog && isSuperAdmin && (
        <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold"><Link2 className="h-3.5 w-3.5" />Conta bancária na Olist</p>
            {Object.entries(linkDraft).map(([accId, l]) => (
              <div key={accId} className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="w-40 truncate">{accounts.find(a => a.id === accId)?.nome}</span>
                <select className={sel} value={l.conta} onChange={e => setLinkDraft(d => ({ ...d, [accId]: { ...l, conta: e.target.value } }))}>
                  <option value="">Não enviar</option>
                  {catalog.contas.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
                <span>a partir de</span>
                <Input type="date" className="h-8 w-36 text-xs" value={l.start} onChange={e => setLinkDraft(d => ({ ...d, [accId]: { ...l, start: e.target.value } }))} />
                <Button size="sm" variant="outline" className="h-8" onClick={() => run('link', { action: 'save_link', bank_account_id: accId, olist_conta_id: l.conta ? Number(l.conta) : null, olist_conta_nome: catalog.contas.find(c => String(c.id) === l.conta)?.descricao ?? null, start_date: l.start }, () => 'Conta salva.')}>Salvar</Button>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold">Categoria "A classificar" na Olist</p>
            <select className={sel} value={conn?.pending_categoria_id ?? ''} onChange={e => run('set', { action: 'settings', enabled: conn.enabled, test_mode: conn.test_mode, pending_categoria_id: e.target.value ? Number(e.target.value) : null, pending_categoria_nome: catName(e.target.value) }, () => 'Salvo.')}>
              <option value="">Nenhuma (envia sem categoria)</option>
              {catalog.categorias.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between"><p className="text-xs font-semibold">De/Para de categorias</p><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={suggestMap}>Sugerir pelo nome</Button></div>
            <div className="max-h-72 space-y-1 overflow-auto">
              {catalog.items.map(it => (
                <div key={it.id} className="flex items-center gap-2 text-xs">
                  <span className="w-56 truncate">{it.name}{it.impacta_caixa && !it.entra_no_resultado && <span className="ml-1 text-muted-foreground">(operação: vai ao Caixa sem categoria)</span>}</span>
                  <select className={sel} value={mapDraft[it.id] ?? ''} onChange={e => setMapDraft(d => ({ ...d, [it.id]: e.target.value }))}>
                    <option value="">—</option>
                    {catalog.categorias.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-2" disabled={busy === 'map'} onClick={() => run('map', { action: 'save_map', items: catalog.items.map(it => ({ model_item_id: it.id, olist_categoria_id: mapDraft[it.id] ? Number(mapDraft[it.id]) : null, olist_categoria_nome: catName(mapDraft[it.id] ?? '') })) }, () => 'De/Para salvo.')}>Salvar De/Para</Button>
          </div>
        </div>
      )}

      {!!logs.length && (
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground"><tr><th className="py-1">Data</th><th>Descrição</th><th className="text-right">Valor</th><th>Na Olist</th><th>Status</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t border-border/60" title={l.erro ?? ''}>
                  <td className="py-1">{fmtDate(l.data)}</td>
                  <td className="max-w-[16rem] truncate">{l.descricao}</td>
                  <td className={`text-right ${l.tipo === 'saida' ? 'text-destructive' : 'text-success'}`}>{fmtBRL(Number(l.valor))}</td>
                  <td>{l.acao === 'baixa' ? 'Baixa em conta existente' : 'Lançamento no Caixa'}</td>
                  <td><span className={`rounded px-1.5 font-semibold ${STATUS[l.status]?.cls ?? ''}`}>{STATUS[l.status]?.label ?? l.status}</span>{l.erro && <span className="ml-1 text-destructive">{friendlyErro(String(l.erro))}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!app} onOpenChange={o => !o && setApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicativo da Olist</DialogTitle>
            <DialogDescription>Na Olist ERP, crie um aplicativo (Configurações › Aplicativos) e use este endereço de retorno: <code className="break-all">{REDIRECT}</code>. Depois cole aqui o Client ID e o Client Secret. Ficam criptografados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div><Label>Client ID</Label><Input value={app?.id ?? ''} onChange={e => setApp(a => a && { ...a, id: e.target.value })} placeholder={conn?.has_credentials ? '••• já cadastrado (deixe vazio para manter)' : ''} /></div>
            <div><Label>Client Secret</Label><Input type="password" value={app?.secret ?? ''} onChange={e => setApp(a => a && { ...a, secret: e.target.value })} placeholder={conn?.has_credentials ? '••• já cadastrado' : ''} /></div>
          </div>
          <DialogFooter>
            <Button disabled={busy === 'app'} onClick={async () => { const d = await run('app', { action: 'save_app', client_id: app?.id || undefined, client_secret: app?.secret || undefined }, () => 'Aplicativo salvo. Agora clique em "Autorizar na Olist".'); if (d) setApp(null); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
