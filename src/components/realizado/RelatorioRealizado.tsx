import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { TrendingDown, BarChart3 } from 'lucide-react';
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
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data;
    },
  });

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach(e => { const m = e.data?.slice(0, 7); if (m) meses.add(m); });
    return Array.from(meses).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (mesFilter === 'all') return entries;
    return entries.filter(e => e.data?.startsWith(mesFilter));
  }, [entries, mesFilter]);

  const totalDespesas = useMemo(() => filtered.reduce((s, e) => s + Number(e.valor), 0), [filtered]);

  // Group entries by categoria mãe
  const byCategoriaMae = useMemo(() => {
    const map: Record<string, { total: number; filhas: Record<string, number> }> = {};
    filtered.forEach(e => {
      const catNome = e.conta_nome || 'Sem categoria';
      // Find the parent group from chart_of_accounts
      const conta = contas.find(c => c.nome.toLowerCase() === catNome.toLowerCase() && c.nivel > 1);
      const grupo = conta?.grupo || 'Outros';

      if (!map[grupo]) map[grupo] = { total: 0, filhas: {} };
      map[grupo].total += Number(e.valor);
      map[grupo].filhas[catNome] = (map[grupo].filhas[catNome] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, total: v.total, filhas: Object.entries(v.filhas).map(([f, t]) => ({ name: f, total: t })).sort((a, b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, contas]);

  const pieData = useMemo(() => byCategoriaMae.slice(0, 8).map(c => ({ name: c.name, value: c.total })), [byCategoriaMae]);

  // Monthly comparison data
  const monthlyByGroup = useMemo(() => {
    if (mesesDisponiveis.length < 2) return [];
    const groupSet = new Set(byCategoriaMae.map(c => c.name));
    return mesesDisponiveis.map(m => {
      const monthEntries = entries.filter(e => e.data?.startsWith(m));
      const row: Record<string, any> = { mes: formatMonth(m) };
      groupSet.forEach(g => {
        const conta = contas.filter(c => c.grupo === g && c.nivel > 1).map(c => c.nome.toLowerCase());
        row[g] = monthEntries.filter(e => {
          const catNome = (e.conta_nome || '').toLowerCase();
          return conta.includes(catNome) || (contas.find(c => c.nome.toLowerCase() === catNome)?.grupo === g);
        }).reduce((s, e) => s + Number(e.valor), 0);
      });
      return row;
    });
  }, [mesesDisponiveis, entries, contas, byCategoriaMae]);

  // Month-over-month variation
  const variations = useMemo(() => {
    if (mesesDisponiveis.length < 2 || mesFilter !== 'all') return [];
    return byCategoriaMae.map(cat => {
      const lastMonth = mesesDisponiveis[mesesDisponiveis.length - 1];
      const prevMonth = mesesDisponiveis[mesesDisponiveis.length - 2];
      const lastVal = entries.filter(e => e.data?.startsWith(lastMonth)).filter(e => {
        const conta = contas.find(c => c.nome.toLowerCase() === (e.conta_nome || '').toLowerCase());
        return conta?.grupo === cat.name || (!conta && cat.name === 'Outros');
      }).reduce((s, e) => s + Number(e.valor), 0);
      const prevVal = entries.filter(e => e.data?.startsWith(prevMonth)).filter(e => {
        const conta = contas.find(c => c.nome.toLowerCase() === (e.conta_nome || '').toLowerCase());
        return conta?.grupo === cat.name || (!conta && cat.name === 'Outros');
      }).reduce((s, e) => s + Number(e.valor), 0);
      const variacao = prevVal > 0 ? ((lastVal - prevVal) / prevVal) * 100 : 0;
      return { name: cat.name, atual: lastVal, anterior: prevVal, variacao };
    }).filter(v => v.atual > 0 || v.anterior > 0);
  }, [mesesDisponiveis, entries, contas, byCategoriaMae, mesFilter]);

  if (isLoading) return <p className="text-muted-foreground text-center py-8">Carregando relatório...</p>;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} lançamentos</Badge>
      </div>

      {/* KPI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="w-5 h-5 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Despesas</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(totalDespesas)}</p>
            </div>
            {byCategoriaMae.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Maior categoria</p>
                <p className="text-sm font-semibold">{byCategoriaMae[0].name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(byCategoriaMae[0].total)} ({totalDespesas > 0 ? ((byCategoriaMae[0].total / totalDespesas) * 100).toFixed(1) : 0}%)</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byCategoriaMae.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Despesas por Categoria Mãe</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byCategoriaMae} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" radius={[0, 4, 4, 0]} />
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
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly comparison line chart */}
      {monthlyByGroup.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Comparativo Mensal por Categoria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyByGroup}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                {byCategoriaMae.slice(0, 5).map((cat, i) => (
                  <Line key={cat.name} type="monotone" dataKey={cat.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Variations table */}
      {variations.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Variação Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">{formatMonth(mesesDisponiveis[mesesDisponiveis.length - 2])}</TableHead>
                  <TableHead className="text-right">{formatMonth(mesesDisponiveis[mesesDisponiveis.length - 1])}</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variations.map(v => (
                  <TableRow key={v.name}>
                    <TableCell className="text-sm font-medium">{v.name}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(v.anterior)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(v.atual)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${v.variacao > 0 ? 'text-destructive' : v.variacao < 0 ? 'text-green-600' : ''}`}>
                      {v.variacao > 0 ? '+' : ''}{v.variacao.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail by category */}
      {byCategoriaMae.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhamento por Categoria</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {byCategoriaMae.map(cat => (
              <div key={cat.name} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{cat.name}</span>
                  <span className="text-sm font-bold">{formatCurrency(cat.total)}</span>
                </div>
                {cat.filhas.length > 0 && (
                  <div className="space-y-1">
                    {cat.filhas.map(f => (
                      <div key={f.name} className="flex items-center justify-between pl-4">
                        <span className="text-xs text-muted-foreground">{f.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${cat.total > 0 ? (f.total / cat.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs font-medium w-20 text-right">{formatCurrency(f.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum lançamento encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Importe dados na aba "Importação".</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatMonth(m: string) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]}/${y.slice(2)}`;
}
