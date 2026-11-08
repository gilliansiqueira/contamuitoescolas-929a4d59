import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark, RefreshCw, KeyRound, PlugZap } from 'lucide-react';
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
const isInter = (a: BankAccount) => /inter/i.test(`${a.banco ?? ''} ${a.nome ?? ''}`) && !(a as any).is_virtual;

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('inter-sync', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = typeof j.error === 'string' ? j.error : 'Dados inválidos'; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Dados inválidos');
  return data;
}

/** Integração Banco Inter (somente leitura): liga/desliga por conta, credenciais e leituras. */
export function InterApiPanel({ schoolId, accounts, onSynced }: { schoolId: string; accounts: BankAccount[]; onSynced: () => void }) {
  const { isSuperAdmin } = useAuth() as any;
  const qc = useQueryClient();
  const interAccounts = accounts.filter(a => a.ativa && isInter(a));
  const { data: conns = [] } = useQuery({
    queryKey: ['bank_api_connections', schoolId],
    queryFn: async () => { const { data } = await db.from('bank_api_connections').select('id,bank_account_id,enabled,start_date,conta_corrente,has_credentials,cert_expires_at,last_sync_at,last_ok_at,last_error,last_saldo').eq('school_id', schoolId); return (data ?? []) as any[]; },
  });
  const { data: runs = [] } = useQuery({
    queryKey: ['bank_api_sync_runs', schoolId],
    queryFn: async () => { const { data } = await db.from('bank_api_sync_runs').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(10); return (data ?? []) as any[]; },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['bank_api_connections'] }); qc.invalidateQueries({ queryKey: ['bank_api_sync_runs', schoolId] }); };
  const [busy, setBusy] = useState<string | null>(null);
  const [cfg, setCfg] = useState<{ accountId: string; start: string; conta: string; enabled: boolean } | null>(null);
  const [cred, setCred] = useState<{ connId: string; clientId: string; secret: string; cert: string; key: string } | null>(null);

  if (!interAccounts.length) return null;

  const run = async (id: string, body: Record<string, unknown>, ok: (d: any) => string) => {
    setBusy(id);
    try { const d = await call(body); toast.success(ok(d)); refresh(); onSynced(); }
    catch (e: any) { toast.error(e.message ?? 'Erro'); refresh(); }
    finally { setBusy(null); }
  };
  const readFile = (f: File | undefined, k: 'cert' | 'key') => { if (f) f.text().then(t => setCred(c => c && { ...c, [k]: t })); };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground"><Landmark className="h-4 w-4 text-primary" />Integração Banco Inter (leitura automática)</h3>
      <p className="mb-3 text-xs text-muted-foreground">Lê saldo e extrato direto do Inter, de madrugada (últimos 7 dias) e a cada 2 horas das 8h às 18h, de segunda a sábado. Só leitura: nunca faz pagamento nem PIX. Os lançamentos entram pendentes de conciliação, como um extrato enviado, sem duplicar o que já veio por OFX/PDF.</p>
      <div className="space-y-2">
        {interAccounts.map(a => {
          const c = conns.find(x => x.bank_account_id === a.id);
          const certDays = c?.cert_expires_at ? Math.floor((new Date(c.cert_expires_at).getTime() - Date.now()) / 864e5) : null;
          return (
            <div key={a.id} className="rounded-lg bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{a.nome} {c?.enabled ? <span className="ml-1 rounded bg-success/15 px-1.5 text-[10px] font-semibold text-success">Ligada</span> : <span className="ml-1 rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">Desligada</span>}</p>
                  {c ? (
                    <p className="text-xs text-muted-foreground">
                      A partir de {fmtDate(c.start_date)} · credenciais {c.has_credentials ? '••• configuradas' : 'não cadastradas'}
                      {c.cert_expires_at && <> · certificado vence em {fmtDate(c.cert_expires_at.slice(0, 10))}</>}
                      {c.last_ok_at && <> · última leitura {fmtDateTime(c.last_ok_at)}{c.last_saldo != null && <> · saldo {fmtBRL(Number(c.last_saldo))}</>}</>}
                    </p>
                  ) : <p className="text-xs text-muted-foreground">Ainda não configurada.</p>}
                  {c?.last_error && <p className="mt-1 text-xs text-destructive">Falha na última leitura: {c.last_error}</p>}
                  {certDays != null && certDays <= 30 && <p className="mt-1 text-xs text-warning-foreground">{certDays < 0 ? 'Certificado vencido: peça um novo ao cliente.' : `Certificado vence em ${certDays} dia(s).`}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {isSuperAdmin && <Button size="sm" variant="outline" onClick={() => setCfg({ accountId: a.id, start: c?.start_date ?? new Date().toISOString().slice(0, 10), conta: c?.conta_corrente ?? '', enabled: c?.enabled ?? false })}><PlugZap className="mr-1 h-4 w-4" />Configurar</Button>}
                  {isSuperAdmin && c && <Button size="sm" variant="outline" onClick={() => setCred({ connId: c.id, clientId: '', secret: '', cert: '', key: '' })}><KeyRound className="mr-1 h-4 w-4" />{c.has_credentials ? 'Trocar credenciais' : 'Cadastrar credenciais'}</Button>}
                  {c?.has_credentials && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(`t-${c.id}`, { action: 'test', connection_id: c.id }, d => `Conexão OK · saldo ${fmtBRL(Number(d.saldo))}`)}>Testar</Button>}
                  {c?.has_credentials && c.enabled && <Button size="sm" disabled={!!busy} onClick={() => run(`s-${c.id}`, { action: 'sync', connection_id: c.id }, d => `${d.inseridas} lançamento(s) novos · ${d.jaExistiam} já existiam · saldo ${fmtBRL(Number(d.saldo))}`)}><RefreshCw className={`mr-1 h-4 w-4 ${busy === `s-${c.id}` ? 'animate-spin' : ''}`} />Sincronizar agora</Button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {runs.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Histórico da integração</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {runs.map(r => (
              <li key={r.id} className={r.ok ? 'text-muted-foreground' : 'text-destructive'}>
                {fmtDateTime(r.created_at)} · {({ sync: 'Leitura', teste: 'Teste', ligar: 'Ligada', desligar: 'Desligada', credenciais: 'Credenciais alteradas' } as any)[r.acao] ?? r.acao}
                {r.origem !== 'manual' ? ' automática' : ''} · {r.user_email ?? '—'}
                {r.acao === 'sync' && r.ok && <> · {r.inseridas} novos, {r.ja_existiam} já existiam{r.saldo != null && <>, saldo {fmtBRL(Number(r.saldo))}</>}</>}
                {r.erro && <> · {r.erro}</>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={!!cfg} onOpenChange={o => !o && setCfg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar integração Banco Inter</DialogTitle><DialogDescription>Os lançamentos entram a partir da data de início. Antes dela, vale o extrato já enviado.</DialogDescription></DialogHeader>
          {cfg && <div className="space-y-3">
            <div><Label>Data de início</Label><Input type="date" value={cfg.start} onChange={e => setCfg({ ...cfg, start: e.target.value })} /></div>
            <div><Label>Número da conta corrente (opcional)</Label><Input value={cfg.conta} onChange={e => setCfg({ ...cfg, conta: e.target.value })} placeholder="Só se o cliente tiver mais de uma conta no Inter" /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={cfg.enabled} onCheckedChange={v => setCfg({ ...cfg, enabled: v })} />Leitura automática ligada</label>
          </div>}
          <DialogFooter><Button disabled={!!busy} onClick={async () => { if (!cfg) return; await run('cfg', { action: 'save_config', school_id: schoolId, bank_account_id: cfg.accountId, start_date: cfg.start, conta_corrente: cfg.conta.trim() || null, enabled: cfg.enabled }, () => 'Integração salva'); const prev = conns.find(x => x.bank_account_id === cfg.accountId); setCfg(null);
              const { data: row } = await db.from('bank_api_connections').select('id,has_credentials').eq('bank_account_id', cfg.accountId).maybeSingle();
              if (row && !row.has_credentials && !prev?.has_credentials) setCred({ connId: row.id, clientId: '', secret: '', cert: '', key: '' }); }}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cred} onOpenChange={o => !o && setCred(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Credenciais do Banco Inter</DialogTitle><DialogDescription>Ficam guardadas criptografadas e não podem ser vistas depois. Peça ao cliente para marcar apenas a permissão de consulta de extrato e saldo.</DialogDescription></DialogHeader>
          {cred && <div className="space-y-3">
            <div><Label>Client ID</Label><Input value={cred.clientId} onChange={e => setCred({ ...cred, clientId: e.target.value })} autoComplete="off" /></div>
            <div><Label>Client Secret</Label><Input type="password" value={cred.secret} onChange={e => setCred({ ...cred, secret: e.target.value })} autoComplete="off" /></div>
            <div><Label>Certificado (.crt)</Label><Input type="file" accept=".crt,.pem" onChange={e => readFile(e.target.files?.[0], 'cert')} />{cred.cert && <p className="text-xs text-success">Arquivo lido</p>}</div>
            <div><Label>Chave (.key)</Label><Input type="file" accept=".key,.pem" onChange={e => readFile(e.target.files?.[0], 'key')} />{cred.key && <p className="text-xs text-success">Arquivo lido</p>}</div>
          </div>}
          <DialogFooter><Button disabled={!!busy || !cred?.clientId || !cred?.secret || !cred?.cert || !cred?.key} onClick={async () => {
            if (!cred) return;
            await run('cred', { action: 'save_credentials', connection_id: cred.connId, client_id: cred.clientId, client_secret: cred.secret, cert: cred.cert, key: cred.key }, d => `Credenciais salvas${d.cert_expires_at ? ` · certificado vale até ${fmtDate(String(d.cert_expires_at).slice(0, 10))}` : ''}. Clique em Testar.`);
            setCred(null);
          }}>Salvar credenciais</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
