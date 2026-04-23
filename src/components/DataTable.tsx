import { useMemo, useState } from 'react';
import { FinancialEntry } from '@/types/financial';
import { useEntries, useSchool, useUpdateEntry, useDeleteEntry, useAddAuditLog, useTypeClassifications } from '@/hooks/useFinancialData';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Check, X, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getEffectiveClassification } from '@/lib/classificationUtils';
import { usePresentation } from '@/components/presentation-provider';

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
  const { isPresentationMode } = usePresentation();
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const { data: allEntries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const updateEntryMut = useUpdateEntry();
  const deleteEntryMut = useDeleteEntry();
  const addAuditMut = useAddAuditLog();

  // Filter states
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterClassificacao, setFilterClassificacao] = useState<string>('all');
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterRegistro, setFilterRegistro] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>('');     // YYYY-MM-DD

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const entries = useMemo(() => {
    let result = [...allEntries];
    if (selectedMonth !== 'all') {
      const months = selectedMonth.split(',');
      result = result.filter(e => months.includes(e.data.slice(0, 7)));
    }
    if (dateFrom) result = result.filter(e => e.data >= dateFrom);
    if (dateTo) result = result.filter(e => e.data <= dateTo);
    return result.sort((a, b) => a.data.localeCompare(b.data));
  }, [allEntries, selectedMonth, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let result = entries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.descricao.toLowerCase().includes(q) ||
        e.categoria.toLowerCase().includes(q) ||
        e.data.includes(q)
      );
    }
    if (filterTipo !== 'all') result = result.filter(e => e.tipo === filterTipo);
    if (filterOrigem !== 'all') result = result.filter(e => e.origem === filterOrigem);
    if (filterRegistro !== 'all') result = result.filter(e => e.tipoRegistro === filterRegistro);
    if (filterClassificacao !== 'all') {
      result = result.filter(e => getEffectiveClassification(e, classifications) === filterClassificacao);
    }
    return result;
  }, [entries, search, filterTipo, filterOrigem, filterRegistro, filterClassificacao, classifications]);

  const withBalance = useMemo(() => {
    let saldo = saldoInicial;
    return filtered.map(e => {
      if (e.tipo === 'entrada') saldo += e.valor;
      else saldo -= e.valor;
      return { ...e, saldo };
    });
  }, [filtered, saldoInicial]);

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FinancialEntry>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleTipoChange = async (entryId: string, novoTipo: 'entrada' | 'saida') => {
    try {
      await updateEntryMut.mutateAsync({ id: entryId, updates: { tipo: novoTipo, editadoManualmente: true } });
      toast.success('Classificação atualizada');
    } catch { toast.error('Erro ao atualizar classificação'); }
  };

  const startEdit = (e: FinancialEntry) => {
    setEditId(e.id);
    setEditData({ data: e.data, descricao: e.descricao, valor: e.valor, tipo: e.tipo, categoria: e.categoria });
  };
  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async () => {
    if (!editId || !editData.data || !editData.descricao || editData.valor === undefined) {
      toast.error('Preencha todos os campos'); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editData.data)) { toast.error('Data inválida (use AAAA-MM-DD)'); return; }
    if (editData.valor <= 0) { toast.error('Valor deve ser positivo'); return; }
    try {
      await updateEntryMut.mutateAsync({ id: editId, updates: { ...editData, editadoManualmente: true } });
      await addAuditMut.mutateAsync({ school_id: schoolId, action: 'edit', description: `Lançamento editado: ${editData.descricao}` });
      setEditId(null); setEditData({}); onDataChanged();
      toast.success('Lançamento atualizado');
    } catch { toast.error('Erro ao atualizar'); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEntryMut.mutateAsync(deleteId);
      await addAuditMut.mutateAsync({ school_id: schoolId, action: 'delete', description: 'Lançamento excluído' });
      setDeleteId(null); onDataChanged();
      toast.success('Lançamento excluído');
    } catch { toast.error('Erro ao excluir'); }
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === withBalance.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(withBalance.map(e => e.id)));
  };

  const confirmBulkDelete = async () => {
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await deleteEntryMut.mutateAsync(id);
      }
      await addAuditMut.mutateAsync({ school_id: schoolId, action: 'delete', description: `${ids.length} lançamentos excluídos em massa` });
      setSelectedIds(new Set()); setBulkDeleteOpen(false); onDataChanged();
      toast.success(`${ids.length} lançamentos excluídos`);
    } catch { toast.error('Erro ao excluir em massa'); }
  };

  const totalEntradas = filtered.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const totalSaidas = filtered.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);

  // Available origins for filter
  const origens = useMemo(() => [...new Set(entries.map(e => e.origem))].sort(), [entries]);

  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-4 text-sm flex-wrap">
            <span className="text-muted-foreground">{filtered.length} lançamentos</span>
            <span className="text-primary font-semibold">Entradas: {formatCurrency(totalEntradas)}</span>
            <span className="text-destructive font-semibold">Saídas: {formatCurrency(totalSaidas)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9">
              <Filter className="w-4 h-4 mr-1" /> Filtros
            </Button>
          </div>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">De</span>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Até</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-[140px] text-xs" />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Limpar datas
              </Button>
            )}
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClassificacao} onValueChange={setFilterClassificacao}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Classificação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Class.</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="operacao">Operação</SelectItem>
                <SelectItem value="ignorar">Ignorar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrigem} onValueChange={setFilterOrigem}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Origens</SelectItem>
                {origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRegistro} onValueChange={setFilterRegistro}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Registro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="projetado">Projetado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/30">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selecionado(s)</span>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir selecionados
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
          </div>
        )}
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {!isPresentationMode && (
                  <th className="px-2 py-2.5 text-center w-8">
                    <Checkbox checked={withBalance.length > 0 && selectedIds.size === withBalance.length}
                      onCheckedChange={toggleSelectAll} />
                  </th>
                )}
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Class.</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Registro</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Origem</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Forma</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Descrição</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Saldo Acum.</th>
                {!isPresentationMode && (
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-20">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {withBalance.map(e => {
                const cls = getEffectiveClassification(e, classifications);
                const clsLabel = cls === 'receita' ? 'Receita' : cls === 'despesa' ? 'Despesa' : cls === 'operacao' ? 'Operação' : 'Ignorar';
                const clsColor = cls === 'receita' ? 'bg-success/10 text-success' : cls === 'despesa' ? 'bg-destructive/10 text-destructive' : cls === 'operacao' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground';
                return (
                  <tr key={e.id} className={`border-t border-border/30 hover:bg-muted/30 transition-colors ${e.saldo < 0 ? 'bg-destructive/5' : ''} ${cls === 'ignorar' ? 'opacity-40' : ''}`}>
                    {editId === e.id && !isPresentationMode ? (
                      <>
                        <td className="px-2 py-1 text-center">
                          <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                        </td>
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
                        <td className="px-2 py-1"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${clsColor}`}>{clsLabel}</span></td>
                        <td className="px-2 py-1">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            e.tipoRegistro === 'realizado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>{e.tipoRegistro === 'realizado' ? 'Real.' : 'Proj.'}</span>
                        </td>
                        <td className="px-2 py-1 text-muted-foreground text-[10px]">{e.origem}</td>
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
                        {!isPresentationMode && (
                          <td className="px-2 py-2 text-center">
                            <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                          </td>
                        )}
                        <td className="px-3 py-2 font-medium text-foreground">{formatDate(e.data)}</td>
                        <td className="px-3 py-2">
                          {isPresentationMode ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              e.tipo === 'entrada' ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'
                            }`}>
                              {e.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                            </span>
                          ) : (
                            <Select value={e.tipo} onValueChange={(v) => handleTipoChange(e.id, v as 'entrada' | 'saida')}>
                            <SelectTrigger className={`h-6 w-[90px] text-[10px] font-semibold border-0 px-1.5 py-0.5 ${
                              e.tipo === 'entrada' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrada">Entrada</SelectItem>
                              <SelectItem value="saida">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${clsColor}`}>{clsLabel}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            e.tipoRegistro === 'realizado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>{e.tipoRegistro === 'realizado' ? 'Realizado' : 'Projetado'}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px]">{e.origem}</td>
                        <td className="px-3 py-2 text-muted-foreground">{standardizePaymentType(e.categoria)}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                          {e.descricao}
                          {e.editadoManualmente && <span className="ml-1 text-[9px] text-amber-600 font-semibold">✎</span>}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${e.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(e.valor)}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${e.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(e.saldo)}
                        </td>
                        {!isPresentationMode && (
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => startEdit(e)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteId(e.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
              {withBalance.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Single delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} lançamento(s)</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir {selectedIds.size} lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir todos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
