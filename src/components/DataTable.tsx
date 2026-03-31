import { useMemo, useState } from 'react';
import { FinancialEntry } from '@/types/financial';
import { useEntries, useSchool, useUpdateEntry, useDeleteEntry, useAddAuditLog } from '@/hooks/useFinancialData';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Check, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface DataTableProps {
  schoolId: string;
  selectedMonth: string;
  onDataChanged: () => void;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string) {
  return d.split('-').reverse().join('/');
}

function standardizePaymentType(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes('cobrança bancária') || lower.includes('cobranca bancaria')) return 'Boleto';
  if (lower.includes('transferência') || lower.includes('transferencia')) return 'PIX';
  if (lower.includes('cartão') || lower.includes('cartao')) return 'Cartão';
  if (lower.includes('pix')) return 'PIX';
  if (lower.includes('boleto')) return 'Boleto';
  return cat;
}

export function DataTable({ schoolId, selectedMonth, onDataChanged }: DataTableProps) {
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const { data: allEntries = [] } = useEntries(schoolId);
  const updateEntryMut = useUpdateEntry();
  const deleteEntryMut = useDeleteEntry();
  const addAuditMut = useAddAuditLog();

  const entries = useMemo(() => {
    if (selectedMonth === 'all') return [...allEntries].sort((a, b) => a.data.localeCompare(b.data));
    return allEntries.filter(e => {
      const months = selectedMonth.split(',');
      return months.includes(e.data.slice(0, 7));
    }).sort((a, b) => a.data.localeCompare(b.data));
  }, [allEntries, selectedMonth]);

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FinancialEntry>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.descricao.toLowerCase().includes(q) ||
      e.categoria.toLowerCase().includes(q) ||
      e.data.includes(q)
    );
  }, [entries, search]);

  const withBalance = useMemo(() => {
    let saldo = saldoInicial;
    return filtered.map(e => {
      saldo += e.tipo === 'entrada' ? e.valor : -e.valor;
      return { ...e, saldo };
    });
  }, [filtered, saldoInicial]);

  const startEdit = (e: FinancialEntry) => {
    setEditId(e.id);
    setEditData({ data: e.data, descricao: e.descricao, valor: e.valor, tipo: e.tipo, categoria: e.categoria });
  };

  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async () => {
    if (!editId || !editData.data || !editData.descricao || editData.valor === undefined) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editData.data)) {
      toast.error('Data inválida (use AAAA-MM-DD)');
      return;
    }
    if (editData.valor <= 0) {
      toast.error('Valor deve ser positivo');
      return;
    }
    try {
      await updateEntryMut.mutateAsync({ id: editId, updates: editData });
      await addAuditMut.mutateAsync({ school_id: schoolId, action: 'edit', description: `Lançamento editado: ${editData.descricao}` });
      setEditId(null);
      setEditData({});
      onDataChanged();
      toast.success('Lançamento atualizado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEntryMut.mutateAsync(deleteId);
      await addAuditMut.mutateAsync({ school_id: schoolId, action: 'delete', description: 'Lançamento excluído' });
      setDeleteId(null);
      onDataChanged();
      toast.success('Lançamento excluído');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const totalEntradas = filtered.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const totalSaidas = filtered.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">{filtered.length} lançamentos</span>
            <span className="text-primary font-semibold">Entradas: {formatCurrency(totalEntradas)}</span>
            <span className="text-destructive font-semibold">Saídas: {formatCurrency(totalSaidas)}</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Origem</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Forma</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Descrição</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Saldo Acum.</th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.map(e => (
                <tr key={e.id} className={`border-t border-border/30 hover:bg-muted/30 transition-colors ${e.saldo < 0 ? 'bg-destructive/5' : ''}`}>
                  {editId === e.id ? (
                    <>
                      <td className="px-2 py-1">
                        <Input value={editData.data || ''} onChange={ev => setEditData(d => ({ ...d, data: ev.target.value }))} className="h-7 text-xs w-28" />
                      </td>
                      <td className="px-2 py-1">
                        <select value={editData.tipo || 'entrada'} onChange={ev => setEditData(d => ({ ...d, tipo: ev.target.value as 'entrada' | 'saida' }))}
                          className="h-7 text-xs border rounded px-1 bg-background">
                          <option value="entrada">Entrada</option>
                          <option value="saida">Saída</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground text-[10px]">{e.origem === 'fluxo' ? 'Realizado' : 'Projetado'}</td>
                      <td className="px-2 py-1">
                        <Input value={editData.categoria || ''} onChange={ev => setEditData(d => ({ ...d, categoria: ev.target.value }))} className="h-7 text-xs w-24" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={editData.descricao || ''} onChange={ev => setEditData(d => ({ ...d, descricao: ev.target.value }))} className="h-7 text-xs" />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" value={editData.valor || 0} onChange={ev => setEditData(d => ({ ...d, valor: parseFloat(ev.target.value) || 0 }))} className="h-7 text-xs w-24 text-right" />
                      </td>
                      <td />
                      <td className="px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={saveEdit} className="p-1 rounded hover:bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="p-1 rounded hover:bg-destructive/10 text-destructive"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium text-foreground">{formatDate(e.data)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          e.tipo === 'entrada' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {e.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          e.origem === 'fluxo' ? 'bg-blue-100 text-blue-700' : 'bg-secondary/20 text-secondary'
                        }`}>
                          {e.origem === 'fluxo' ? 'Realizado' : 'Projetado'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{standardizePaymentType(e.categoria)}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{e.descricao}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${e.tipo === 'entrada' ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(e.valor)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${e.saldo >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(e.saldo)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(e)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteId(e.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {withBalance.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Todos os cálculos serão atualizados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
