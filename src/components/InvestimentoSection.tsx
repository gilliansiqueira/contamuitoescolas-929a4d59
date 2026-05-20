import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { PiggyBank, Plus, Copy, Trash2, Save, Settings } from 'lucide-react';
import { InvestimentoCard } from '@/components/InvestimentoCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  selectedMonth: string;
}

interface InvestmentRow {
  id?: string;
  school_id: string;
  month: string;
  nome: string;
  sort_order: number;
  aplicacao: number;
  resgate: number;
  rendimentos: number;
  encargos: number;
  rendimento_provisionado: number;
  saldo_inicial: number;
  saldo_final: number;
}

const FIELDS: { key: keyof InvestmentRow; label: string }[] = [
  { key: 'saldo_inicial', label: 'Saldo Inicial' },
  { key: 'aplicacao', label: 'Aplicação' },
  { key: 'resgate', label: 'Resgate' },
  { key: 'rendimentos', label: 'Rendimentos' },
  { key: 'encargos', label: 'Encargos' },
  { key: 'rendimento_provisionado', label: 'Rend. Provisionado' },
  { key: 'saldo_final', label: 'Saldo Final' },
];

function emptyRow(schoolId: string, month: string, nome = 'Investimento', sort = 0): InvestmentRow {
  return {
    school_id: schoolId, month, nome, sort_order: sort,
    aplicacao: 0, resgate: 0, rendimentos: 0, encargos: 0,
    rendimento_provisionado: 0, saldo_inicial: 0, saldo_final: 0,
  };
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBR(v: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

export function InvestimentoSection({ schoolId, selectedMonth }: Props) {
  const qc = useQueryClient();

  const targetMonth = useMemo(() => {
    if (selectedMonth === 'all') return new Date().toISOString().slice(0, 7);
    const first = selectedMonth.split(',')[0].trim();
    return first || new Date().toISOString().slice(0, 7);
  }, [selectedMonth]);

  const [editMonth, setEditMonth] = useState(targetMonth);
  useEffect(() => setEditMonth(targetMonth), [targetMonth]);

  const { data: rows = [] } = useQuery({
    queryKey: ['investment_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_entries' as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('month', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvestmentRow[];
    },
    enabled: !!schoolId,
  });

  // Cards do mês em edição (estado local — salva on demand)
  const [editingCards, setEditingCards] = useState<InvestmentRow[]>([]);

  useEffect(() => {
    const fromDb = rows.filter(r => r.month === editMonth);
    if (fromDb.length > 0) setEditingCards(fromDb);
    else setEditingCards([emptyRow(schoolId, editMonth, 'Investimento', 0)]);
  }, [rows, editMonth, schoolId]);

  const upsertOne = useMutation({
    mutationFn: async (payload: InvestmentRow) => {
      if (payload.id) {
        const { error } = await supabase.from('investment_entries' as any)
          .update(payload as any).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('investment_entries' as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] }),
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_entries' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] }),
  });

  const handleSaveAll = async () => {
    try {
      await Promise.all(editingCards.map(c => upsertOne.mutateAsync(c)));
      toast.success('Investimentos salvos');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
  };

  const handleAddCard = () => {
    setEditingCards(cs => [...cs, emptyRow(schoolId, editMonth, `Investimento ${cs.length + 1}`, cs.length)]);
  };

  const handleDuplicateCard = (idx: number) => {
    setEditingCards(cs => {
      const copy = { ...cs[idx], id: undefined, nome: `${cs[idx].nome} (cópia)`, sort_order: cs.length };
      return [...cs, copy];
    });
  };

  const handleRemoveCard = async (idx: number) => {
    const card = editingCards[idx];
    if (card.id) {
      await deleteOne.mutateAsync(card.id);
    }
    setEditingCards(cs => cs.filter((_, i) => i !== idx));
    toast.success('Investimento removido');
  };

  const updateField = (idx: number, field: keyof InvestmentRow, value: any) => {
    setEditingCards(cs => cs.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  // Visíveis na tabela agregada
  const visibleMonths = useMemo(() => {
    if (selectedMonth === 'all') return Array.from(new Set(rows.map(r => r.month))).sort();
    return selectedMonth.split(',').map(s => s.trim()).filter(Boolean).sort();
  }, [selectedMonth, rows]);

  const visibleRows = useMemo(
    () => rows.filter(r => visibleMonths.includes(r.month)),
    [rows, visibleMonths]
  );

  const totals = useMemo(() => {
    const t = { aplicacao: 0, resgate: 0, rendimentos: 0, encargos: 0, rendimento_provisionado: 0 };
    for (const r of visibleRows) {
      t.aplicacao += Number(r.aplicacao) || 0;
      t.resgate += Number(r.resgate) || 0;
      t.rendimentos += Number(r.rendimentos) || 0;
      t.encargos += Number(r.encargos) || 0;
      t.rendimento_provisionado += Number(r.rendimento_provisionado) || 0;
    }
    return t;
  }, [visibleRows]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>(rows.map(r => r.month));
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort();
  }, [rows]);

  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
      {/* Card hero moderno com gráfico e métricas (com engrenagem de admin) */}
      <div className="relative">
        <InvestimentoCard schoolId={schoolId} selectedMonth={selectedMonth} />
        {isAdmin && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <button
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/60 hover:bg-background/90 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
                title="Editar investimentos (admin)"
              >
                <Settings className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PiggyBank className="w-4 h-4" /> Editar investimentos
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Seletor de mês + ações */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Mês:</span>
                  <Select value={editMonth} onValueChange={setEditMonth}>
                    <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {monthOptions.map(m => (
                        <SelectItem key={m} value={m}>{m.split('-').reverse().join('/')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleAddCard}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar investimento
                  </Button>
                  <Button size="sm" onClick={handleSaveAll} disabled={upsertOne.isPending}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar todos
                  </Button>
                </div>

                {/* Cards configuráveis */}
                <div className="grid gap-4 md:grid-cols-2">
                  {editingCards.map((card, idx) => (
                    <div key={card.id || `new-${idx}`} className="border border-border/40 rounded-lg p-4 space-y-3 bg-background/40">
                      <div className="flex items-center gap-2">
                        <Input
                          value={card.nome}
                          onChange={e => updateField(idx, 'nome', e.target.value)}
                          className="h-8 text-sm font-medium flex-1"
                          placeholder="Nome do investimento"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDuplicateCard(idx)} title="Duplicar">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemoveCard(idx)} title="Remover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {FIELDS.map(f => (
                          <div key={f.key as string}>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={String(card[f.key] ?? '')}
                              onChange={e => updateField(idx, f.key, parseBR(e.target.value))}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela agregada */}
                {visibleRows.length > 0 && (
                  <div className="overflow-x-auto border-t border-border/30 pt-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground uppercase tracking-wider">
                          <th className="text-left py-2 pr-3">Mês</th>
                          <th className="text-left py-2 pr-3">Nome</th>
                          {FIELDS.map(f => (
                            <th key={f.key as string} className="text-right py-2 px-2">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map(r => (
                          <tr key={r.id} className="border-t border-border/20 hover:bg-muted/30 cursor-pointer"
                              onClick={() => setEditMonth(r.month)}>
                            <td className="py-2 pr-3 font-medium">{r.month.split('-').reverse().join('/')}</td>
                            <td className="py-2 pr-3">{r.nome}</td>
                            {FIELDS.map(f => (
                              <td key={f.key as string} className="text-right py-2 px-2 tabular-nums">
                                {formatCurrency(Number(r[f.key]) || 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {visibleRows.length > 1 && (
                          <tr className="border-t border-border/40 font-semibold">
                            <td className="py-2 pr-3" colSpan={2}>Total</td>
                            <td className="text-right py-2 px-2">—</td>
                            <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.aplicacao)}</td>
                            <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.resgate)}</td>
                            <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.rendimentos)}</td>
                            <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.encargos)}</td>
                            <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.rendimento_provisionado)}</td>
                            <td className="text-right py-2 px-2">—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </motion.div>
  );
}
