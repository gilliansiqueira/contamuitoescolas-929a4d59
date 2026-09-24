import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Check, Ban, Undo2, History, MessageSquare, ArrowLeftRight, PiggyBank, Pencil, Layers, Split, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSetReconStatus, useSetTransferPair, useSetMovementKind, useUpdateTxText, useSetSplits, fetchReconHistory } from '@/hooks/useBankPilot';
import { runningBalances, suggestTransferPairs, isAutoInvest, isOperacao, displayDesc, type BankAccount, type BankTx, type ReconStatus, type SplitCategoria } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, fmtDateTime, StatusBadge, STATUS_LABEL } from './shared';

interface Props { schoolId: string; accounts: BankAccount[]; txs: BankTx[]; defaultFrom: string; defaultTo: string }

export function BankTransactionsTable({ schoolId, accounts, txs, defaultFrom, defaultTo }: Props) {
  const [accountId, setAccountId] = useState<string>('all');
  const [status, setStatus] = useState<'all' | ReconStatus>('all');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  useEffect(() => { setFrom(defaultFrom); setTo(defaultTo); }, [defaultFrom, defaultTo]);
  const lastTx = useMemo(() => txs.reduce((m, t) => (t.data > m ? t.data : m), ''), [txs]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteTx, setNoteTx] = useState<BankTx | null>(null);
  const [noteText, setNoteText] = useState('');
  const [history, setHistory] = useState<{ tx: BankTx; rows: Awaited<ReturnType<typeof fetchReconHistory>> } | null>(null);
  const [showPairs, setShowPairs] = useState(false);
  const [showAuto, setShowAuto] = useState(false);
  const [cat, setCat] = useState<'all' | 'mov' | 'operacao' | 'transf' | 'auto'>('all');
  const [descTx, setDescTx] = useState<BankTx | null>(null);
  const [descText, setDescText] = useState('');
  const updText = useUpdateTxText(schoolId);
  const catOf = (t: BankTx) => isAutoInvest(t) ? 'auto' : t.transfer_pair_id ? 'transf' : t.splits?.length ? 'dividido' : t.movement_kind === 'ignorar' ? 'ignorar' : isOperacao(t) ? 'operacao' : 'mov';
  const CAT_LABEL: Record<SplitCategoria, string> = { normal: 'Entrada/Saída', operacao: 'Operação', ignorar: 'Ignorar' };
  const setSplitsM = useSetSplits(schoolId);
  const [splitTx, setSplitTx] = useState<BankTx | null>(null);
  const [parts, setParts] = useState<{ valor: string; categoria: SplitCategoria; descricao: string; note: string }[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const parseBR = (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const toBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const openSplit = (t: BankTx) => {
    setSplitTx(t);
    setParts(t.splits?.length
      ? t.splits.map(x => ({ valor: toBR(Number(x.valor)), categoria: x.categoria, descricao: x.descricao ?? '', note: x.note ?? '' }))
      : [{ valor: toBR(Number(t.valor)), categoria: 'normal', descricao: '', note: '' }, { valor: '0,00', categoria: 'ignorar', descricao: '', note: '' }]);
  };
  const partsSum = parts.reduce((a, p) => a + parseBR(p.valor), 0);
  const diff = splitTx ? Math.round((Number(splitTx.valor) - partsSum) * 100) / 100 : 0;
  const saveSplit = async (clear = false) => {
    if (!splitTx) return;
    try {
      await setSplitsM.mutateAsync({ txId: splitTx.id, parts: clear ? [] : parts.map(p => ({ valor: parseBR(p.valor), categoria: p.categoria, descricao: p.descricao, note: p.note })) });
      toast.success(clear ? 'Divisão desfeita' : 'Lançamento dividido'); setSplitTx(null);
    } catch (e: any) { toast.error(e.message ?? 'Erro ao dividir'); }
  };
  const saveText = async (id: string, patch: { descricao_editada?: string | null; recon_note?: string | null }) => {
    try { await updText.mutateAsync({ id, ...patch }); toast.success('Salvo'); } catch (e: any) { toast.error(e.message ?? 'Erro ao salvar'); }
  };
  const setCategory = async (ids: string[], kind: 'normal' | 'operacao' | 'ignorar') => {
    if (!ids.length) return;
    try { await setKind.mutateAsync({ ids, kind }); toast.success(`${ids.length} lançamento(s): ${kind === 'operacao' ? 'Operação' : kind === 'ignorar' ? 'Ignorar' : 'Entrada/Saída'}`); setSelected(new Set()); } catch (e: any) { toast.error(e.message ?? 'Erro'); }
  };
  const setKind = useSetMovementKind(schoolId);
  const setRecon = useSetReconStatus(schoolId);
  const setPair = useSetTransferPair(schoolId);

  const accName = useMemo(() => new Map(accounts.map(a => [a.id, a.nome])), [accounts]);
  const balances = useMemo(() => runningBalances(accounts, txs, accountId), [accounts, txs, accountId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs
      .filter(t => (accountId === 'all' || t.account_id === accountId) && t.data >= from && t.data <= to && (status === 'all' || t.recon_status === status) && (!q || displayDesc(t).toLowerCase().includes(q) || t.descricao.toLowerCase().includes(q)) && (showAuto || cat === 'auto' || !isAutoInvest(t)) && (cat === 'all' || catOf(t) === cat))
      .sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }, [txs, accountId, from, to, status, search, showAuto, cat]);
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
        <div className="w-44"><label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={cat} onValueChange={v => setCat(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="mov">Entrada / Saída</SelectItem><SelectItem value="operacao">Operações</SelectItem><SelectItem value="ignorar">Ignorados</SelectItem><SelectItem value="dividido">Divididos</SelectItem><SelectItem value="transf">Transferências internas</SelectItem><SelectItem value="auto">Aplicação automática</SelectItem></SelectContent>
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
          <Button size="sm" variant="outline" disabled={!selected.size || setKind.isPending} onClick={() => setCategory([...selected].filter(id => { const t = txs.find(x => x.id === id); return t && !t.transfer_pair_id && !isAutoInvest(t); }), 'operacao')}><Layers className="mr-1 h-4 w-4" />Marcar como Operação</Button>
          <Button size="sm" variant="ghost" disabled={!selected.size || setKind.isPending} onClick={() => setCategory([...selected].filter(id => txs.find(x => x.id === id)?.movement_kind === 'operacao'), 'normal')}>Tirar de Operação</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2"><Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={toggleAll} aria-label="Selecionar todos" /></th>
              <th className="p-2">Data</th><th className="p-2">Conta</th><th className="p-2">Descrição</th><th className="p-2">Categoria</th>
              <th className="p-2 text-right">Entrada</th><th className="p-2 text-right">Saída</th><th className="p-2 text-right">Saldo</th>
              <th className="p-2">Origem</th><th className="p-2">Situação</th><th className="p-2">Conciliado por</th><th className="p-2">Em</th><th className="p-2">Observação</th><th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={14} className="p-6 text-center text-muted-foreground">
              Nenhum lançamento de {fmtDate(from)} a {fmtDate(to)}.
              {lastTx && (lastTx < from || lastTx > to) && <Button size="sm" variant="link" onClick={() => { setFrom(`${lastTx.slice(0, 7)}-01`); setTo(lastTx); }}>Ver último extrato</Button>}
            </td></tr>}
            {rows.map(t => (
              <Fragment key={t.id}>
              <tr className="border-t border-border hover:bg-muted/20">
                <td className="p-2"><Checkbox checked={selected.has(t.id)} onCheckedChange={() => setSelected(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} /></td>
                <td className="p-2 whitespace-nowrap">{fmtDate(t.data)}</td>
                <td className="p-2 whitespace-nowrap">{accName.get(t.account_id) ?? '—'}</td>
                <td className="p-2"><div className="flex items-start gap-1"><div><span>{displayDesc(t)}</span>{t.descricao_editada && <p className="text-[11px] text-muted-foreground">Original do banco: {t.descricao}</p>}</div><Button size="sm" variant="ghost" className="h-6 px-1" title="Editar descrição" onClick={() => { setDescTx(t); setDescText(displayDesc(t)); }}><Pencil className="h-3 w-3" /></Button></div></td>
                <td className="p-2 whitespace-nowrap">{isAutoInvest(t) || t.transfer_pair_id ? <span className="text-xs text-muted-foreground">—</span> : (
                  t.splits?.length ? <button type="button" className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold" onClick={() => setExpanded(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>{expanded.has(t.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Dividido em {t.splits.length}</button> : <Select value={t.movement_kind === 'ignorar' ? 'ignorar' : isOperacao(t) ? 'operacao' : 'normal'} onValueChange={v => setCategory([t.id], v as any)}>
                    <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="normal">{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</SelectItem><SelectItem value="operacao">Operação</SelectItem><SelectItem value="ignorar">Ignorar</SelectItem></SelectContent>
                  </Select>)}{t.transfer_pair_id && <span className="ml-1 rounded bg-info/15 px-1.5 text-[10px] font-semibold text-info">Transferência interna</span>}{isAutoInvest(t) && <span className="ml-1 rounded bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">{t.movement_kind === 'auto_aplicacao' ? 'Aplicação automática' : 'Resgate automático'}</span>}</td>
                <td className="p-2 text-right tabular-nums text-success">{t.tipo === 'entrada' ? fmtBRL(Number(t.valor)) : ''}</td>
                <td className="p-2 text-right tabular-nums text-destructive">{t.tipo === 'saida' ? fmtBRL(Number(t.valor)) : ''}</td>
                <td className="p-2 text-right tabular-nums">{fmtBRL(balances.get(t.id) ?? 0)}</td>
                <td className="p-2 text-xs text-muted-foreground">Extrato</td>
                <td className="p-2"><StatusBadge status={t.recon_status} /></td>
                <td className="p-2 text-xs">{t.recon_by_email ?? '—'}</td>
                <td className="p-2 text-xs whitespace-nowrap">{fmtDateTime(t.recon_at)}</td>
                <td className="p-2 max-w-48 text-xs"><button type="button" className="w-full truncate text-left hover:underline" title={t.recon_note || 'Adicionar observação'} onClick={() => { setNoteTx(t); setNoteText(t.recon_note ?? ''); }}>{t.recon_note || <span className="text-muted-foreground">+ observação</span>}</button></td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    {t.recon_status !== 'conciliado' && <Button size="sm" variant="ghost" className="h-7 px-2 text-success" onClick={() => apply([t.id], 'conciliado')} title="Conciliar"><Check className="h-4 w-4" /></Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {t.recon_status !== 'nao_se_aplica' && <DropdownMenuItem onClick={() => apply([t.id], 'nao_se_aplica')}><Ban className="mr-2 h-4 w-4" />Não se aplica</DropdownMenuItem>}
                        {t.recon_status !== 'pendente' && <DropdownMenuItem onClick={() => apply([t.id], 'pendente')}><Undo2 className="mr-2 h-4 w-4" />Desfazer (pendente)</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => { setNoteTx(t); setNoteText(t.recon_note ?? ''); }}><MessageSquare className="mr-2 h-4 w-4" />Observação</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setDescTx(t); setDescText(displayDesc(t)); }}><Pencil className="mr-2 h-4 w-4" />Editar descrição</DropdownMenuItem>
                        {!isAutoInvest(t) && !t.transfer_pair_id && <DropdownMenuItem onClick={() => openSplit(t)}><Split className="mr-2 h-4 w-4" />{t.splits?.length ? 'Editar divisão' : 'Dividir valor'}</DropdownMenuItem>}
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
              {expanded.has(t.id) && t.splits?.map(sp => (
                <tr key={sp.id} className="bg-muted/20 text-xs">
                  <td /><td /><td />
                  <td className="p-1.5 pl-6">↳ {sp.descricao || displayDesc(t)}</td>
                  <td className="p-1.5">{CAT_LABEL[sp.categoria]}</td>
                  <td className="p-1.5 text-right tabular-nums text-success">{t.tipo === 'entrada' ? fmtBRL(Number(sp.valor)) : ''}</td>
                  <td className="p-1.5 text-right tabular-nums text-destructive">{t.tipo === 'saida' ? fmtBRL(Number(sp.valor)) : ''}</td>
                  <td colSpan={5} />
                  <td className="p-1.5 text-muted-foreground" colSpan={2}>{sp.note}</td>
                </tr>
              ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!noteTx} onOpenChange={o => !o && setNoteTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Observação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{noteTx && displayDesc(noteTx)}</p>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button onClick={async () => { if (noteTx) { await saveText(noteTx.id, { recon_note: noteText }); setNoteTx(null); } }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!descTx} onOpenChange={o => !o && setDescTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar descrição</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Original do banco (não muda): {descTx?.descricao}</p>
          <Input value={descText} onChange={e => setDescText(e.target.value)} />
          <DialogFooter className="gap-2">
            {descTx?.descricao_editada && <Button variant="ghost" onClick={async () => { await saveText(descTx.id, { descricao_editada: null }); setDescTx(null); }}>Voltar ao original</Button>}
            <Button onClick={async () => { if (descTx) { await saveText(descTx.id, { descricao_editada: descText.trim() === descTx.descricao ? null : descText }); setDescTx(null); } }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!splitTx} onOpenChange={o => !o && setSplitTx(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Dividir valor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{splitTx && `${displayDesc(splitTx)} · ${splitTx.tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${fmtBRL(Number(splitTx.valor))} no banco (não muda, o saldo segue o banco).`}</p>
          <div className="space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="grid grid-cols-[110px_140px_1fr_1fr_32px] items-center gap-2">
                <Input value={p.valor} onChange={e => setParts(ps => ps.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} className="text-right" aria-label="Valor" />
                <Select value={p.categoria} onValueChange={v => setParts(ps => ps.map((x, j) => j === i ? { ...x, categoria: v as SplitCategoria } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="normal">{splitTx?.tipo === 'entrada' ? 'Entrada' : 'Saída'}</SelectItem><SelectItem value="operacao">Operação</SelectItem><SelectItem value="ignorar">Ignorar</SelectItem></SelectContent>
                </Select>
                <Input value={p.descricao} placeholder="Descrição (opcional)" onChange={e => setParts(ps => ps.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} />
                <Input value={p.note} placeholder="Observação" onChange={e => setParts(ps => ps.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                <Button size="sm" variant="ghost" disabled={parts.length <= 2} onClick={() => setParts(ps => ps.filter((_, j) => j !== i))} aria-label="Remover parte"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setParts(ps => [...ps, { valor: toBR(Math.max(diff, 0)), categoria: 'normal', descricao: '', note: '' }])}><Plus className="mr-1 h-4 w-4" />Adicionar parte</Button>
          </div>
          <p className={`text-sm font-semibold ${Math.abs(diff) < 0.005 ? 'text-success' : 'text-destructive'}`}>Soma das partes: {fmtBRL(partsSum)} · Diferença: {fmtBRL(diff)}</p>
          <DialogFooter className="gap-2">
            {splitTx?.splits?.length ? <Button variant="ghost" disabled={setSplitsM.isPending} onClick={() => saveSplit(true)}>Desfazer divisão</Button> : null}
            <Button disabled={Math.abs(diff) >= 0.005 || parts.some(p => parseBR(p.valor) <= 0) || setSplitsM.isPending} onClick={() => saveSplit()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!history} onOpenChange={o => !o && setHistory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Histórico de alterações</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{history && displayDesc(history.tx)}</p>
          {history?.rows.length === 0 ? <p className="text-sm">Sem alterações registradas.</p> : (
            <ul className="space-y-2 text-sm">
              {history?.rows.map(h => (
                <li key={h.id} className="rounded-lg border border-border p-2">
                  {h.old_status !== h.new_status && <p><strong>{STATUS_LABEL[(h.old_status ?? 'pendente') as ReconStatus]}</strong> → <strong>{STATUS_LABEL[h.new_status as ReconStatus]}</strong></p>}
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
