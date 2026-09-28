import { supabase } from '@/integrations/supabase/client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Check, Ban, Undo2, History, MessageSquare, ArrowLeftRight, PiggyBank, Pencil, Layers, Split, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSetReconStatus, useSetTransferPair, useSetMovementKind, useUpdateTxText, useSetSplits, fetchReconHistory, autoPairTransfers, useInvalidateBank, useOwnTransferNames, useSchoolModelItems, useSetModelItem, useSetSplitModelItem } from '@/hooks/useBankPilot';
import { runningBalances, suggestTransferPairs, isAutoInvest, isOperacao, isOwnTransfer, suggestOwnName, detectOwnTransfer, displayDesc, type BankAccount, type BankTx, type ReconStatus, type SplitCategoria } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, fmtDateTime, StatusBadge, STATUS_LABEL } from './shared';
import { useJustificationReasons, useSetJustification, useCloseReconDay, useReconDayClosures, needsJustification, JUSTIFICATION_START, type MissingJustification } from '@/hooks/useReconJustification';
import { Tag, CalendarCheck } from 'lucide-react';
import { resolveTipoMeta } from '@/lib/tipoMeta';

export interface TableFocus { importId: string; from: string; to: string; nonce: number }
interface Props { schoolId: string; accounts: BankAccount[]; txs: BankTx[]; defaultFrom: string; defaultTo: string; focus?: TableFocus | null }

export function BankTransactionsTable({ schoolId, accounts, txs, defaultFrom, defaultTo, focus }: Props) {
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
  const [showAuto, setShowAuto] = useState(true);
  const [importFilter, setImportFilter] = useState<string | null>(null);
  useEffect(() => { if (focus) { setImportFilter(focus.importId); setCat('auto'); setAccountId('all'); setFrom(focus.from); setTo(focus.to); } }, [focus?.nonce]);
  const [cat, setCat] = useState<'all' | 'mov' | 'receita' | 'despesa' | 'operacao' | 'transf' | 'auto' | 'aclassificar' | 'ignorar' | 'dividido'>('all');
  const [descTx, setDescTx] = useState<BankTx | null>(null);
  const [descText, setDescText] = useState('');
  const updText = useUpdateTxText(schoolId);
  const catOf = (t: BankTx) => isAutoInvest(t) ? 'auto' : isOwnTransfer(t) ? 'transf' : t.splits?.length ? 'dividido' : t.movement_kind === 'ignorar' ? 'ignorar' : isOperacao(t) ? 'operacao' : 'mov';
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
  const KIND_LABEL: Record<string, string> = { normal: 'Entrada/Saída', operacao: 'Operação', ignorar: 'Ignorar', transferencia: 'Transferência entre contas', auto_aplicacao: 'Aplicação automática', auto_resgate: 'Resgate automático' };
  /** Muda a categoria e oferece "Desfazer" restaurando o valor anterior de cada linha. */
  const setCategory = async (ids: string[], kind: string) => {
    if (!ids.length) return;
    const prev = new Map<string, string>();
    for (const id of ids) prev.set(id, txs.find(x => x.id === id)?.movement_kind ?? 'normal');
    try {
      await setKind.mutateAsync({ ids, kind: kind as any });
      setSelected(new Set());
      if (kind === 'transferencia') {
        try { const np = await autoPairTransfers(schoolId); invalidateBank(); if (np) toast.info(`${np} transferência(s) pareadas com a outra ponta`); } catch { /* opcional */ }
        const first = txs.find(x => x.id === ids[0]);
        if (first && !detectOwnTransfer(first.descricao, ownNames.map(n => n.padrao))) setRememberName(suggestOwnName(first.descricao));
      }
      if (kind === 'normal' || kind === 'operacao' || kind === 'ignorar') {
        const pairIds = [...new Set(ids.map(id => txs.find(x => x.id === id)?.transfer_pair_id).filter(Boolean))] as string[];
        if (pairIds.length) { const pids = txs.filter(x => x.transfer_pair_id && pairIds.includes(x.transfer_pair_id)).map(x => x.id); await setPair.mutateAsync({ ids: pids, pairId: null }); }
      }
      toast.success(`${ids.length} lançamento(s): ${KIND_LABEL[kind] ?? kind}`, {
        duration: 8000,
        action: { label: 'Desfazer', onClick: async () => {
          const groups = new Map<string, string[]>();
          for (const [id, k] of prev) groups.set(k, [...(groups.get(k) ?? []), id]);
          try { for (const [k, gids] of groups) await setKind.mutateAsync({ ids: gids, kind: k as any }); toast.success('Alteração desfeita'); } catch (e: any) { toast.error(e.message ?? 'Erro ao desfazer'); }
        } },
      });
    } catch (e: any) { toast.error(e.message ?? 'Erro'); }
  };
  const setKind = useSetMovementKind(schoolId);
  const { data: modelItems = [] } = useSchoolModelItems(schoolId);
  const setItem = useSetModelItem(schoolId);
  const setSplitItem = useSetSplitModelItem(schoolId);
  const itemName = useMemo(() => new Map(modelItems.map(i => [i.id, i.name])), [modelItems]);
  // Mesma regra do tipo financeiro do modelo; o sentido do extrato não define Receita/Despesa.
  const financialClass = (itemId?: string | null) => {
    const item = modelItems.find(i => i.id === itemId);
    return item ? resolveTipoMeta(item.name, [], [item]).classificacao : null;
  };
  const visibleParts = (t: BankTx) => t.splits?.filter(sp => sp.categoria === 'normal' && financialClass(sp.model_item_id) === cat) ?? [];
  const matchesFinancial = (t: BankTx) => {
    if (isAutoInvest(t) || isOwnTransfer(t) || t.movement_kind === 'ignorar' || isOperacao(t)) return false;
    return t.splits?.length ? visibleParts(t).length > 0 : financialClass(t.model_item_id) === cat;
  };
  const itemsFor = (tipo: string) => modelItems.filter(i => i.tipo === tipo);
  const operationItemsFor = (tipo: string) => itemsFor(tipo).filter(i => !['receita', 'despesa'].includes(i.name.trim().toLowerCase()));
  /** Neutros no consolidado não precisam de tipo financeiro. */
  const needsItem = (t: BankTx) => !isAutoInvest(t) && !t.transfer_pair_id && t.movement_kind !== 'ignorar';
  const unclassified = (t: BankTx) => needsItem(t) && (t.splits?.length ? t.splits.some(sp => sp.categoria !== 'ignorar' && !sp.model_item_id) : !t.model_item_id);
  const operationPending = txs.filter(t => t.movement_kind === 'operacao' && !t.model_item_id).length;
  const transferPending = txs.filter(t => t.movement_kind === 'transferencia' && !t.transfer_pair_id).length;
  const splitPending = txs.filter(t => t.splits?.some(sp => sp.categoria === 'operacao' && !sp.model_item_id)).length;
  const applyItem = async (ids: string[], itemId: string | null) => {
    if (!ids.length) return;
    try { await setItem.mutateAsync({ ids, itemId }); toast.success(`${ids.length} lançamento(s): ${itemId ? itemName.get(itemId) : 'A classificar'}`); setSelected(new Set()); }
    catch (e: any) { toast.error(e.message ?? 'Erro ao classificar'); }
  };
  const invalidateBank = useInvalidateBank(schoolId);
  const { data: ownNames = [] } = useOwnTransferNames(schoolId);
  const [rememberName, setRememberName] = useState<string | null>(null);
  const saveOwnName = async () => {
    const v = (rememberName ?? '').trim().toLowerCase();
    if (v.length < 3) return toast.error('Use pelo menos 3 letras');
    const { error } = await (supabase as any).from('bank_own_transfer_names').insert({ school_id: schoolId, padrao: v });
    if (error && !String(error.message).includes('duplicate')) return toast.error(error.message);
    toast.success(`"${v}" será reconhecido nos próximos extratos`); setRememberName(null); invalidateBank();
  };
  const setRecon = useSetReconStatus(schoolId);
  const { data: reasons = [] } = useJustificationReasons();
  const reasonName = useMemo(() => new Map(reasons.map(r => [r.id, r.nome])), [reasons]);
  const setJust = useSetJustification(schoolId);
  const closeDay = useCloseReconDay(schoolId);
  const { data: closures = [] } = useReconDayClosures(schoolId);
  const [justIds, setJustIds] = useState<string[] | null>(null);
  const [justReason, setJustReason] = useState('');
  const [justNote, setJustNote] = useState('');
  const [missing, setMissing] = useState<MissingJustification[] | null>(null);
  const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const closeTarget = to > today ? today : to;
  const lastClosure = closures.find(c => c.dia === closeTarget);
  const openJustify = (ids: string[]) => {
    const list = ids.map(id => txs.find(t => t.id === id)).filter((t): t is BankTx => !!t && t.recon_status === 'pendente');
    if (!list.length) return toast.error('Selecione lançamentos pendentes');
    setJustIds(list.map(t => t.id)); setJustReason(list.length === 1 ? list[0].justification_reason_id ?? '' : ''); setJustNote(list.length === 1 ? list[0].justification_note ?? '' : '');
  };
  const saveJustify = async () => {
    if (!justIds || !justReason) return toast.error('Escolha um motivo');
    try { await setJust.mutateAsync({ ids: justIds, reasonId: justReason, note: justNote }); toast.success(`${justIds.length} lançamento(s) justificado(s)`); setJustIds(null); setSelected(new Set()); }
    catch (e: any) { toast.error(e.message ?? 'Erro ao justificar'); }
  };
  const runCloseDay = async () => {
    try {
      const miss = await closeDay.mutateAsync(closeTarget);
      if (miss.length) { setMissing(miss); return; }
      toast.success(`Conciliação de ${fmtDate(closeTarget)} finalizada`);
    } catch (e: any) { toast.error(e.message ?? 'Erro ao finalizar'); }
  };
  const semJust = txs.filter(t => needsJustification(t) && t.data <= closeTarget).length;
  const setPair = useSetTransferPair(schoolId);

  const accName = useMemo(() => new Map(accounts.map(a => [a.id, a.nome])), [accounts]);
  const balances = useMemo(() => runningBalances(accounts, txs, accountId), [accounts, txs, accountId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs
       .filter(t => (accountId === 'all' || t.account_id === accountId) && t.data >= from && t.data <= to && (status === 'all' || t.recon_status === status) && (!q || displayDesc(t).toLowerCase().includes(q) || t.descricao.toLowerCase().includes(q)) && (showAuto || cat === 'auto' || !isAutoInvest(t)) && (cat === 'all' || (cat === 'aclassificar' ? unclassified(t) : cat === 'receita' || cat === 'despesa' ? matchesFinancial(t) : catOf(t) === cat || (cat === 'ignorar' && !!t.splits?.some(sp => sp.categoria === 'ignorar')))) && (!importFilter || t.import_id === importFilter))
      .sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
   }, [txs, accountId, from, to, status, search, showAuto, cat, importFilter, modelItems]);
   useEffect(() => {
     const visible = new Set(rows.map(r => r.id));
     setSelected(current => [...current].some(id => !visible.has(id)) ? new Set([...current].filter(id => visible.has(id))) : current);
   }, [rows]);
  const autoCount = txs.filter(t => isAutoInvest(t) && (accountId === 'all' || t.account_id === accountId) && t.data >= from && t.data <= to).length;

  const pend = rows.filter(r => r.recon_status === 'pendente');
   const displayedValue = (r: BankTx) => cat === 'receita' || cat === 'despesa' ? r.splits?.length ? visibleParts(r).reduce((sum, sp) => sum + Number(sp.valor), 0) : Number(r.valor) : Number(r.valor);
   const pendValor = pend.reduce((s, r) => s + displayedValue(r), 0);
  const conc = rows.filter(r => r.recon_status === 'conciliado');
   const concValor = conc.reduce((s, r) => s + displayedValue(r), 0);
  /** Conferência de soma pelo sentido do extrato (não é classificação financeira). */
   const ignoredPart = (r: BankTx) => cat === 'ignorar' && r.splits?.length ? r.splits.filter(sp => sp.categoria === 'ignorar').reduce((s, sp) => s + Math.abs(Number(sp.valor)), 0) : Math.abs(displayedValue(r));
  const cross = (list: BankTx[]) => { let e = 0, s2 = 0, ne = 0, ns = 0; for (const r of list) { const v = ignoredPart(r); if (r.tipo === 'entrada') { e += v; ne++; } else { s2 += v; ns++; } } return { e, s: s2, ne, ns, diff: Math.round((e - s2) * 100) / 100 }; };
  const CrossLine = ({ c }: { c: ReturnType<typeof cross> }) => <span className="inline-flex flex-wrap items-center gap-x-2"><span className="text-success">Entradas {fmtBRL(c.e)} ({c.ne})</span>·<span className="text-destructive">Saídas {fmtBRL(c.s)} ({c.ns})</span>·{c.diff === 0 ? <span className="font-semibold text-success">Diferença R$ 0,00 ✓ batem</span> : <span className="font-semibold text-warning">Diferença {fmtBRL(Math.abs(c.diff))} · sobra em {c.diff > 0 ? 'entradas' : 'saídas'}</span>}</span>;

  /** Totais da seleção atual — mesmo conjunto usado pelas ações em lote ([...selected]). */
  const selRows = useMemo(() => [...selected].map(id => txs.find(t => t.id === id)).filter((t): t is BankTx => !!t), [selected, txs]);
  const selByStatus = useMemo(() => {
    const map: Record<ReconStatus, { n: number; valor: number }> = { pendente: { n: 0, valor: 0 }, conciliado: { n: 0, valor: 0 }, nao_se_aplica: { n: 0, valor: 0 } };
    for (const r of selRows) { const b = map[r.recon_status]; b.n += 1; b.valor += Number(r.valor); }
    return map;
  }, [selRows]);
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

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  useEffect(() => {
    const el = tableRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setTableWidth(el.scrollWidth));
    ro.observe(el); setTableWidth(el.scrollWidth);
    return () => ro.disconnect();
  }, []);

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
            <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="pendente">Só pendentes</SelectItem><SelectItem value="conciliado">Conciliados</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="w-44"><label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={cat} onValueChange={v => setCat(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="receita">Receitas</SelectItem><SelectItem value="despesa">Despesas</SelectItem><SelectItem value="mov">Entrada / Saída (juntas)</SelectItem><SelectItem value="operacao">Operações</SelectItem><SelectItem value="ignorar">Ignorados</SelectItem><SelectItem value="dividido">Divididos</SelectItem><SelectItem value="transf">Transferências internas</SelectItem><SelectItem value="auto">Aplicação automática</SelectItem><SelectItem value="aclassificar">Tipo financeiro: A classificar</SelectItem></SelectContent>
          </Select>
        </div>
        <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="min-w-40 flex-1"><label className="text-xs text-muted-foreground">Buscar descrição</label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: PIX, tarifa…" /></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} lançamentos · <span className="font-semibold text-success">Conciliados {conc.length} ({fmtBRL(concValor)})</span> · <span className="font-semibold text-warning">Pendentes {pend.length} ({fmtBRL(pendValor)})</span> · <CrossLine c={cross(rows)} />
        </p>
        <div className="flex flex-wrap gap-2">
          {autoCount > 0 && <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={!showAuto} onCheckedChange={v => setShowAuto(!v)} />Esconder aplicações automáticas ({autoCount})</label>}
          {importFilter && <Button size="sm" variant="secondary" onClick={() => { setImportFilter(null); setCat('all'); }}>Só deste extrato · limpar filtro ✕</Button>}
          {pairs.length > 0 && <Button size="sm" variant="outline" onClick={() => setShowPairs(true)}><ArrowLeftRight className="mr-1 h-4 w-4" />Transferências sugeridas ({pairs.length})</Button>}
          {selected.size > 0 && <>
          <Button size="sm" disabled={setRecon.isPending} onClick={() => apply([...selected], 'conciliado')}><Check className="mr-1 h-4 w-4" />Conciliar ({selected.size})</Button>
          <Button size="sm" variant="outline" disabled={setJust.isPending} onClick={() => openJustify([...selected])}><Tag className="mr-1 h-4 w-4" />Justificar</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={setKind.isPending}><Layers className="mr-1 h-4 w-4" />Classificar como ▾</Button></DropdownMenuTrigger><DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setCategory([...selected].filter(id => { const t = txs.find(x => x.id === id); return t && !t.transfer_pair_id && !isAutoInvest(t) && t.movement_kind !== 'normal'; }), 'normal')}>Receita/Despesa normal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategory([...selected].filter(id => { const t = txs.find(x => x.id === id); return t && !t.transfer_pair_id && !isAutoInvest(t); }), 'operacao')}><Layers className="mr-2 h-4 w-4" />Operação</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategory([...selected].filter(id => { const t = txs.find(x => x.id === id); return t && !isAutoInvest(t) && !t.splits?.length && t.movement_kind !== 'transferencia'; }), 'transferencia')}><ArrowLeftRight className="mr-2 h-4 w-4" />Transferência entre contas</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategory([...selected].filter(id => { const t = txs.find(x => x.id === id); return t && !t.transfer_pair_id && !isAutoInvest(t); }), 'ignorar')}><Ban className="mr-2 h-4 w-4" />Ignorar</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
          <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><Undo2 className="mr-1 h-4 w-4" />Desfazer ▾</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => apply([...selected], 'pendente')}>Voltar a pendente</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategory([...selected].filter(id => txs.find(x => x.id === id)?.movement_kind === 'operacao'), 'normal')}>Tirar de Operação</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategory([...selected].filter(id => { const t = txs.find(x => x.id === id); return t && isOwnTransfer(t); }), 'normal')}>Tirar de transferência</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
          </>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
        <div>
          <span className="font-semibold">Fechamento do dia {fmtDate(closeTarget)}</span>
          {closeTarget >= JUSTIFICATION_START
            ? semJust > 0
              ? <button type="button" className="ml-2 rounded bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground" onClick={() => { setStatus('pendente'); setFrom(JUSTIFICATION_START); setTo(closeTarget); }}>{semJust} sem justificativa — ver</button>
              : <span className="ml-2 text-xs text-success">todas as pendências justificadas</span>
            : <span className="ml-2 text-xs text-muted-foreground">justificativa obrigatória a partir de {fmtDate(JUSTIFICATION_START)}</span>}
          {lastClosure && <span className="ml-2 text-xs text-muted-foreground">· finalizado por {lastClosure.closed_by_email ?? '—'} em {fmtDateTime(lastClosure.closed_at)}</span>}
        </div>
        <Button size="sm" variant={lastClosure ? 'outline' : 'default'} disabled={closeDay.isPending} onClick={runCloseDay}><CalendarCheck className="mr-1 h-4 w-4" />{lastClosure ? 'Finalizar de novo' : 'Finalizar conciliação do dia'}</Button>
      </div>

      {(operationPending > 0 || transferPending > 0 || splitPending > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <span className="font-semibold text-foreground">Para revisar:</span>
          {operationPending > 0 && <Button size="sm" variant="outline" onClick={() => setCat('operacao')}>Detalhar operações ({operationPending})</Button>}
          {transferPending > 0 && <Button size="sm" variant="outline" onClick={() => setCat('transf')}>Transferências sem par ({transferPending})</Button>}
          {splitPending > 0 && <Button size="sm" variant="outline" onClick={() => setCat('dividido')}>Partes de operação ({splitPending})</Button>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm" data-testid="barra-selecionados">
          <span className="font-semibold text-foreground">
            Selecionados: {selected.size}
          </span>
          <CrossLine c={cross(selRows)} />
          {selByStatus.conciliado.n > 0 && <span className="font-semibold text-success">Conciliados: {selByStatus.conciliado.n} ({fmtBRL(selByStatus.conciliado.valor)})</span>}
          {selByStatus.pendente.n > 0 && <span className="font-semibold text-warning">A conciliar: {selByStatus.pendente.n} ({fmtBRL(selByStatus.pendente.valor)})</span>}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção ✕</Button>
        </div>
      )}

      <div ref={topScrollRef} className="overflow-x-auto" onScroll={e => { if (tableScrollRef.current) tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; }} aria-hidden>
        <div style={{ width: tableWidth, height: 1 }} />
      </div>
      <div ref={tableScrollRef} className="max-h-[75vh] overflow-auto rounded-xl border border-border bg-card" onScroll={e => { if (topScrollRef.current) topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; }}>
        <table ref={tableRef} className="w-full min-w-[980px] text-sm">
          <thead className="sticky top-0 z-20 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-30 w-[132px] bg-muted p-2"><div className="flex items-center gap-2"><Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={toggleAll} aria-label="Selecionar todos" />Ações</div></th>
              <th className="p-2">Data</th><th className="p-2">Conta</th><th className="p-2">Descrição</th><th className="p-2">Classificação</th>
              <th className="p-2 text-right">Entrada</th><th className="p-2 text-right">Saída</th><th className="p-2 text-right">Saldo</th>
              <th className="p-2">Situação</th><th className="p-2">Conferência</th><th className="p-2" title="Observação">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">
              Nenhum lançamento de {fmtDate(from)} a {fmtDate(to)}.
              {lastTx && (lastTx < from || lastTx > to) && <Button size="sm" variant="link" onClick={() => { setFrom(`${lastTx.slice(0, 7)}-01`); setTo(lastTx); }}>Ver último extrato</Button>}
            </td></tr>}
            {rows.map(t => (
              <Fragment key={t.id}>
              <tr className={`group border-t border-border hover:bg-muted/20 ${isAutoInvest(t) ? 'opacity-70' : ''}`}>
                <td className="sticky left-0 z-10 bg-card p-2 group-hover:bg-muted">
                  <div className="flex items-center gap-1">
                     <Checkbox checked={selected.has(t.id)} onCheckedChange={() => setSelected(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} />
                    {t.recon_status !== 'conciliado' && <Button size="sm" variant="ghost" className="h-7 px-1.5 text-success" onClick={() => apply([t.id], 'conciliado')} title="Conciliar"><Check className="h-4 w-4" /></Button>}
                    {!isAutoInvest(t) && !t.transfer_pair_id && <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => openSplit(t)} title={t.splits?.length ? 'Editar divisão' : 'Dividir valor'} aria-label="Dividir valor"><Split className="h-4 w-4" /></Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {t.recon_status === 'pendente' && <DropdownMenuItem onClick={() => openJustify([t.id])}><Tag className="mr-2 h-4 w-4" />Justificar pendência</DropdownMenuItem>}
                        {t.recon_status !== 'pendente' && <DropdownMenuItem onClick={() => apply([t.id], 'pendente')}><Undo2 className="mr-2 h-4 w-4" />Desfazer (pendente)</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => { setNoteTx(t); setNoteText(t.recon_note ?? ''); }}><MessageSquare className="mr-2 h-4 w-4" />Observação</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setDescTx(t); setDescText(displayDesc(t)); }}><Pencil className="mr-2 h-4 w-4" />Editar descrição</DropdownMenuItem>
                        {!isAutoInvest(t) && !t.transfer_pair_id && <DropdownMenuItem onClick={() => openSplit(t)}><Split className="mr-2 h-4 w-4" />{t.splits?.length ? 'Editar divisão' : 'Dividir valor'}</DropdownMenuItem>}
                        {t.transfer_pair_id && <DropdownMenuItem onClick={() => setPair.mutate({ ids: txs.filter(x => x.transfer_pair_id === t.transfer_pair_id).map(x => x.id), pairId: null })}><ArrowLeftRight className="mr-2 h-4 w-4" />Desfazer transferência interna</DropdownMenuItem>}
                        {isAutoInvest(t)
                          ? <DropdownMenuItem onClick={() => setCategory([t.id], 'normal')}><PiggyBank className="mr-2 h-4 w-4" />Não é aplicação automática</DropdownMenuItem>
                          : !t.transfer_pair_id && <DropdownMenuItem onClick={() => setCategory([t.id], t.tipo === 'saida' ? 'auto_aplicacao' : 'auto_resgate')}><PiggyBank className="mr-2 h-4 w-4" />Marcar como aplicação automática</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openHistory(t)}><History className="mr-2 h-4 w-4" />Histórico</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap">{fmtDate(t.data)}</td>
                <td className="p-2 whitespace-nowrap">{accName.get(t.account_id) ?? '—'}</td>
                <td className="p-2 min-w-52" title="Origem: Extrato"><div className="flex items-start gap-1"><div><span>{displayDesc(t)}</span>{t.is_forecast && (() => { const dias = Math.floor((Date.now() - new Date(t.data + 'T12:00:00').getTime()) / 86400000); return <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${dias > 7 ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`} title="Veio de 'Lançamentos futuros' do PDF. Será substituído pelo lançamento real quando o próximo OFX chegar.">{dias > 7 ? `Previsto há ${dias} dias — revisar` : 'Previsto · aguardando extrato'}</span>; })()}{t.descricao_editada && <p className="text-[11px] text-muted-foreground">Original do banco: {t.descricao}</p>}</div><Button size="sm" variant="ghost" className="h-6 px-1" title="Editar descrição" onClick={() => { setDescTx(t); setDescText(displayDesc(t)); }}><Pencil className="h-3 w-3" /></Button></div></td>
                <td className="p-2 whitespace-nowrap">{t.transfer_pair_id ? <span className="rounded bg-info/15 px-1.5 py-0.5 text-xs font-semibold text-info">Transferência interna</span> : (
                   t.splits?.length ? <button type="button" className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold" onClick={() => setExpanded(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>{expanded.has(t.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Dividido em {t.splits.length}{(cat === 'receita' || cat === 'despesa') && ` · ${fmtBRL(displayedValue(t))} nesta categoria`}</button> : <Select value={t.movement_kind ?? 'normal'} onValueChange={v => setCategory([t.id], v)}>
                    <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="normal">{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</SelectItem><SelectItem value="operacao">Operação</SelectItem><SelectItem value="ignorar">Ignorar</SelectItem><SelectItem value="transferencia">Transferência entre contas</SelectItem><SelectItem value={t.tipo === 'saida' ? 'auto_aplicacao' : 'auto_resgate'}>{t.tipo === 'saida' ? 'Aplicação automática' : 'Resgate automático'}</SelectItem></SelectContent>
                   </Select>)}
                  {!t.splits?.length && t.movement_kind === 'normal' && <span className="ml-2 text-xs font-semibold text-foreground">{t.tipo === 'entrada' ? 'Receita' : 'Despesa'}</span>}
                  {!t.splits?.length && t.movement_kind === 'operacao' && <Select value={t.model_item_id ?? 'none'} onValueChange={v => applyItem([t.id], v === 'none' ? null : v)}>
                    <SelectTrigger className={`mt-1 h-7 w-48 text-xs ${!t.model_item_id ? 'border-warning text-warning' : ''}`}><SelectValue placeholder="Detalhar operação" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Detalhar operação</SelectItem>{operationItemsFor(t.tipo).map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>}
                  {t.transfer_pair_id && (() => { const o = txs.find(x => x.transfer_pair_id === t.transfer_pair_id && x.id !== t.id); const me = accName.get(t.account_id) ?? '?'; const other = o ? accName.get(o.account_id) ?? '?' : '?'; return <span className="ml-1 text-[10px] text-muted-foreground">{t.tipo === 'saida' ? `${me} → ${other}` : `${other} → ${me}`}</span>; })()}</td>
                <td className="p-2 text-right tabular-nums text-success whitespace-nowrap">{t.tipo === 'entrada' ? fmtBRL(Number(t.valor)) : ''}</td>
                <td className="p-2 text-right tabular-nums text-destructive whitespace-nowrap">{t.tipo === 'saida' ? fmtBRL(Number(t.valor)) : ''}</td>
                <td className="p-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(balances.get(t.id) ?? 0)}</td>
                <td className="p-2"><StatusBadge status={t.recon_status} />
                  {t.recon_status === 'pendente' && t.justification_reason_id
                    ? <button type="button" onClick={() => openJustify([t.id])} className="mt-1 block max-w-40 truncate rounded bg-info/15 px-1.5 py-0.5 text-left text-[10px] font-semibold text-info" title={`${reasonName.get(t.justification_reason_id) ?? ''}${t.justification_note ? ` — ${t.justification_note}` : ''}${t.justified_at ? ` · ${fmtDateTime(t.justified_at)}` : ''}`}>{reasonName.get(t.justification_reason_id) ?? 'Justificado'}</button>
                    : needsJustification(t) && <button type="button" onClick={() => openJustify([t.id])} className="mt-1 block rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">Sem justificativa</button>}
                </td>
                <td className="p-2 text-[11px] leading-tight">{t.recon_by_email ? <><div className="max-w-36 truncate" title={t.recon_by_email}>{t.recon_by_email}</div><div className="text-muted-foreground whitespace-nowrap">{fmtDateTime(t.recon_at)}</div></> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2"><Button size="sm" variant="ghost" className={`h-7 px-1.5 ${t.recon_note ? 'text-primary' : 'text-muted-foreground'}`} title={t.recon_note || 'Adicionar observação'} aria-label="Observação" onClick={() => { setNoteTx(t); setNoteText(t.recon_note ?? ''); }}><MessageSquare className={`h-4 w-4 ${t.recon_note ? 'fill-primary/20' : ''}`} /></Button></td>
              </tr>
               {(expanded.has(t.id) || cat === 'receita' || cat === 'despesa') && (cat === 'receita' || cat === 'despesa' ? visibleParts(t) : t.splits ?? []).map(sp => (
                <tr key={sp.id} className={`text-xs ${cat === 'ignorar' && sp.categoria === 'ignorar' ? 'bg-warning/15 font-semibold' : 'bg-muted/20'}`}>
                  <td className="sticky left-0 bg-card" /><td /><td />
                  <td className="p-1.5 pl-6">↳ {sp.descricao || displayDesc(t)}</td>
                  <td className="p-1.5">{sp.categoria === 'normal' ? (t.tipo === 'entrada' ? 'Receita' : 'Despesa') : CAT_LABEL[sp.categoria]}
                    {sp.categoria === 'operacao' && (
                    <Select value={sp.model_item_id ?? 'none'} onValueChange={v => setSplitItem.mutate({ splitId: sp.id, itemId: v === 'none' ? null : v }, { onError: (e: any) => toast.error(e.message ?? 'Erro') })}>
                      <SelectTrigger className={`mt-1 h-7 w-44 text-xs ${!sp.model_item_id ? 'border-warning text-warning' : ''}`}><SelectValue placeholder="Detalhar operação" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Detalhar operação</SelectItem>{operationItemsFor(t.tipo).map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                    </Select>)}</td>
                  <td className="p-1.5 text-right tabular-nums text-success">{t.tipo === 'entrada' ? fmtBRL(Number(sp.valor)) : ''}</td>
                  <td className="p-1.5 text-right tabular-nums text-destructive">{t.tipo === 'saida' ? fmtBRL(Number(sp.valor)) : ''}</td>
                  <td colSpan={3} />
                  <td className="p-1.5 text-muted-foreground">{sp.note}</td>
                </tr>
              ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!justIds} onOpenChange={o => !o && setJustIds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Justificar {justIds?.length ?? 0} pendência(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-muted-foreground">Motivo</label>
              <Select value={justReason} onValueChange={setJustReason}>
                <SelectTrigger><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                <SelectContent>{reasons.filter(r => r.ativo).map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-muted-foreground">Observação (opcional)</label>
              <Input value={justNote} maxLength={200} onChange={e => setJustNote(e.target.value)} placeholder="Ex.: cliente vai mandar o comprovante amanhã" />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{justNote.length}/200</p>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setJustIds(null)}>Cancelar</Button><Button disabled={!justReason || setJust.isPending} onClick={saveJustify}>Salvar justificativa</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!missing} onOpenChange={o => !o && setMissing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Não dá para finalizar: {missing?.length} pendência(s) sem justificativa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Toda pendência a partir de {fmtDate(JUSTIFICATION_START)} precisa de um motivo antes de finalizar o dia.</p>
          <div className="max-h-80 overflow-auto rounded border border-border">
            <table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Conta</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Valor</th></tr></thead>
              <tbody>{missing?.map(m => <tr key={m.transaction_id} className="border-t border-border"><td className="p-2">{fmtDate(m.data)}</td><td className="p-2">{m.account_name ?? '—'}</td><td className="p-2">{m.descricao}</td><td className={`p-2 text-right tabular-nums ${m.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>{m.tipo === 'entrada' ? '' : '-'}{fmtBRL(Number(m.valor))}</td></tr>)}</tbody></table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMissing(null)}>Fechar</Button>
            <Button onClick={() => { const ids = (missing ?? []).map(m => m.transaction_id); setMissing(null); openJustify(ids); }}>Justificar todas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={rememberName !== null} onOpenChange={o => !o && setRememberName(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lembrar este nome para os próximos extratos?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Lançamentos com este texto na descrição entrarão pré-marcados como transferência entre contas. Use o nome completo da empresa para não pegar fornecedores parecidos.</p>
          <Input value={rememberName ?? ''} onChange={e => setRememberName(e.target.value)} />
          <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => setRememberName(null)}>Agora não</Button><Button onClick={saveOwnName}>Lembrar</Button></DialogFooter>
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
