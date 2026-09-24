import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Upload, Trash2, Pencil, FileText, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBankImports, useInvalidateBank, useAutoInvestPatterns, useOwnTransferNames, useSetMovementKind } from '@/hooks/useBankPilot';
import { Checkbox } from '@/components/ui/checkbox';
import { parseBankFile, fileHash, computeDedupHashes, parseBRNumber, type BankParseResult } from '@/lib/bankStatements/parsers';
import { detectMovementKind, detectOwnTransfer, DEFAULT_AUTO_INVEST_PATTERNS, type BankAccount, type BankTx, type MovementKind } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, fmtDateTime } from './shared';

const db = supabase as any;

interface Props { schoolId: string; accounts: BankAccount[]; txs?: BankTx[]; onViewAuto?: (importId: string, from: string, to: string) => void }

interface Preview {
  file: File; hash: string; result: BankParseResult; hashes: string[]; existing: Set<string>; kinds: MovementKind[]; saldoAplicado: string;
}

const emptyForm = { id: '', nome: '', banco: '', agencia: '', conta: '', saldo: '', saldoData: '', auto: false, autoSaldo: '', autoData: '' };

export function BankAccountsImports({ schoolId, accounts, txs = [], onViewAuto }: Props) {
  const autoByImport = new Map<string, number>();
  for (const t of txs) if (t.movement_kind === 'auto_aplicacao' || t.movement_kind === 'auto_resgate') autoByImport.set(t.import_id, (autoByImport.get(t.import_id) ?? 0) + 1);
  const { user } = useAuth();
  const { data: imports = [] } = useBankImports(schoolId);
  const invalidate = useInvalidateBank(schoolId);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [accountId, setAccountId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const accName = new Map(accounts.map(a => [a.id, a.nome]));
  const { data: patterns } = useAutoInvestPatterns(schoolId);
  const [newPattern, setNewPattern] = useState('');
  const addPattern = async () => {
    const v = newPattern.trim(); if (!v) return;
    const { error } = await db.from('bank_auto_invest_patterns').insert({ school_id: schoolId, padrao: v });
    if (error) return toast.error(error.message);
    setNewPattern(''); invalidate();
  };
  const { data: ownNames = [] } = useOwnTransferNames(schoolId);
  const setKindM = useSetMovementKind(schoolId);
  const [newOwn, setNewOwn] = useState('');
  const addOwn = async () => {
    const v = newOwn.trim().toLowerCase(); if (v.length < 3) return toast.error('Use pelo menos 3 letras');
    const { error } = await db.from('bank_own_transfer_names').insert({ school_id: schoolId, padrao: v });
    if (error) return toast.error(error.message);
    setNewOwn(''); invalidate();
  };
  const removeOwn = async (id: string) => { await db.from('bank_own_transfer_names').delete().eq('id', id); invalidate(); };
  const ownCandidates = txs.filter(t => (t.movement_kind ?? 'normal') === 'normal' && !t.transfer_pair_id && !t.splits?.length && detectOwnTransfer(t.descricao, ownNames.map(n => n.padrao)));
  const applyOwnToExisting = async () => {
    try { await setKindM.mutateAsync({ ids: ownCandidates.map(t => t.id), kind: 'transferencia' }); toast.success(`${ownCandidates.length} lançamento(s) marcados como transferência entre contas`); }
    catch (e: any) { toast.error(e.message ?? 'Erro'); }
  };
  const removePattern = async (id: string) => { await db.from('bank_auto_invest_patterns').delete().eq('id', id); invalidate(); };

  const saveAccount = async () => {
    if (!form?.nome.trim()) return toast.error('Informe o nome da conta');
    const row = {
      school_id: schoolId, nome: form.nome.trim(), banco: form.banco.trim(), agencia: form.agencia.trim() || null, conta: form.conta.trim() || null,
      saldo_inicial: parseBRNumber(form.saldo), saldo_inicial_data: form.saldoData || null,
      has_auto_invest: form.auto, auto_invest_saldo_inicial: form.auto ? parseBRNumber(form.autoSaldo) : 0,
      auto_invest_saldo_data: form.auto ? (form.autoData || form.saldoData || null) : null,
    };
    const { error } = form.id ? await db.from('bank_accounts').update(row).eq('id', form.id) : await db.from('bank_accounts').insert(row);
    if (error) return toast.error(error.message);
    toast.success('Conta salva'); setForm(null); invalidate();
  };

  const toggleActive = async (a: BankAccount) => {
    const { error } = await db.from('bank_accounts').update({ ativa: !a.ativa }).eq('id', a.id);
    if (error) toast.error(error.message); else invalidate();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!accountId) return toast.error('Escolha a conta do extrato antes');
    setBusy(true);
    try {
      const hash = await fileHash(file);
      const { data: dup } = await db.from('bank_statement_imports').select('id, created_at').eq('account_id', accountId).eq('file_hash', hash).maybeSingle();
      if (dup) { toast.error(`Este arquivo já foi importado nesta conta em ${fmtDateTime(dup.created_at)}.`); return; }
      const result = await parseBankFile(file);
      if (!result.transactions.length) { toast.error('Nenhum lançamento reconhecido no arquivo.'); return; }
      const hashes = await computeDedupHashes(accountId, result.transactions);
      const existing = new Set<string>();
      for (let i = 0; i < hashes.length; i += 200) {
        const { data } = await db.from('bank_transactions').select('dedup_hash').eq('account_id', accountId).in('dedup_hash', hashes.slice(i, i + 200));
        (data ?? []).forEach((r: any) => existing.add(r.dedup_hash));
      }
      const { data: acc } = await db.from('bank_accounts').select('*').eq('id', accountId).maybeSingle();
      const pats = patterns?.all ?? DEFAULT_AUTO_INVEST_PATTERNS;
      const own = ownNames.map(n => n.padrao);
      const kinds = result.transactions.map(t => {
        const k: MovementKind = acc?.has_auto_invest ? detectMovementKind(t.descricao, t.tipo, pats) : 'normal';
        return k === 'normal' && detectOwnTransfer(t.descricao, own) ? 'transferencia' : k;
      });
      setPreview({ file, hash, result, hashes, existing, kinds, saldoAplicado: '' });
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao ler o arquivo');
    } finally { setBusy(false); }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    const { file, hash, result, hashes, existing, kinds } = preview;
    try {
      const path = `${schoolId}/${accountId}/${hash.slice(0, 16)}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase.storage.from('bank-statements').upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const entradas = result.transactions.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
      const saidas = result.transactions.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
      const novos = result.transactions.map((t, i) => ({ t, h: hashes[i], k: kinds[i] })).filter(x => !existing.has(x.h));
      const { data: imp, error: e1 } = await db.from('bank_statement_imports').insert({
        school_id: schoolId, account_id: accountId, file_name: file.name, file_path: path, file_hash: hash, formato: result.formato,
        periodo_inicio: result.periodoInicio ?? null, periodo_fim: result.periodoFim ?? null, total_linhas: result.transactions.length,
        inseridas: novos.length, duplicadas: result.transactions.length - novos.length, total_entradas: entradas, total_saidas: saidas, imported_by: user?.id ?? null,
        saldo_final_informado: result.saldoFinalInformado ?? null, saldo_aplicado_informado: preview.saldoAplicado.trim() ? parseBRNumber(preview.saldoAplicado) : null,
      }).select('id').single();
      if (e1) throw e1;
      for (let i = 0; i < novos.length; i += 500) {
        const chunk = novos.slice(i, i + 500).map(({ t, h, k }) => ({
          school_id: schoolId, account_id: accountId, import_id: imp.id, data: t.data, descricao: t.descricao, valor: t.valor, tipo: t.tipo, bank_ref: t.bankRef ?? null, dedup_hash: h, movement_kind: k,
        }));
        const { error } = await db.from('bank_transactions').upsert(chunk, { onConflict: 'account_id,dedup_hash', ignoreDuplicates: true });
        if (error) { await db.from('bank_statement_imports').delete().eq('id', imp.id); throw error; }
      }
      { const autoN = novos.filter(n => n.k === 'auto_aplicacao' || n.k === 'auto_resgate').length;
        toast.success(`${novos.length} lançamentos importados · ${result.transactions.length - novos.length} já existiam${autoN ? ` · ${autoN} pré-marcados como aplicação automática` : ''}`,
          autoN && onViewAuto ? { duration: 10000, action: { label: 'Ver', onClick: () => onViewAuto(imp.id, result.transactions.reduce((m, t) => t.data < m ? t.data : m, '9999-12-31'), result.transactions.reduce((m, t) => t.data > m ? t.data : m, '0000-01-01')) } } : undefined); }
      setPreview(null); invalidate();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao importar');
    } finally { setBusy(false); }
  };

  const deleteImport = async () => {
    const imp = imports.find(i => i.id === deleteId);
    if (!imp) return;
    const { error } = await db.from('bank_statement_imports').delete().eq('id', imp.id);
    if (error) return toast.error(error.message);
    if (imp.file_path) await supabase.storage.from('bank-statements').remove([imp.file_path]);
    toast.success('Importação e lançamentos vinculados excluídos'); setDeleteId(null); invalidate();
  };

  const download = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('bank-statements').createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, '_blank');
  };

  const p = preview?.result;
  const pEnt = p?.transactions.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0) ?? 0;
  const pSai = p?.transactions.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0) ?? 0;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Contas</h3>
          <Button size="sm" onClick={() => setForm({ ...emptyForm })}><Plus className="mr-1 h-4 w-4" />Nova conta</Button>
        </div>
        {accounts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Conta</th><th>Banco</th><th>Ag./Conta</th><th className="text-right">Saldo inicial</th><th>Data do saldo</th><th /></tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className={`border-t border-border ${a.ativa ? '' : 'opacity-50'}`}>
                  <td className="py-2 font-medium">{a.nome}{a.has_auto_invest && <span className="ml-1 rounded bg-info/15 px-1.5 text-[10px] font-semibold text-info">Aplicação automática · {fmtBRL(Number(a.auto_invest_saldo_inicial ?? 0))}</span>}</td><td>{a.banco}</td><td>{[a.agencia, a.conta].filter(Boolean).join(' / ')}</td>
                  <td className="text-right tabular-nums">{fmtBRL(Number(a.saldo_inicial))}</td><td>{fmtDate(a.saldo_inicial_data)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setForm({ id: a.id, nome: a.nome, banco: a.banco, agencia: a.agencia ?? '', conta: a.conta ?? '', saldo: String(a.saldo_inicial).replace('.', ','), saldoData: a.saldo_inicial_data ?? '', auto: !!a.has_auto_invest, autoSaldo: String(a.auto_invest_saldo_inicial ?? 0).replace('.', ','), autoData: a.auto_invest_saldo_data ?? '' })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(a)}>{a.ativa ? 'Desativar' : 'Ativar'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">O saldo inicial é o saldo da conta no fim do dia informado. Lançamentos até essa data já estão contidos nele.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Descrições de aplicação automática</h3>
        <p className="mb-2 text-xs text-muted-foreground">Nas contas com aplicação automática, lançamentos com estas descrições viram "Aplicação automática": mexem só na divisão entre saldo em conta e aplicado, e ficam fora de entradas e saídas.</p>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_AUTO_INVEST_PATTERNS.map(p => <span key={p} className="rounded bg-muted px-2 py-0.5 text-xs">{p}</span>)}
          {patterns?.custom.map(p => <span key={p.id} className="inline-flex items-center gap-1 rounded bg-info/15 px-2 py-0.5 text-xs text-info">{p.padrao}<button onClick={() => removePattern(p.id)} aria-label="Remover">×</button></span>)}
        </div>
        <div className="mt-2 flex gap-2"><Input className="max-w-xs" value={newPattern} onChange={e => setNewPattern(e.target.value)} placeholder="Ex.: APLICACAO CDB AUT" /><Button size="sm" variant="outline" onClick={addPattern}>Adicionar</Button></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Nomes da própria empresa (transferência entre contas)</h3>
        <p className="mb-2 text-xs text-muted-foreground">Lançamentos cuja descrição cita um destes nomes entram pré-marcados como "Transferência entre contas": continuam no saldo de cada conta, mas não são receita nem despesa. Use a razão social completa (ex.: "pegorer idiomas") para não pegar pessoas ou outras empresas com o mesmo sobrenome.</p>
        <div className="flex flex-wrap gap-1.5">
          {ownNames.length === 0 && <span className="text-xs text-muted-foreground">Nenhum nome cadastrado.</span>}
          {ownNames.map(p => <span key={p.id} className="inline-flex items-center gap-1 rounded bg-info/15 px-2 py-0.5 text-xs text-info">{p.padrao}<button onClick={() => removeOwn(p.id)} aria-label="Remover">×</button></span>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2"><Input className="max-w-xs" value={newOwn} onChange={e => setNewOwn(e.target.value)} placeholder="Ex.: pegorer idiomas" /><Button size="sm" variant="outline" onClick={addOwn}>Adicionar</Button>
          {ownCandidates.length > 0 && <Button size="sm" disabled={setKindM.isPending} onClick={applyOwnToExisting}>Marcar {ownCandidates.length} lançamento(s) já importados</Button>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Importar extrato original</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-60"><Label className="text-xs">Conta do extrato</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.ativa).map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${busy || !accountId ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="h-4 w-4" />{busy ? 'Lendo…' : 'Escolher arquivo (OFX, CSV, Excel, PDF)'}
            <input type="file" className="hidden" accept=".ofx,.csv,.txt,.xlsx,.xls,.pdf" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Histórico de importações</h3>
        {imports.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma importação.</p> : (
          <ul className="space-y-2">
            {imports.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{i.file_name} <span className="text-xs text-muted-foreground">· {accName.get(i.account_id)}</span></p>
                    <p className="text-xs text-muted-foreground">
                      {i.formato.toUpperCase()} · {fmtDate(i.periodo_inicio)} a {fmtDate(i.periodo_fim)} · {i.inseridas} novos, {i.duplicadas} já existiam · entradas {fmtBRL(Number(i.total_entradas))} · saídas {fmtBRL(Number(i.total_saidas))} · {fmtDateTime(i.created_at)}
                    </p>
                    {(autoByImport.get(i.id) ?? 0) > 0 && (
                      <p className="mt-1 text-xs">{autoByImport.get(i.id)} linha(s) marcadas como aplicação automática{onViewAuto && <Button size="sm" variant="link" className="h-auto p-0 pl-2 text-xs" onClick={() => onViewAuto(i.id, i.periodo_inicio ?? '0000-01-01', i.periodo_fim ?? '9999-12-31')}>Ver e conferir</Button>}</p>
                    )}
                  </div>
                </div>
                <div className="flex">
                  <Button size="sm" variant="ghost" onClick={() => download(i.file_path)} title="Baixar arquivo original"><Download className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={() => setDeleteId(i.id)} title="Excluir importação"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar conta' : 'Nova conta'}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Sicredi principal" /></div>
              <div className="col-span-2"><Label>Banco</Label><Input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Ex.: Stone, Banco do Brasil" /></div>
              <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} /></div>
              <div><Label>Saldo inicial</Label><Input value={form.saldo} onChange={e => setForm({ ...form, saldo: e.target.value })} placeholder="1.500,50" /></div>
              <div><Label>Data do saldo</Label><Input type="date" value={form.saldoData} onChange={e => setForm({ ...form, saldoData: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm"><Checkbox checked={form.auto} onCheckedChange={v => setForm({ ...form, auto: !!v })} />Esta conta tem aplicação automática</label>
              {form.auto && <>
                <div><Label>Saldo aplicado inicial</Label><Input value={form.autoSaldo} onChange={e => setForm({ ...form, autoSaldo: e.target.value })} placeholder="122.078,73" /></div>
                <div><Label>Data do saldo aplicado</Label><Input type="date" value={form.autoData} onChange={e => setForm({ ...form, autoData: e.target.value })} /></div>
                <p className="col-span-2 text-xs text-muted-foreground">Informe só a parte aplicada (saldo com aplicação menos o saldo em conta).</p>
              </>}
            </div>
          )}
          <DialogFooter><Button onClick={saveAccount}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={o => !o && !busy && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Conferência antes de importar</DialogTitle></DialogHeader>
          {preview && p && (
            <div className="space-y-3">
              <p className="text-sm"><strong>{preview.file.name}</strong> → {accName.get(accountId)} · {p.formato.toUpperCase()}{p.banco ? ` · ${p.banco}` : ''}</p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Período</p><p className="font-semibold">{fmtDate(p.periodoInicio)} a {fmtDate(p.periodoFim)}</p></div>
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Lançamentos</p><p className="font-semibold">{p.transactions.length} ({p.transactions.length - preview.existing.size} novos)</p></div>
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Entradas</p><p className="font-semibold text-success">{fmtBRL(pEnt)}</p></div>
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Saídas</p><p className="font-semibold text-destructive">{fmtBRL(pSai)}</p></div>
              </div>
              {p.saldoFinalInformado !== undefined && <p className="text-xs text-muted-foreground">Saldo final informado pelo banco: {fmtBRL(p.saldoFinalInformado)}</p>}
              {preview.kinds.some(k => k !== 'normal') && <p className="text-xs text-info">{preview.kinds.filter(k => k !== 'normal').length} lançamento(s) marcados como aplicação automática (fora de entradas e saídas). Desmarque na tabela se algum estiver errado.</p>}
              {accounts.find(a => a.id === accountId)?.has_auto_invest && (
                <div className="flex items-center gap-2 text-xs"><Label className="text-xs">Saldo com aplicação no fim do extrato (opcional, para conferência):</Label><Input className="h-7 w-40" value={preview.saldoAplicado} onChange={e => setPreview({ ...preview, saldoAplicado: e.target.value })} placeholder="122.677,73" /></div>
              )}
              {preview.existing.size > 0 && <p className="text-xs text-muted-foreground">{preview.existing.size} lançamento(s) já existem nesta conta e serão ignorados.</p>}
              {p.avisos.map(a => <p key={a} className="flex items-center gap-1 rounded-md bg-warning/15 p-2 text-xs text-warning"><AlertTriangle className="h-4 w-4" />{a}</p>)}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-1.5">Data</th><th className="p-1.5">Descrição</th><th className="p-1.5 text-right">Entrada</th><th className="p-1.5 text-right">Saída</th><th className="p-1.5">Aplic. aut.</th><th className="p-1.5" /></tr></thead>
                  <tbody>
                    {p.transactions.map((t, i) => (
                      <tr key={i} className={`border-t border-border ${preview.existing.has(preview.hashes[i]) ? 'opacity-40' : ''}`}>
                        <td className="p-1.5">{fmtDate(t.data)}</td><td className="p-1.5">{t.descricao}</td>
                        <td className="p-1.5 text-right">{t.tipo === 'entrada' ? fmtBRL(t.valor) : ''}</td><td className="p-1.5 text-right">{t.tipo === 'saida' ? fmtBRL(t.valor) : ''}</td>
                        <td className="p-1.5"><Checkbox checked={preview.kinds[i] !== 'normal'} onCheckedChange={v => { const k = [...preview.kinds]; k[i] = v ? (t.tipo === 'saida' ? 'auto_aplicacao' : 'auto_resgate') : 'normal'; setPreview({ ...preview, kinds: k }); }} /></td>
                        <td className="p-1.5 text-muted-foreground">{preview.existing.has(preview.hashes[i]) ? 'já existe' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Cancelar</Button>
            <Button disabled={busy} onClick={confirmImport}>{busy ? 'Importando…' : 'Confirmar importação'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir importação</AlertDialogTitle>
            <AlertDialogDescription>Todos os lançamentos vindos deste arquivo, inclusive as conciliações, serão removidos. O arquivo original também será apagado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteImport} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
