import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface Entry {
  data: string;
  valor: number;
  conta_nome: string;
}

interface Props {
  name: string;
  entries: Entry[];
  totalGeral: number;
  allMonths: string[];
  index: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(328, 85%, 46%)',
  'hsl(20, 90%, 50%)',
  'hsl(var(--destructive))',
];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonth(m: string) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]}/${y?.slice(2) || ''}`;
}

export function CategoryBlock({ name, entries, totalGeral, allMonths, index }: Props) {
  const total = useMemo(() => entries.reduce((s, e) => s + e.valor, 0), [entries]);
  const pct = totalGeral > 0 ? (total / totalGeral) * 100 : 0;

  // Subcategory breakdown
  const bySubcat = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      const cat = e.conta_nome || 'Sem categoria';
      map[cat] = (map[cat] || 0) + e.valor;
    });
    return Object.entries(map).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value);
  }, [entries]);

  // Monthly evolution
  const monthlyData = useMemo(() => {
    return allMonths.map(m => {
      const monthEntries = entries.filter(e => e.data?.startsWith(m));
      return { mes: formatMonth(m), valor: monthEntries.reduce((s, e) => s + e.valor, 0) };
    }).filter(d => d.valor > 0);
  }, [entries, allMonths]);

  // Insights
  const insights = useMemo(() => {
    const result: { text: string; type: 'up' | 'down' | 'neutral' }[] = [];

    if (bySubcat.length > 0) {
      result.push({ text: `Maior gasto: ${bySubcat[0].name} (${formatCurrency(bySubcat[0].value)})`, type: 'neutral' });
    }

    result.push({ text: `Representa ${pct.toFixed(1)}% do total`, type: 'neutral' });

    if (monthlyData.length >= 2) {
      const last = monthlyData[monthlyData.length - 1].valor;
      const prev = monthlyData[monthlyData.length - 2].valor;
      if (prev > 0) {
        const variation = ((last - prev) / prev) * 100;
        if (Math.abs(variation) > 0.5) {
          result.push({
            text: `${variation > 0 ? 'Aumento' : 'Redução'} de ${Math.abs(variation).toFixed(1)}% em relação ao mês anterior`,
            type: variation > 0 ? 'up' : 'down',
          });
        }
      }
    }

    return result;
  }, [bySubcat, pct, monthlyData]);

  const useBarChart = bySubcat.length > 5;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header / Summary */}
          <div className="p-5 pb-3 flex items-start justify-between">
            <div>
              <h3 className="font-display font-semibold text-foreground">{name}</h3>
              <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(total)}</p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0 mt-1">{pct.toFixed(1)}%</Badge>
          </div>

          {/* Distribution chart */}
          {bySubcat.length > 1 && (
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Distribuição</p>
              <ResponsiveContainer width="100%" height={useBarChart ? Math.min(bySubcat.length * 32, 200) : 180}>
                {useBarChart ? (
                  <BarChart data={bySubcat.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie data={bySubcat} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {bySubcat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
              {!useBarChart && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {bySubcat.slice(0, 5).map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Monthly evolution */}
          {monthlyData.length > 1 && (
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Evolução Mensal</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={monthlyData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div className="px-5 pb-4 space-y-1.5">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {ins.type === 'up' && <TrendingUp className="w-3.5 h-3.5 text-destructive shrink-0" />}
                  {ins.type === 'down' && <TrendingDown className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                  {ins.type === 'neutral' && <Minus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  <span className={ins.type === 'up' ? 'text-destructive' : ins.type === 'down' ? 'text-green-600' : 'text-muted-foreground'}>{ins.text}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
