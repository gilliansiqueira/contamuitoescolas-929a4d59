import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { fetchSchoolTemplateId, fetchTemplateItems } from '@/lib/financialModels';
import { normalizeTipo } from '@/lib/classificationUtils';
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import { useTypeClassifications } from '@/hooks/useFinancialData';
import { useAuth } from '@/hooks/useAuth';

interface Row {
  id: string; data: string; descricao: string; valor: number; tipo: 'entrada' | 'saida';
  categoria: string; afeta_saldo: boolean; created_at: string; created_by: string | null;
  tipo_registro: string; tipo_original: string | null; origem: string; school_id: string;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtD = (d: string) => d ? d.slice(0, 10).split('-').reverse().join('/') : '';
const parseVal = (s: string) => { const n = Number(String(s).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? Math.abs(n) : NaN; };

/** Ajusta o espelho mensal do Histórico Financeiro pela diferença (nunca deixa sobra). */
async function adjustHistorical(schoolId: string, month: string, categoria: string, delta: number) {
  if (!delta) return;
  const key = normalizeTipo(categoria);
  const { data } = await supabase.from('historical_monthly' as any).select('id, valor, tipo_valor').eq('school_id', schoolId).eq('month', month);
  const variants = ((data ?? []) as any[]).filter(r => normalizeTipo(r.tipo_valor) === key);
  if (!variants.length) return; // nada espelhado neste mês
  const total = variants.reduce((s, r) => s + Number(r.valor || 0), 0) + delta;
  await supabase.from('historical_monthly' as any).delete().in('id', variants.map(r => r.id));
  if (Math.abs(total) > 0.004) await supabase.from('historical_monthly' as any).insert({ school_id: schoolId, month, tipo_valor: key, valor: total });
}

export function ManualEntriesPanel({ schoolId, selectedMonth }: { schoolId: string; selectedMonth?: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const initial = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : new Date().toISOString().slice(0, 7);
  const [ownMonth, setOwnMonth] = useState(initial);
  const month = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : ownMonth;
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({ data: '', descricao: '', valor: '', categoria: '', naoAfeta: false });
  const [del, setDel] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ['manualEntries', schoolId, month],
    enabled: !!schoolId && isAdmin,
    queryFn: async () => {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      const { data, error } = await supabase.from('financial_entries')
        .select('id, data, descricao, valor, tipo, categoria, afeta_saldo, created_at, created_by, tipo_registro, tipo_original, origem, school_id')
        .eq('school_id', schoolId).eq('origem', 'manual')
        .gte('data', `${month}-01`).lte('data', `${month}-${String(last).padStart(2, '0')}`)
        .order('data');
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
  const { data: names = {} } = useQuery({
    queryKey: ['profileNames', rows.map(r => r.created_by).join(',')],
    enabled: rows.some(r => r.created_by),
    queryFn: async () => {
      const ids = [...new Set(rows.map(r => r.created_by).filter(Boolean))] as string[];
      const { data } = await supabase.from('profiles').select('id, email').in('id', ids);
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.email?.split('@')[0] ?? '']));
    },
  });
  const { data: templateId } = useQuery({ queryKey: ['schoolTemplateId', schoolId], queryFn: () => fetchSchoolTemplateId(schoolId), enabled: !!schoolId });
  const { data: items = [] } = useQuery({ queryKey: ['templateItems', templateId], queryFn: () => fetchTemplateItems(templateId!), enabled: !!templateId });
  const modelItems = useMemo(() => items.filter(i => i.tipo !== 'ignorar'), [items]);

  const toEntry = (r: Row) => ({ id: r.id, data: r.data, descricao: r.descricao, valor: Number(r.valor), tipo: r.tipo, categoria: r.categoria, origem: 'manual' as const, school_id: r.school_id, tipoOriginal: r.tipo_original ?? undefined, tipoRegistro: r.tipo_registro as any, editadoManualmente: true, afetaSaldo: r.afeta_saldo });
  const classOf = (r: Row) => {
    const rule = resolveEntryLedgerRule({ ...toEntry(r), afetaSaldo: true }, classifications);
    if (!rule.impactaCaixa && !rule.entraNoResultado) return 'Ignorar';
    return rule.entraNoResultado ? (rule.operacaoSinal === 'somar' ? 'Receita' : 'Despesa') : 'Operação';
  };
  const totals = rows.reduce((acc, r) => { const c = classOf(r); acc[c] = (acc[c] ?? 0) + Number(r.valor); return acc; }, {} as Record<string, number>);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['manualEntries'] });
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['historicalMonthly'] });
  };

  const openEdit = (r: Row) => {
    setEdit(r);
    setForm({ data: r.data, descricao: r.descricao, valor: Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), categoria: r.categoria, naoAfeta: r.afeta_saldo === false });
  };

  const saveEdit = async () => {
    if (!edit) return;
    const valor = parseVal(form.valor);
    const item = modelItems.find(i => i.name === form.categoria);
    if (!form.data || !form.descricao || !isFinite(valor) || valor <= 0 || !item) { toast.error('Preencha data, descrição, valor e categoria.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('financial_entries').update({
        data: form.data, descricao: form.descricao, valor, categoria: item.name,
        tipo: item.tipo === 'entrada' ? 'entrada' : 'saida', afeta_saldo: !form.naoAfeta, editado_manualmente: true,
      } as any).eq('id', edit.id);
      if (error) throw error;
      await adjustHistorical(schoolId, edit.data.slice(0, 7), edit.categoria, -Number(edit.valor));
      await adjustHistorical(schoolId, form.data.slice(0, 7), item.name, valor);
      await supabase.from('audit_log').insert({ school_id: schoolId, action: 'manual_entry_edit', description: `Lançamento manual editado: ${edit.data} ${edit.descricao} ${edit.valor} [${edit.categoria}] → ${form.data} ${form.descricao} ${valor} [${item.name}]${form.naoAfeta ? ' (não altera saldo)' : ''}` } as any);
      toast.success('Lançamento atualizado.');
      setEdit(null); refresh();
    } catch (e: any) { toast.error(`Não foi possível salvar: ${e?.message ?? ''}`); }
    finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('financial_entries').delete().eq('id', del.id);
      if (error) throw error;
      await adjustHistorical(schoolId, del.data.slice(0, 7), del.categoria, -Number(del.valor));
      await supabase.from('audit_log').insert({ school_id: schoolId, action: 'manual_entry_delete', description: `Lançamento manual excluído: ${del.data} ${del.descricao} ${del.valor} [${del.categoria}]` } as any);
      toast.success('Lançamento excluído.');
      setDel(null); refresh();
    } catch (e: any) { toast.error(`Não foi possível excluir: ${e?.message ?? ''}`); }
    finally { setBusy(false); }
  };

  if (!isAdmin) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Lançamentos manuais</h3>
          <span className="text-xs text-muted-foreground">conferir, corrigir ou excluir</span>
        </div>
        {!(selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) && (
          <Input type="month" value={ownMonth} onChange={e => setOwnMonth(e.target.value)} className="h-8 w-40" />
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum lançamento manual em {month.split('-').reverse().join('/')}.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(totals).map(([k, v]) => <span key={k} className="rounded-md bg-muted px-2 py-1"><strong>{k}:</strong> {fmt(v)}</span>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Data</th><th>Descrição</th><th>Categoria</th><th className="text-right">Valor</th><th>Saldo bancário</th><th>Lançado por</th><th /></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 whitespace-nowrap">{fmtD(r.data)}</td>
                    <td>{r.descricao}</td>
                    <td>{r.categoria} <span className="text-xs text-muted-foreground">({classOf(r)})</span></td>
                    <td className={`text-right tabular-nums ${r.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>{r.tipo === 'entrada' ? '' : '−'}{fmt(Number(r.valor))}</td>
                    <td className="text-xs">{r.afeta_saldo === false ? <span className="text-muted-foreground">Não altera</span> : <span className="text-foreground">Altera</span>}</td>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">{(names as any)[r.created_by ?? ''] || '—'} · {fmtD(r.created_at)}</td>
                    <td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDel(r)}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar lançamento manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            <Input placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            <Input placeholder="Valor (ex: 1.500,50)" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="h-9 w-full border rounded px-2 text-sm bg-background">
              <option value="">Selecione a categoria…</option>
              {modelItems.map(i => <option key={i.id} value={i.name}>{i.name} ({i.tipo === 'entrada' ? 'Entrada' : 'Saída'})</option>)}
            </select>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={form.naoAfeta} onChange={e => setForm(f => ({ ...f, naoAfeta: e.target.checked }))} />
              <span><strong>Não altera o saldo bancário</strong> — conta no Resultado, mas não muda Saldo/Caixa.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={busy}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={o => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>{del && `${fmtD(del.data)} — ${del.descricao} — ${fmt(Number(del.valor))}. Os totais do mês serão recalculados.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
