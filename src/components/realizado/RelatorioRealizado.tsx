import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { CategoryBlock } from './CategoryBlock';

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
  const [mesFilter, setMesFilter] = useState('all');

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

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach(e => { const m = e.data?.slice(0, 7); if (m && m.length === 7) meses.add(m); });
    return Array.from(meses).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (mesFilter === 'all') return entries;
    return entries.filter(e => e.data?.startsWith(mesFilter));
  }, [entries, mesFilter]);

  const totalDespesas = useMemo(() => filtered.reduce((s, e) => s + Number(e.valor || 0), 0), [filtered]);

  // Build lookup: normalized conta_nome -> grupo
  const contaGrupoMap = useMemo(() => {
    const map: Record<string, string> = {};
    contas.forEach(c => {
      if (c.nivel > 1) {
        map[normalizeStr(c.nome)] = c.grupo || 'Outros';
      }
    });
    return map;
  }, [contas]);

  // Group entries by categoria mãe
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
      .sort((a, b) => b.total - a.total);
  }, [filtered, contaGrupoMap]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <TrendingDown className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Importe dados nas Configurações para visualizar o relatório.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter + KPI */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{filtered.length} lançamentos</Badge>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-destructive/10">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Despesas</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totalDespesas)}</p>
            </div>
            {categoryBlocks.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Maior categoria</p>
                <p className="text-sm font-semibold">{categoryBlocks[0].name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(categoryBlocks[0].total)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Category blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categoryBlocks.map((block, i) => (
          <CategoryBlock
            key={block.name}
            name={block.name}
            entries={block.entries}
            totalGeral={totalDespesas}
            allMonths={mesesDisponiveis}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
