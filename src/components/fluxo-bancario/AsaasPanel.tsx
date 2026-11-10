import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, PlugZap, Eye, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtBRL, fmtDateTime } from './shared';

const db = supabase as any;
const sel = 'h-8 rounded-md border border-input bg-background px-2 text-xs';
const CANAL: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', undefined: 'Cliente escolhe', desconhecido: 'Não identificado' };
const STATUS: Record<string, string> = { approved: 'Recebido', pending: 'Aguardando', overdue: 'Vencido', refunded: 'Estornado', charged_back: 'Contestado', deleted: 'Excluído' };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('asaas-sync', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = String(j.error); } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(String(data.error));
  return data;
}
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/** Asaas — Cobranças recebidas (somente leitura). Piloto controlado pela administração. */
export function AsaasPanel({ schoolId }: { schoolId: string }) {
  const { isSuperAdmin } = useAuth() as any;
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [token, setToken] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [canal, setCanal] = useState('todos');
  const [preview, setPreview] = useState<any>(null);
  const [extra, setExtra] = useState<any>(null);

  const { data: conn } = useQuery({
    queryKey: ['acquirer_connections', 'asaas', schoolId],
    queryFn: async () => (await db.from('acquirer_connections').select('id,enabled,has_token,token_kind,account_id,account_nickname,start_date,last_test_at,last_sync_at,last_ok_at,last_error').eq('school_id', schoolId).eq('provider', 'asaas').maybeSingle()).data,
  });
  const { data: runs = [] } = useQuery({
    queryKey: ['acquirer_sync_runs', conn?.id], enabled: !!conn?.id,
    queryFn: async () => (await db.from('acquirer_sync_runs').select('id,action,date_from,date_to,status,fetched,inserted,updated,unchanged,error,started_at').eq('connection_id', conn.id).order('started_at', { ascending: false }).limit(10)).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['acquirer_sales', 'asaas', schoolId, from, to], enabled: !!conn?.id,
    queryFn: async () => (await db.from('acquirer_sales').select('external_id,order_id,external_reference,canal,canal_evidencia,status,payment_type,payment_method,installments,valor_bruto,taxas,valor_liquido,valor_estornado,date_created,money_release_date,date_last_updated').eq('school_id', schoolId).eq('provider', 'asaas').gte('date_created', `${from}T00:00:00-03:00`).lte('date_created', `${to}T23:59:59-03:00`).order('date_created', { ascending: false }).limit(1000)).data ?? [],
  });

  const rows = useMemo(() => sales.filter((s: any) => canal === 'todos' || s.canal === canal), [sales, canal]);
  const tot = useMemo(() => rows.filter((s: any) => s.status === 'approved').reduce((a: any, s: any) => {
    const liq = s.valor_liquido == null ? Number(s.valor_bruto) - Number(s.taxas) : Number(s.valor_liquido);
    a.bruto += Number(s.valor_bruto); a.taxas += Number(s.taxas); a.liquido += liq;
    a.dif += Math.abs(Number(s.valor_bruto) - Number(s.taxas) - liq) > 0.01 ? 1 : 0; return a;
  }, { bruto: 0, taxas: 0, liquido: 0, dif: 0 }), [rows]);

  if (!isSuperAdmin && !conn?.enabled) return null;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acquirer_connections', 'asaas', schoolId] }); qc.invalidateQueries({ queryKey: ['acquirer_sync_runs'] }); qc.invalidateQueries({ queryKey: ['acquirer_sales', schoolId] }); };
  const run = async (key: string, body: Record<string, unknown>, ok?: (d: any) => void) => {
    setBusy(key);
    try { const d = await call({ school_id: schoolId, ...body }); ok?.(d); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); refresh(); }
    finally { setBusy(null); }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Asaas — Cobranças recebidas</h3>
          <p className="text-xs text-muted-foreground">
            {conn?.has_token ? <>Chave guardada no backend ({conn.token_kind === 'teste' ? 'TESTE — dados fictícios' : 'produção'}){conn.account_nickname ? ` · conta ${conn.account_nickname}` : ''}</> : 'Ainda não conectado'}
            {conn?.last_ok_at && <> · última leitura {fmtDateTime(conn.last_ok_at)}</>}
          </p>
          {conn?.last_error && <p className="text-xs text-destructive">{conn.last_error}</p>}
        </div>
        {isSuperAdmin && conn?.has_token && (
          <label className="flex items-center gap-2 text-xs">Piloto ligado
            <Switch checked={!!conn.enabled} disabled={!!busy} onCheckedChange={(v) => run('pilot', { action: 'pilot', enabled: v })} />
          </label>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
        <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
        <span><strong>Somente leitura.</strong> Não cria cobranças, não lança nada no Tiny/Olist nem no Fluxo Bancário. Os repasses do Asaas já chegam pelo extrato do banco; aqui só se vê o detalhe (cliente, taxa, data de crédito).</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setTokenOpen(true)}><KeyRound className="mr-1 h-3.5 w-3.5" />{conn?.has_token ? 'Trocar chave' : 'Cadastrar chave'}</Button>
        <Button size="sm" variant="outline" disabled={!conn?.has_token || !!busy} onClick={() => run('test', { action: 'test' }, (d) => toast.success(`Conectado: ${d.conta?.nome ?? 'conta Asaas'}`))}><PlugZap className="mr-1 h-3.5 w-3.5" />Testar conexão</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">De</Label><Input type="date" className="h-8 text-xs" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" className="h-8 text-xs" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">Canal</Label>
          <select className={sel} value={canal} onChange={e => setCanal(e.target.value)}>
            <option value="todos">Todos</option>{Object.entries(CANAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <Button size="sm" variant="outline" disabled={!conn?.has_token || !!busy} onClick={() => run('preview', { action: 'preview', from, to }, setPreview)}><Eye className="mr-1 h-3.5 w-3.5" />{busy === 'preview' ? 'Lendo…' : 'Prévia (não grava)'}</Button>
        <Button size="sm" disabled={!conn?.has_token || !preview || !!busy} title={!preview ? 'Faça a prévia antes' : ''} onClick={() => run('sync', { action: 'sync', from, to }, (d) => { toast.success(`Gravado: ${d.summary.novos} novas, ${d.summary.atualizados} atualizadas`); setPreview(null); })}><RefreshCw className="mr-1 h-3.5 w-3.5" />{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar'}</Button>
      </div>

      {preview?.summary && (
        <div className="rounded-md border border-border p-2 text-xs space-y-1">
          <p><strong>Prévia:</strong> {preview.summary.quantidade} pagamentos · aprovados: bruto {fmtBRL(preview.summary.bruto)}, taxas {fmtBRL(preview.summary.taxas)}, líquido {fmtBRL(preview.summary.liquido)}, estornado {fmtBRL(preview.summary.estornado)}</p>
          <p>Gravaria: {preview.summary.novos} novas · {preview.summary.atualizados} atualizadas · {preview.summary.iguais} sem mudança{preview.summary.truncado && <span className="text-destructive"> · limite de leitura atingido, use um período menor</span>}</p>
          <p>Por canal: {Object.entries(preview.summary.porCanal).map(([k, v]: any) => `${CANAL[k] ?? k}: ${v.quantidade} (${fmtBRL(v.liquido)})`).join(' · ') || '—'}</p>
          <p>Por situação: {Object.entries(preview.summary.porStatus).map(([k, v]) => `${STATUS[k] ?? k}: ${v}`).join(' · ')}</p>
        </div>
      )}

      {conn?.id && (
        <>
          <div className="flex flex-wrap gap-4 text-xs">
            <span>Aprovados no filtro: bruto <strong>{fmtBRL(tot.bruto)}</strong></span>
            <span>taxas <strong>{fmtBRL(tot.taxas)}</strong></span>
            <span>líquido <strong>{fmtBRL(tot.liquido)}</strong></span>
            {tot.dif > 0 && <span className="text-warning">{tot.dif} venda(s) com líquido ≠ bruto − taxas (ver coluna Diferença)</span>}
          </div>
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted"><tr className="text-left">
                <th className="p-1.5">Venda</th><th className="p-1.5">Canal</th><th className="p-1.5">Situação</th><th className="p-1.5">Meio</th>
                <th className="p-1.5 text-right">Bruto</th><th className="p-1.5 text-right">Taxas</th><th className="p-1.5 text-right">Líquido</th><th className="p-1.5 text-right">Diferença</th><th className="p-1.5">Liberação</th><th className="p-1.5">ID / pedido</th>
              </tr></thead>
              <tbody>
                {rows.map((s: any) => {
                  const liq = s.valor_liquido == null ? null : Number(s.valor_liquido);
                  const dif = liq == null ? null : Number(s.valor_bruto) - Number(s.taxas) - liq;
                  return (
                    <tr key={s.external_id} className="border-t border-border">
                      <td className="p-1.5 whitespace-nowrap">{fmtDateTime(s.date_created)}</td>
                      <td className="p-1.5" title={s.canal_evidencia ?? 'sem evidência'}>{CANAL[s.canal] ?? s.canal}</td>
                      <td className="p-1.5">{STATUS[s.status] ?? s.status}{Number(s.valor_estornado) > 0 && ` (estorno ${fmtBRL(Number(s.valor_estornado))})`}</td>
                      <td className="p-1.5">{s.payment_method}{s.installments > 1 ? ` ${s.installments}x` : ''}</td>
                      <td className="p-1.5 text-right">{fmtBRL(Number(s.valor_bruto))}</td>
                      <td className="p-1.5 text-right">{fmtBRL(Number(s.taxas))}</td>
                      <td className="p-1.5 text-right">{liq == null ? '—' : fmtBRL(liq)}</td>
                      <td className={`p-1.5 text-right ${dif && Math.abs(dif) > 0.01 ? 'text-warning' : 'text-muted-foreground'}`}>{dif == null ? '—' : fmtBRL(dif)}</td>
                      <td className="p-1.5 whitespace-nowrap">{s.money_release_date ? fmtDateTime(s.money_release_date) : '—'}</td>
                      <td className="p-1.5 text-muted-foreground">{s.external_id}{s.order_id ? ` · ${s.order_id}` : ''}{s.external_reference ? ` · ${s.external_reference}` : ''}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={10} className="p-3 text-center text-muted-foreground">Nenhuma cobrança gravada neste período.</td></tr>}
              </tbody>
            </table>
          </div>
          {runs.length > 0 && (
            <div className="text-xs">
              <p className="font-medium">Histórico de leituras</p>
              {runs.map((r: any) => (
                <p key={r.id} className={r.status === 'erro' ? 'text-destructive' : 'text-muted-foreground'}>
                  {fmtDateTime(r.started_at)} · {r.action === 'sync' ? 'Sincronização' : 'Prévia'} {r.date_from}→{r.date_to} · {r.status === 'erro' ? r.error : `${r.fetched} lidas, ${r.inserted} novas, ${r.updated} atualizadas, ${r.unchanged} iguais`}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={tokenOpen} onOpenChange={setTokenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave de API do Asaas</DialogTitle>
            <DialogDescription>No Asaas: Integrações › Chaves de API › Gerar chave (começa com $aact_). Ela fica criptografada no backend e não volta a aparecer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div><Label className="text-xs">Chave de API</Label><Input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></div>
            <div><Label className="text-xs">Ler a partir de</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button disabled={token.trim().length < 10 || !!busy} onClick={() => run('save', { action: 'save_credentials', token: token.trim(), start_date: startDate }, (d) => { toast.success(`Chave salva (${d.token_kind === 'teste' ? 'teste' : 'produção'})`); setToken(''); setTokenOpen(false); })}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!extra} onOpenChange={(o) => !o && setExtra(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{extra?.titulo}</DialogTitle></DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{JSON.stringify(extra?.dados, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </section>
  );
}
