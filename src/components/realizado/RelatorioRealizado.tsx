import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(328, 85%, 46%)',
  'hsl(20, 90%, 50%)',
];

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
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId).order('codigo');
      if (error) throw error;
      return data;
    },
  });

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach(e => {
      const m = e.data?.slice(0, 7);
      if (m) meses.add(m);
    });
    return Array.from(meses).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (mesFilter === 'all') return entries;
    return entries.filter(e => e.data?.startsWith(mesFilter));
  }, [entries, mesFilter]);

  const totals = useMemo(() => {
    const receitas = filtered.filter(e => e.tipo === 'receita').reduce((s, e) => s + Number(e.valor), 0);
    const despesas = filtered.filter(e => e.tipo === 'despesa').reduce((s, e) => s + Number(e.valor), 0);
    return { receitas, despesas, resultado: receitas - despesas };
  }, [filtered]);

  const byGroup = useMemo(() => {
    const groups: Record<string, { receitas: number; despesas: number }> = {};
    filtered.forEach(e => {
      const conta = contas.find(c => c.codigo === e.conta_codigo);
      const grupo = conta?.grupo || 'Sem Grupo';
      if (!groups[grupo]) groups[grupo] = { receitas: 0, despesas: 0 };
      if (e.tipo === 'receita') groups[grupo].receitas += Number(e.valor);
      else groups[grupo].despesas += Number(e.valor);
    });
    return Object.entries(groups).map(([name, vals]) => ({ name, ...vals }));
  }, [filtered, contas]);

  const byConta = useMemo(() => {
    const map: Record<string, { nome: string; tipo: string; total: number }> = {};
    filtered.forEach(e => {
      const key = e.conta_codigo || 'sem-conta';
      if (!map[key]) map[key] = { nome: e.conta_nome || e.conta_codigo || 'Sem conta', tipo: e.tipo, total: 0 };
      map[key].total += Number(e.valor);
    });
    return Object.entries(map)
      .map(([codigo, v]) => ({ codigo, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const pieData = useMemo(() => {
    return byConta.filter(c => c.tipo === 'despesa').slice(0, 8).map(c => ({ name: c.nome || c.codigo, value: c.total }));
  }, [byConta]);

  const formatMonth = (m: string) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const [y, mo] = m.split('-');
    return `${months[parseInt(mo) - 1]}/${y.slice(2)}`;
  };

  if (isLoading) return <p className="text-muted-foreground text-center py-8">Carregando relatório...</p>;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {mesesDisponiveis.map(m => (
              <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} lançamentos</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totals.receitas)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totals.despesas)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totals.resultado >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <DollarSign className={`w-5 h-5 ${totals.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resultado</p>
                <p className={`text-lg font-bold ${totals.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.resultado)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byGroup.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Receitas vs Despesas por Grupo</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byGroup}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="receitas" fill="hsl(142, 76%, 36%)" name="Receitas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Composição de Despesas</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table by conta */}
      {byConta.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Detalhamento por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byConta.map(c => (
                  <TableRow key={c.codigo}>
                    <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                    <TableCell className="text-sm">{c.nome}</TableCell>
                    <TableCell><Badge variant={c.tipo === 'receita' ? 'default' : 'destructive'} className="text-xs">{c.tipo}</Badge></TableCell>
                    <TableCell className={`text-right font-medium ${c.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(c.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum lançamento realizado encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Importe dados na aba "Importação".</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
