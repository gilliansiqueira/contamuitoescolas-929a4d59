import { useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { CategoryBlock } from './CategoryBlock';
import { EditEntryDialog } from './EditEntryDialog';
import { AddEntryDialog } from './AddEntryDialog';
import { ReviewEntriesDialog } from './ReviewEntriesDialog';
import { DollarSign, Check, AlertTriangle, TrendingUp, TrendingDown, Flame, PiggyBank, Sparkles, Lock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { InsightsBar, type Insight } from '@/components/InsightsBar';
import { useClosedMonths } from '@/hooks/usePeriodClosures';
import { useMonthSync } from './SharedMonthContext';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';
import { ComparativeMetrics } from './ComparativeMetrics';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonth(m: string) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]}/${y?.slice(2) || ''}`;
}

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function RelatorioRealizado({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const closedMonths = useClosedMonths(schoolId);
  const [mesFilter, setMesFilter] = useState('all');
  const [faturamentoInput, setFaturamentoInput] = useState('');
  const [editingFat, setEditingFat] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewEntries, setReviewEntries] = useState<any[]>([]);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; updates: any; originalCategory: string; originalDescription: string } | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { fetchAllRows } = await import('@/lib/fetchAll');
      return fetchAllRows<any>('realized_entries', q => q.eq('school_id', schoolId).order('data'));
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data;
    },
  });

  const { data: revenues = [] } = useQuery({
    queryKey: ['monthly_revenue', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_revenue').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data as { id: string; school_id: string; month: string; value: number }[];
    },
  });

  const saveFaturamento = useMutation({
    mutationFn: async ({ month, value }: { month: string; value: number }) => {
      const existing = revenues.find(r => r.month === month);
      if (existing) {
        const { error } = await supabase.from('monthly_revenue').update({ value }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('monthly_revenue').insert({ school_id: schoolId, month, value });
        if (error) throw error;
      }
    },
    onSuccess: (data, variables) => {
      const cacheKey = ['monthly_revenue', schoolId];
      const previous = queryClient.getQueryData<any[]>(cacheKey);
      if (previous) {
        let updated = [...previous];
        const existingIdx = previous.findIndex(r => r.month === variables.month);
        if (existingIdx > -1) {
          updated[existingIdx] = { ...updated[existingIdx], value: variables.value };
        } else {
          updated.push({ id: crypto.randomUUID(), school_id: schoolId, month: variables.month, value: variables.value });
        }
        queryClient.setQueryData(cacheKey, updated);
      }
      queryClient.invalidateQueries({ queryKey: ['monthly_revenue', schoolId] });
      toast.success('Faturamento salvo');
      setEditingFat(false);
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({
      id,
      updates,
      scope,
      selectedIds = [],
      saveRule = false,
      originalCategoryName = '',
      originalDescription = '',
    }: {
      id: string;
      updates: any;
      scope: 'single' | 'all';
      selectedIds?: string[];
      saveRule?: boolean;
      originalCategoryName?: string;
      originalDescription?: string;
    }) => {
      if (scope === 'all') {
        if (selectedIds.length > 0) {
          // Update all selected entries
          const { error: updateAllErr } = await supabase
            .from('realized_entries')
            .update({
              conta_nome: updates.conta_nome,
            })
            .in('id', selectedIds);
          if (updateAllErr) throw updateAllErr;

          // Upsert auto-categorization rule in category_rules using composite key (description + original category) if saveRule is true
          if (saveRule && originalDescription) {
            const sourceText = `${originalDescription} | ${originalCategoryName}`;
            const sourceNormalized = `${normalizeStr(originalDescription)}|${normalizeStr(originalCategoryName)}`;
            const { error: ruleErr } = await supabase
              .from('category_rules')
              .upsert({
                school_id: schoolId,
                source_text: sourceText,
                source_normalized: sourceNormalized,
                target_categoria: updates.conta_nome,
                match_field: 'categoria'
              }, {
                onConflict: 'school_id,source_normalized,match_field'
              });
            if (ruleErr) throw ruleErr;
          }
        }
      } else {
        // Edit only this single entry
        const { error } = await supabase.from('realized_entries').update(updates).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (data, variables) => {
      const cacheKey = ['realized_entries', schoolId];
      const previousEntries = queryClient.getQueryData<any[]>(cacheKey);
      if (previousEntries) {
        let updatedEntries = [...previousEntries];
        if (variables.scope === 'all') {
          const selectedSet = new Set(variables.selectedIds || []);
          updatedEntries = previousEntries.map(e => {
            if (selectedSet.has(e.id)) {
              return { ...e, conta_nome: variables.updates.conta_nome };
            }
            return e;
          });
        } else {
          updatedEntries = previousEntries.map(e => {
            if (e.id === variables.id) {
              return { ...e, ...variables.updates };
            }
            return e;
          });
        }
        queryClient.setQueryData(cacheKey, updatedEntries);
      }
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['category_rules', schoolId] });
    },
  });

  const handleEditSave = useCallback(async (id: string, updates: any, scope: 'single' | 'all') => {
    if (scope === 'all') {
      const editedEntry = entries.find(e => e.id === id);
      if (!editedEntry) return;

      // Close edit modal
      setEditOpen(false);

      // Filter all local entries with same description
      const affected = entries.filter(e => e.descricao === editedEntry.descricao);
      setReviewEntries(affected);
      setPendingUpdate({
        id,
        updates,
        originalCategory: editedEntry.conta_nome,
        originalDescription: editedEntry.descricao,
      });
      setReviewOpen(true);
    } else {
      await updateEntry.mutateAsync({ id, updates, scope: 'single' });
      toast.success('Lançamento atualizado');
    }
  }, [entries, updateEntry]);

  const handleReviewConfirm = useCallback(async (selectedIds: string[], saveRule: boolean) => {
    if (!pendingUpdate) return;
    try {
      await updateEntry.mutateAsync({
        id: pendingUpdate.id,
        updates: pendingUpdate.updates,
        scope: 'all',
        selectedIds,
        saveRule,
        originalCategoryName: pendingUpdate.originalCategory,
        originalDescription: pendingUpdate.originalDescription,
      });
      toast.success('Lançamentos atualizados com sucesso');
      setPendingUpdate(null);
    } catch (e: any) {
      toast.error(`Erro ao salvar lançamentos: ${e?.message ?? 'Erro desconhecido'}`);
    }
  }, [pendingUpdate, updateEntry]);

  const addEntry = useMutation({
    mutationFn: async (entry: {
      data: string;
      valor: number;
      descricao: string;
      conta_nome: string;
      conta_codigo?: string;
    }) => {
      const { error } = await supabase.from('realized_entries').insert({
        school_id: schoolId,
        data: entry.data,
        descricao: entry.descricao,
        valor: entry.valor,
        conta_nome: entry.conta_nome,
        conta_codigo: entry.conta_codigo || '',
        tipo: 'despesa',
        origem_arquivo: 'manual',
        complemento: '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
    },
  });

  const deleteEntries = useMutation({
    mutationFn: async ({
      ids,
      month,
      grupoName,
    }: {
      ids?: string[];
      month?: string;
      grupoName?: string;
    }) => {
      let query = supabase.from('realized_entries').delete().eq('school_id', schoolId);

      if (ids && ids.length > 0) {
        query = query.in('id', ids);
      } else if (month && grupoName) {
        const subcategories = contas
          .filter(c => c.nivel > 1 && (c.grupo === grupoName || (!c.grupo && grupoName === 'Outros')))
          .map(c => c.nome);
        
        if (subcategories.length === 0) return;
        query = query.like('data', `${month}%`).in('conta_nome', subcategories);
      } else if (month) {
        query = query.like('data', `${month}%`);
      } else {
        throw new Error('Parâmetros inválidos para exclusão');
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      const cacheKey = ['realized_entries', schoolId];
      const previousEntries = queryClient.getQueryData<any[]>(cacheKey);
      if (previousEntries) {
        let updatedEntries = [...previousEntries];
        if (variables.ids && variables.ids.length > 0) {
          const deletedSet = new Set(variables.ids);
          updatedEntries = previousEntries.filter(e => !deletedSet.has(e.id));
        } else if (variables.month) {
          if (variables.grupoName) {
            const subcategories = contas
              .filter(c => c.nivel > 1 && (c.grupo === variables.grupoName || (!c.grupo && variables.grupoName === 'Outros')))
              .map(c => c.nome);
            const subSet = new Set(subcategories);
            updatedEntries = previousEntries.filter(e => {
              const ym = e.data?.slice(0, 7);
              return !(ym === variables.month && subSet.has(e.conta_nome));
            });
          } else {
            updatedEntries = previousEntries.filter(e => e.data?.slice(0, 7) !== variables.month);
          }
        }
        queryClient.setQueryData(cacheKey, updatedEntries);
      }
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      toast.success('Exclusão executada com sucesso');
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir: ${err?.message || 'Erro desconhecido'}`);
    },
  });

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach(e => { const m = e.data?.slice(0, 7); if (m && m.length === 7) meses.add(m); });
    return Array.from(meses).sort();
  }, [entries]);

  const currentYM = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const selectedList = useMemo(() => {
    if (!mesFilter || mesFilter === 'all') return [] as string[];
    return mesFilter.split(',').map(s => s.trim()).filter(Boolean);
  }, [mesFilter]);
  const effectiveMonths = selectedList.length ? selectedList : [currentYM];
  const activeMes = effectiveMonths[effectiveMonths.length - 1]; // latest, for single-month ops
  const isMulti = effectiveMonths.length > 1;

  const pushShared = useMonthSync(
    selectedList.length === 1 ? selectedList[0] : null,
    (m) => setMesFilter(m)
  );

  const filtered = useMemo(() => {
    const set = new Set(effectiveMonths);
    return entries.filter(e => {
      const ym = e.data?.slice(0, 7);
      return ym && set.has(ym);
    });
  }, [entries, effectiveMonths.join(',')]);

  const currentRevenue = useMemo(() => {
    return revenues
      .filter(r => effectiveMonths.includes(r.month))
      .reduce((s, r) => s + (r.value || 0), 0);
  }, [revenues, effectiveMonths.join(',')]);

  useMemo(() => {
    if (currentRevenue > 0 && !editingFat) {
      setFaturamentoInput(currentRevenue.toString());
    } else if (!editingFat) {
      setFaturamentoInput('');
    }
  }, [activeMes, currentRevenue]);

  const contaGrupoMap = useMemo(() => {
    const map: Record<string, string> = {};
    contas.forEach(c => {
      if (c.nivel > 1) {
        map[normalizeStr(c.nome)] = c.grupo || 'Outros';
      }
    });
    return map;
  }, [contas]);

  const categoryBlocks = useMemo(() => {
    const map: Record<string, { id: string; valor: number; conta_nome: string; data: string; descricao: string }[]> = {};
    filtered.forEach(e => {
      const catName = e.conta_nome || '';
      const grupo = contaGrupoMap[normalizeStr(catName)] || 'Outros';
      if (!map[grupo]) map[grupo] = [];
      map[grupo].push({ id: e.id, valor: Number(e.valor || 0), conta_nome: catName, data: e.data || '', descricao: e.descricao || '' });
    });
    return Object.entries(map)
      .map(([name, items]) => ({ name, entries: items, total: items.reduce((s, i) => s + i.valor, 0) }))
      .sort((a, b) => a.total - b.total);
  }, [filtered, contaGrupoMap]);

  const totalDespesas = useMemo(() => filtered.reduce((s, e) => s + Number(e.valor || 0), 0), [filtered]);

  const barChartData = useMemo(() => {
    return [...categoryBlocks].map(b => {
      const pctFat = currentRevenue > 0 ? (b.total / currentRevenue) * 100 : 0;
      const label = currentRevenue > 0
        ? `${formatCurrency(b.total)} (${pctFat.toFixed(1)}%)`
        : formatCurrency(b.total);
      return {
        name: b.name,
        value: b.total,
        pctFat,
        label,
      };
    });
  }, [categoryBlocks, currentRevenue]);

  const revenueCompData = useMemo(() => {
    if (currentRevenue <= 0) return [];
    return categoryBlocks.map(b => ({
      name: b.name,
      pct: (b.total / currentRevenue) * 100,
      value: b.total,
      overLimit: (b.total / currentRevenue) * 100 > 30,
    }));
  }, [categoryBlocks, currentRevenue]);

  const handleSaveFaturamento = useCallback(() => {
    if (!activeMes) return;
    const cleaned = faturamentoInput.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    if (isNaN(val) || val <= 0) { toast.error('Valor inválido'); return; }
    saveFaturamento.mutate({ month: activeMes, value: val });
  }, [activeMes, faturamentoInput, saveFaturamento]);

  // Compare current month to previous (total despesas) - only when single month selected
  const prevMonthTotal = useMemo(() => {
    if (isMulti || !activeMes || mesesDisponiveis.length < 2) return null;
    const idx = mesesDisponiveis.indexOf(activeMes);
    if (idx <= 0) return null;
    const prev = mesesDisponiveis[idx - 1];
    return entries.filter(e => e.data?.startsWith(prev)).reduce((s, e) => s + Number(e.valor || 0), 0);
  }, [entries, mesesDisponiveis, activeMes, isMulti]);

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    // Top expense category concentration
    if (categoryBlocks.length > 0 && totalDespesas > 0) {
      const top = [...categoryBlocks].sort((a, b) => b.total - a.total)[0];
      const pct = (top.total / totalDespesas) * 100;
      if (pct > 25) {
        list.push({
          id: 'top-cat',
          tone: pct > 40 ? 'warning' : 'info',
          icon: Flame,
          title: `${top.name} concentra ${pct.toFixed(0)}% das despesas`,
          description: `Total: ${formatCurrency(top.total)} de ${formatCurrency(totalDespesas)}`,
        });
      }
    }

    // Categorias acima de 30% do faturamento
    if (currentRevenue > 0) {
      const overLimit = revenueCompData.filter(d => d.overLimit);
      if (overLimit.length > 0) {
        list.push({
          id: 'over-fat',
          tone: 'danger',
          icon: AlertTriangle,
          title: `${overLimit.length} categoria${overLimit.length > 1 ? 's' : ''} acima de 30% do faturamento`,
          description: overLimit.map(c => `${c.name} (${c.pct.toFixed(0)}%)`).join(' · '),
        });
      }

      const ratio = (totalDespesas / currentRevenue) * 100;
      if (ratio > 90) {
        list.push({
          id: 'comp-tot',
          tone: 'danger',
          icon: Flame,
          title: `Despesas consomem ${ratio.toFixed(0)}% do faturamento`,
          description: 'Margem operacional muito apertada.',
        });
      } else if (ratio < 70) {
        list.push({
          id: 'comp-ok',
          tone: 'success',
          icon: PiggyBank,
          title: `Boa margem: despesas em ${ratio.toFixed(0)}% do faturamento`,
          description: `Sobra estimada: ${formatCurrency(currentRevenue - totalDespesas)}`,
        });
      }
    } else {
      list.push({
        id: 'sem-fat',
        tone: 'neutral',
        icon: Sparkles,
        title: 'Informe o faturamento do mês',
        description: 'Compare gastos com receita para liberar mais insights.',
      });
    }

    // Variação vs mês anterior
    if (prevMonthTotal !== null && prevMonthTotal > 0) {
      const diff = totalDespesas - prevMonthTotal;
      const pct = (diff / prevMonthTotal) * 100;
      if (Math.abs(pct) >= 5) {
        list.push({
          id: 'vs-prev',
          tone: pct > 0 ? 'warning' : 'success',
          icon: pct > 0 ? TrendingUp : TrendingDown,
          title: `Despesas ${pct > 0 ? 'subiram' : 'caíram'} ${Math.abs(pct).toFixed(0)}% vs mês anterior`,
          description: `${formatCurrency(prevMonthTotal)} → ${formatCurrency(totalDespesas)}`,
        });
      }
    }

    // Maior lançamento individual
    if (filtered.length > 0) {
      const biggest = [...filtered].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))[0];
      if (Number(biggest.valor || 0) > 0 && totalDespesas > 0) {
        const pct = (Number(biggest.valor) / totalDespesas) * 100;
        if (pct > 10) {
          list.push({
            id: 'big-entry',
            tone: 'info',
            icon: AlertTriangle,
            title: `Maior despesa: ${formatCurrency(Number(biggest.valor))}`,
            description: `${biggest.conta_nome || biggest.descricao || 'Lançamento'} (${pct.toFixed(0)}% do total)`,
          });
        }
      }
    }

    return list;
  }, [categoryBlocks, totalDespesas, currentRevenue, revenueCompData, prevMonthTotal, filtered]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="py-16 text-center">
          <DollarSign className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Importe dados nas Configurações ou adicione lançamentos manualmente para visualizar o relatório.</p>
          <div className="flex gap-3 justify-center">
            <Button size="sm" className="rounded-xl gap-2 font-medium" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Lançamento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <SingleMonthPicker
          multi
          value={mesFilter === 'all' ? '' : mesFilter}
          onChange={(m) => {
            const v = m || 'all';
            setMesFilter(v);
            const list = m ? m.split(',') : [];
            if (list.length === 1) pushShared(list[0]);
          }}
          availableMonths={mesesDisponiveis}
          allowEmpty
          emptyLabel="Mês atual"
        />
        {isMulti && (
          <span className="text-xs text-muted-foreground">
            Agregando {effectiveMonths.length} meses · faturamento de <strong>{formatMonth(activeMes)}</strong>
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Button
            size="sm"
            className="rounded-xl gap-2 font-medium bg-primary hover:bg-primary/95 text-primary-foreground shrink-0"
            onClick={() => setAddOpen(true)}
            disabled={activeMes ? closedMonths.has(activeMes) : false}
          >
            <Plus className="w-4 h-4" />
            Novo Lançamento
          </Button>

          {!isMulti && activeMes && (
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl gap-2 font-medium shrink-0"
              onClick={() => {
                if (confirm(`Tem certeza que deseja excluir TODOS os lançamentos do mês ${formatMonth(activeMes)}? Esta ação não pode ser desfeita.`)) {
                  deleteEntries.mutate({ month: activeMes });
                }
              }}
              disabled={closedMonths.has(activeMes)}
            >
              <Trash2 className="w-4 h-4" />
              Limpar Mês
            </Button>
          )}
        </div>
      </div>

      {/* Insights */}
      <InsightsBar insights={insights} title="Insights do mês" />

      {activeMes && closedMonths.has(activeMes) && (
        <div className="rounded-xl border border-muted bg-muted/40 px-4 py-3 flex items-center gap-2 text-sm">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Mês fechado.</span>
          <span className="text-muted-foreground">Edição bloqueada — abra Configurações → Fechamento para reabrir (admin).</span>
        </div>
      )}

      {/* Faturamento input */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Faturamento do mês</p>
                  <p className="text-xs text-muted-foreground/70">{activeMes ? formatMonth(activeMes) : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <span className="text-sm font-medium text-muted-foreground">R$</span>
                <Input
                  className="rounded-xl"
                  placeholder="0,00"
                  value={faturamentoInput}
                  onChange={e => { setFaturamentoInput(e.target.value); setEditingFat(true); }}
                  onKeyDown={e => e.key === 'Enter' && handleSaveFaturamento()}
                  disabled={activeMes ? closedMonths.has(activeMes) : false}
                />
                <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleSaveFaturamento} disabled={saveFaturamento.isPending || (activeMes ? closedMonths.has(activeMes) : false)}>
                  <Check className="w-4 h-4" />
                </Button>
              </div>
              {currentRevenue > 0 && !editingFat && (
                <p className="text-lg font-bold text-foreground ml-auto">{formatCurrency(currentRevenue)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Comparativos MoM / YoY / Acumulado anual */}
      {!isMulti && activeMes && (
        <ComparativeMetrics
          activeMonth={activeMes}
          entries={entries.map((e: any) => ({ data: e.data, valor: Number(e.valor || 0) }))}
          revenues={revenues}
        />
      )}

      {/* Despesas por Categoria (valor + % no mesmo rótulo) */}
      {barChartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Despesas por Categoria</h3>
              {currentRevenue > 0 ? (
                <p className="text-xs text-muted-foreground mb-4">
                  Valor absoluto e % do faturamento ({formatCurrency(currentRevenue)}) · barras em vermelho ultrapassam 30%
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">Informe o faturamento para ver o percentual por categoria.</p>
              )}
              <ResponsiveContainer key={JSON.stringify(barChartData)} width="100%" height={Math.max(barChartData.length * 48, 140)}>
                <BarChart data={barChartData} layout="vertical" margin={{ left: 8, right: 200, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.05]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    width={150}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(v: number, name: string, props: any) => {
                      if (name === 'value') {
                        const pct = props?.payload?.pctFat ?? 0;
                        return currentRevenue > 0
                          ? [`${formatCurrency(v)} (${pct.toFixed(1)}%)`, 'Total']
                          : [formatCurrency(v), 'Total'];
                      }
                      return [v, name];
                    }}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                    {barChartData.map((d, i) => (
                      <Cell key={i} fill={currentRevenue > 0 && d.pctFat > 30 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                    ))}
                    <LabelList
                      dataKey="label"
                      position="right"
                      style={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Category drill-down blocks */}
      <div className="space-y-4">
        {[...categoryBlocks].reverse().map((block, i) => (
          <CategoryBlock
            key={block.name}
            name={block.name}
            entries={block.entries}
            totalGeral={totalDespesas}
            faturamento={currentRevenue}
            allMonths={mesesDisponiveis}
            index={i}
            onEditEntry={(entry) => {
              if (entry.data && closedMonths.has(entry.data.slice(0, 7))) {
                toast.error('Mês fechado. Edição bloqueada.');
                return;
              }
              setEditEntry(entry);
              setEditOpen(true);
            }}
            onDeleteEntries={async (params) => {
              if (activeMes && closedMonths.has(activeMes)) {
                toast.error('Mês fechado. Edição bloqueada.');
                return;
              }
              await deleteEntries.mutateAsync(params);
            }}
            activeMonth={!isMulti ? activeMes : undefined}
          />
        ))}
      </div>

      {/* Edit Dialog */}
      <EditEntryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={editEntry}
        contas={contas as any}
        onSave={handleEditSave}
      />

      {/* Add Dialog */}
      <AddEntryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contas={contas as any}
        onSave={async (entry) => {
          await addEntry.mutateAsync(entry);
        }}
      />

      {/* Review Dialog */}
      <ReviewEntriesDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        entries={reviewEntries}
        originalCategoryName={pendingUpdate?.originalCategory || ''}
        newCategoryName={pendingUpdate?.updates.conta_nome || ''}
        contaGrupoMap={contaGrupoMap}
        onConfirm={handleReviewConfirm}
      />
    </div>
  );
}
