import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Check, Ban, Undo2, History, MessageSquare, ArrowLeftRight, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { useSetReconStatus, useSetTransferPair, useSetMovementKind, fetchReconHistory } from '@/hooks/useBankPilot';
import { runningBalances, suggestTransferPairs, isAutoInvest, type BankAccount, type BankTx, type ReconStatus } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, fmtDateTime, StatusBadge, STATUS_LABEL } from './shared';

interface Props { schoolId: string; accounts: BankAccount[]; txs: BankTx[]; defaultFrom: string; defaultTo: string }

export function BankTransactionsTable({ schoolId, accounts, txs, defaultFrom, defaultTo }: Props) {
  const [accountId, setAccountId] = useState<string>('all');
  const [status, setStatus] = useState<'all' | ReconStatus>('all');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteTx, setNoteTx] = useState<BankTx | null>(null);
  const [noteText, setNoteText] = useState('');
  const [history, setHistory] = useState<{ tx: BankTx; rows: Awaited<ReturnType<typeof fetchReconHistory>> } | null>(null);
  const [showPairs, setShowPairs] = useState(false);
  const [showAuto, setShowAuto] = useState(false);
  const setKind = useSetMovementKind(schoolId);
  const setRecon = useSetReconStatus(schoolId);
  const setPair = useSetTransferPair(schoolId);

  const accName = useMemo(() => new Map(accounts.map(a => [a.id, a.nome])), [accounts]);
  const balances = useMemo(() => runningBalances(accounts, txs, accountId), [accounts, txs, accountId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs
      .filter(t => (accountId === 'all' || t.account_id === accountId) && t.data >= from && t.data <= to && (status === 'all' || t.recon_status === status) && (!q || t.descricao.toLowerCase().includes(q)) && (showAuto || !isAutoInvest(t)))
      .sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }, [txs, accountId, from, to, status, search, showAuto]);
  const autoCount = txs.filter(t => isAutoInvest(t) && (accountId === 'all' || t.account_id === accountId) && t.data >= from && t.data <= to).length;

  const pend = rows.filter(r => r.recon_status === 'pendente');
  const pendValor = pend.reduce((s, r) => s + Number(r.valor), 0);
  const pairs = useMemo(() => suggestTransferPairs(txs.filter(t => t.data >= from && t.data <= to)), [txs, from, to]);

  const apply = async (ids: string[], st: ReconStatus, note?: string | null) => {
    if (!ids.length) return;
    try {
      await setRecon.mutateAsync({ ids, status: st, note });
      toast.success(`${ids.length} lançamento(s): ${STATUS_LABEL[st]}`);
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message ?? 'Erro ao atualizar'); }
  };

  const toggleAll = () => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));

  const openHistory = async (tx: BankTx) => {
    try { setHistory({ tx, rows: await fetchReconHistory(tx.id) }); } catch { toast.error('Erro ao carregar histórico'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <div className="w-48"><label className="text-xs text-muted-foreground">Conta</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas (consolidado)</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40"><label className="text-xs text-muted-foreground">Situação</label>
          <Select value={status} onValueChange={v => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="pendente">Só pendentes</SelectItem><SelectItem value="conciliado">Conciliados</SelectItem><SelectItem value="nao_se_aplica">Não se aplica</SelectItem></SelectContent>
          </Select>
        </div>
        <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="min-w-40 flex-1"><label className="text-xs text-muted-foreground">Buscar descrição</label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: PIX, tarifa…" /></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} lançamentos · <span className="font-semibold text-warning">{pend.length} pendentes ({fmtBRL(pendValor)})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {autoCount > 0 && <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={showAuto} onCheckedChange={v => setShowAuto(!!v)} />Mostrar aplicações automáticas ({autoCount})</label>}
          {pairs.length > 0 && <Button size="sm" variant="outline" onClick={() => setShowPairs(true)}><ArrowLeftRight className="mr-1 h-4 w-4" />Transferências sugeridas ({pairs.length})</Button>}
          <Button size="sm" disabled={!selected.size || setRecon.isPending} onClick={() => apply([...selected], 'conciliado')}><Check className="mr-1 h-4 w-4" />Conciliar selecionados ({selected.size})</Button>
          <Button size="sm" variant="outline" disabled={!selected.size || setRecon.isPending} onClick={() => apply([...selected], 'nao_se_aplica')}><Ban className="mr-1 h-4 w-4" />Não se aplica</Button>
          <Button size="sm" variant="ghost" disabled={!selected.size || setRecon.isPending} onClick={() => apply([...selected], 'pendente')}><Undo2 className="mr-1 h-4 w-4" />Voltar a pendente</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2"><Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={toggleAll} aria-label="Selecionar todos" /></th>
              <th className="p-2">Data</th><th className="p-2">Conta</th><th className="p-2">Descrição original</th>
              <th className="p-2 text-right">Entrada</th><th className="p-2 text-right">Saída</th><th className="p-2 text-right">Saldo</th>
              <th className="p-2">Origem</th><th className="p-2">Situação</th><th className="p-2">Conciliado por</th><th className="p-2">Em</th><th className="p-2">Observação</th><th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Nenhum lançamento no filtro.</td></tr>}
            {rows.map(t => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-2"><Checkbox checked={selected.has(t.id)} onCheckedChange={() => setSelected(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} /></td>
                <td className="p-2 whitespace-nowrap">{fmtDate(t.data)}</td>
                <td className="p-2 whitespace-nowrap">{accName.get(t.account_id) ?? '—'}</td>
                <td className="p-2">{t.descricao}{t.transfer_pair_id && <span className="ml-1 rounded bg-info/15 px-1.5 text-[10px] font-semibold text-info">Transferência interna</span>}{isAutoInvest(t) && <span className="ml-1 rounded bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">{t.movement_kind === 'auto_aplicacao' ? 'Aplicação automática' : 'Resgate automático'}</span>}</td>
                <td className="p-2 text-right tabular-nums text-success">{t.tipo === 'entrada' ? fmtBRL(Number(t.valor)) : ''}</td>
                <td className="p-2 text-right tabular-nums text-destructive">{t.tipo === 'saida' ? fmtBRL(Number(t.valor)) : ''}</td>
                <td className="p-2 text-right tabular-nums">{fmtBRL(balances.get(t.id) ?? 0)}</td>
                <td className="p-2 text-xs text-muted-foreground">Extrato</td>
                <td className="p-2"><StatusBadge status={t.recon_status} /></td>
                <td className="p-2 text-xs">{t.recon_by_email ?? '—'}</td>
                <td className="p-2 text-xs whitespace-nowrap">{fmtDateTime(t.recon_at)}</td>
                <td className="p-2 max-w-48 truncate text-xs" title={t.recon_note ?? ''}>{t.recon_note ?? ''}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    {t.recon_status !== 'conciliado' && <Button size="sm" variant="ghost" className="h-7 px-2 text-success" onClick={() => apply([t.id], 'conciliado')} title="Conciliar"><Check className="h-4 w-4" /></Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {t.recon_status !== 'nao_se_aplica' && <DropdownMenuItem onClick={() => apply([t.id], 'nao_se_aplica')}><Ban className="mr-2 h-4 w-4" />Não se aplica</DropdownMenuItem>}
                        {t.recon_status !== 'pendente' && <DropdownMenuItem onClick={() => apply([t.id], 'pendente')}><Undo2 className="mr-2 h-4 w-4" />Desfazer (pendente)</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => { setNoteTx(t); setNoteText(t.recon_note ?? ''); }}><MessageSquare className="mr-2 h-4 w-4" />Observação</DropdownMenuItem>
                        {t.transfer_pair_id && <DropdownMenuItem onClick={() => setPair.mutate({ ids: txs.filter(x => x.transfer_pair_id === t.transfer_pair_id).map(x => x.id), pairId: null })}><ArrowLeftRight className="mr-2 h-4 w-4" />Desfazer transferência interna</DropdownMenuItem>}
                        {isAutoInvest(t)
                          ? <DropdownMenuItem onClick={() => setKind.mutate({ ids: [t.id], kind: 'normal' })}><PiggyBank className="mr-2 h-4 w-4" />Não é aplicação automática</DropdownMenuItem>
                          : !t.transfer_pair_id && <DropdownMenuItem onClick={() => setKind.mutate({ ids: [t.id], kind: t.tipo === 'saida' ? 'auto_aplicacao' : 'auto_resgate' })}><PiggyBank className="mr-2 h-4 w-4" />Marcar como aplicação automática</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openHistory(t)}><History className="mr-2 h-4 w-4" />Histórico</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!noteTx} onOpenChange={o => !o && setNoteTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Observação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{noteTx?.descricao}</p>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button onClick={async () => { if (noteTx) { await apply([noteTx.id], noteTx.recon_status, noteText.trim() || null); setNoteTx(null); } }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!history} onOpenChange={o => !o && setHistory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Histórico de conciliação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{history?.tx.descricao}</p>
          {history?.rows.length === 0 ? <p className="text-sm">Sem alterações registradas.</p> : (
            <ul className="space-y-2 text-sm">
              {history?.rows.map(h => (
                <li key={h.id} className="rounded-lg border border-border p-2">
                  <p><strong>{STATUS_LABEL[(h.old_status ?? 'pendente') as ReconStatus]}</strong> → <strong>{STATUS_LABEL[h.new_status as ReconStatus]}</strong></p>
                  <p className="text-xs text-muted-foreground">{h.changed_by_email ?? '—'} · {fmtDateTime(h.changed_at)}</p>
                  {h.note && <p className="text-xs">{h.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPairs} onOpenChange={setShowPairs}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Transferências entre contas próprias</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Mesmo valor, sentidos opostos, contas diferentes, até 2 dias de diferença. Confirmadas, continuam no saldo de cada conta, mas saem das entradas e saídas do consolidado.</p>
          <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {pairs.map(([s, e]) => (
              <li key={s.id + e.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                <div>
                  <p>{fmtBRL(Number(s.valor))}: <strong>{accName.get(s.account_id)}</strong> ({fmtDate(s.data)}) → <strong>{accName.get(e.account_id)}</strong> ({fmtDate(e.data)})</p>
                  <p className="text-xs text-muted-foreground">{s.descricao} / {e.descricao}</p>
                </div>
                <Button size="sm" onClick={() => setPair.mutate({ ids: [s.id, e.id], pairId: crypto.randomUUID() }, { onSuccess: () => toast.success('Transferência confirmada') })}>Confirmar</Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
