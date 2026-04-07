import { useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { CategoryBlock } from './CategoryBlock';
import { DollarSign, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  const [mesFilter, setMesFilter] = useState('all');
  const [faturamentoInput, setFaturamentoInput] = useState('');
  const [editingFat, setEditingFat] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId).order('data');
      if (error) throw error;
      return data;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly_revenue', schoolId] });
      toast.success('Faturamento salvo');
      setEditingFat(false);
    },
  });

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach(e => { const m = e.data?.slice(0, 7); if (m && m.length === 7) meses.add(m); });
    return Array.from(meses).sort();
  }, [entries]);

  // Auto-select latest month
  const activeMes = mesFilter === 'all'
    ? (mesesDisponiveis.length > 0 ? mesesDisponiveis[mesesDisponiveis.length - 1] : '')
    : mesFilter;

  const filtered = useMemo(() => {
    if (mesFilter === 'all') return entries;
    return entries.filter(e => e.data?.startsWith(mesFilter));
  }, [entries, mesFilter]);

  const currentRevenue = useMemo(() => {
    if (!activeMes) return 0;
    return revenues.find(r => r.month === activeMes)?.value || 0;
  }, [revenues, activeMes]);

  // Initialize faturamento input when month changes
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
    const map: Record<string, { valor: number; conta_nome: string; data: string }[]> = {};
    filtered.forEach(e => {
      const catName = e.conta_nome || '';
      const grupo = contaGrupoMap[normalizeStr(catName)] || 'Outros';
      if (!map[grupo]) map[grupo] = [];
      map[grupo].push({ valor: Number(e.valor || 0), conta_nome: catName, data: e.data || '' });
    });
    return Object.entries(map)
      .map(([name, items]) => ({ name, entries: items, total: items.reduce((s, i) => s + i.valor, 0) }))
      .sort((a, b) => a.total - b.total); // menor → maior
  }, [filtered, contaGrupoMap]);

  const totalDespesas = useMemo(() => filtered.reduce((s, e) => s + Number(e.valor || 0), 0), [filtered]);


  // Data for top-level bar chart
  const barChartData = useMemo(() => {
    return [...categoryBlocks].map(b => ({
      name: b.name,
      value: b.total,
      pctFat: currentRevenue > 0 ? (b.total / currentRevenue) * 100 : 0,
    }));
  }, [categoryBlocks, currentRevenue]);

  // Revenue comparison data
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
          <p className="text-sm text-muted-foreground">Importe dados nas Configurações para visualizar o relatório.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Último mês</SelectItem>
            {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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
                />
                <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleSaveFaturamento} disabled={saveFaturamento.isPending}>
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

      {/* Despesas por Categoria Mãe - Horizontal Bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h3>
            <ResponsiveContainer width="100%" height={Math.max(barChartData.length * 44, 120)}>
              <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 60, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={140} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                  {barChartData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--primary))" />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v: number) => formatCurrency(v)} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Despesa x Faturamento */}
      {currentRevenue > 0 && revenueCompData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Despesa × Faturamento</h3>
              <p className="text-xs text-muted-foreground mb-4">% de cada categoria sobre o faturamento ({formatCurrency(currentRevenue)})</p>
              <ResponsiveContainer width="100%" height={Math.max(revenueCompData.length * 44, 120)}>
                <BarChart data={revenueCompData} layout="vertical" margin={{ left: 10, right: 60, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={140} />
                  <Tooltip
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={28}>
                    {revenueCompData.map((d, i) => (
                      <Cell key={i} fill={d.overLimit ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                    ))}
                    <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
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
          />
        ))}
      </div>

    </div>
  );
}
