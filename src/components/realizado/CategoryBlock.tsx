import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, LabelList, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Entry {
  id?: string;
  data: string;
  valor: number;
  conta_nome: string;
  descricao?: string;
}

interface Props {
  name: string;
  entries: Entry[];
  totalGeral: number;
  faturamento: number;
  allMonths: string[];
  index: number;
  onEditEntry?: (entry: Entry) => void;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(25 95% 53%)',
  'hsl(var(--destructive))',
  'hsl(210 40% 60%)',
  'hsl(150 40% 50%)',
  'hsl(280 40% 55%)',
  'hsl(40 70% 50%)',
  'hsl(190 60% 45%)',
];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCurrencyShort(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatCurrency(v);
}

function formatMonth(m: string) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]}/${y?.slice(2) || ''}`;
}

export function CategoryBlock({ name, entries, totalGeral, faturamento, allMonths, index, onEditEntry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const total = useMemo(() => entries.reduce((s, e) => s + e.valor, 0), [entries]);
  const pct = totalGeral > 0 ? (total / totalGeral) * 100 : 0;

  const bySubcat = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      const cat = e.conta_nome || 'Sem categoria';
      map[cat] = (map[cat] || 0) + e.valor;
    });
    return Object.entries(map)
      .map(([n, v]) => ({ name: n, value: v }))
      .sort((a, b) => a.value - b.value);
  }, [entries]);

  const usePie = bySubcat.length <= 5;

  const monthlyData = useMemo(() => {
    const byYearMonth: Record<string, Record<string, number>> = {};
    entries.forEach(e => {
      const m = e.data?.slice(0, 7);
      if (!m) return;
      const year = m.slice(0, 4);
      const mm = m.slice(5, 7);
      if (!byYearMonth[year]) byYearMonth[year] = {};
      byYearMonth[year][mm] = (byYearMonth[year][mm] || 0) + e.valor;
    });

    const years = Object.keys(byYearMonth).sort();
    const allMM = new Set<string>();
    years.forEach(y => Object.keys(byYearMonth[y]).forEach(mm => allMM.add(mm)));
    const sortedMM = Array.from(allMM).sort();

    return sortedMM.map(mm => {
      const point: Record<string, any> = {
        mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mm) - 1] || mm,
      };
      years.forEach(y => { point[y] = byYearMonth[y]?.[mm] || 0; });
      return point;
    });
  }, [entries]);

  const yearKeys = useMemo(() => {
    const years = new Set<string>();
    entries.forEach(e => { const y = e.data?.slice(0, 4); if (y) years.add(y); });
    return Array.from(years).sort();
  }, [entries]);

  const insights = useMemo(() => {
    const result: { text: string; type: 'up' | 'down' | 'neutral' }[] = [];
    if (bySubcat.length > 0) {
      const biggest = bySubcat[bySubcat.length - 1];
      result.push({ text: `Maior gasto: ${biggest.name} (${formatCurrency(biggest.value)})`, type: 'neutral' });
    }
    if (faturamento > 0) {
      const pctFat = (total / faturamento) * 100;
      result.push({ text: `${pctFat.toFixed(1)}% do faturamento`, type: pctFat > 30 ? 'up' : 'neutral' });
    }
    const monthTotals = allMonths.map(m => entries.filter(e => e.data?.startsWith(m)).reduce((s, e) => s + e.valor, 0));
    if (monthTotals.length >= 2) {
      const last = monthTotals[monthTotals.length - 1];
      const prev = monthTotals[monthTotals.length - 2];
      if (prev > 0) {
        const variation = ((last - prev) / prev) * 100;
        if (Math.abs(variation) > 0.5) {
          result.push({
            text: `${variation > 0 ? 'Aumento' : 'Redução'} de ${Math.abs(variation).toFixed(1)}% vs mês anterior`,
            type: variation > 0 ? 'up' : 'down',
          });
        }
      }
    }
    return result;
  }, [bySubcat, total, faturamento, allMonths, entries]);

  const YEAR_COLORS = ['hsl(var(--primary))', 'hsl(25 95% 53%)', 'hsl(var(--destructive))', 'hsl(210 40% 60%)'];

  // Sort entries for display
  const sortedEntries = useMemo(() =>
    [...entries].sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    [entries]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <div>
                <h3 className="font-display font-semibold text-foreground text-sm">{name}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {insights.slice(0, 2).map((ins, i) => (
                    <span key={i} className={`text-xs ${ins.type === 'up' ? 'text-destructive' : ins.type === 'down' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {ins.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="outline" className="text-xs rounded-lg">{pct.toFixed(1)}%</Badge>
              <p className="text-xl font-bold text-foreground">{formatCurrency(total)}</p>
            </div>
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-5 pb-5 space-y-5">
                  {/* Subcategory chart */}
                  {bySubcat.length > 0 && (
                    <div className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-muted-foreground font-medium">Categorias Filhas</p>
                        <p className="text-xs font-semibold text-foreground">Total: {formatCurrency(total)}</p>
                      </div>
                      {usePie ? (
                        <div className="flex items-center gap-6">
                          <ResponsiveContainer width="50%" height={180}>
                            <PieChart>
                              <Pie data={bySubcat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                                {bySubcat.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-1.5 flex-1">
                            {bySubcat.map((s, i) => (
                              <div key={s.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                  <span className="text-muted-foreground truncate max-w-[140px]">{s.name}</span>
                                </div>
                                <span className="font-medium text-foreground">{formatCurrency(s.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={Math.max(bySubcat.length * 36, 80)}>
                          <BarChart data={bySubcat} layout="vertical" margin={{ left: 10, right: 70, top: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22} fill="hsl(var(--primary))" opacity={0.8}>
                              <LabelList dataKey="value" position="right" formatter={(v: number) => formatCurrencyShort(v)} style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  )}

                  {/* Monthly evolution line chart */}
                  {monthlyData.length > 1 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-3">Evolução Mensal</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={monthlyData} margin={{ left: 10, right: 10, top: 5, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => formatCurrencyShort(v)} width={60} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                          {yearKeys.map((y, i) => (
                            <Line key={y} type="monotone" dataKey={y} name={y} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={2.5} dot={{ r: 4, fill: YEAR_COLORS[i % YEAR_COLORS.length] }}>
                              <LabelList dataKey={y} position="top" formatter={(v: number) => v > 0 ? formatCurrencyShort(v) : ''} style={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                            </Line>
                          ))}
                        </LineChart>
                      </ResponsiveContainer>

                      {/* MoM variation indicators */}
                      {allMonths.length >= 2 && (
                        <div className="flex gap-3 mt-2 flex-wrap">
                          {allMonths.slice(1).map((m, i) => {
                            const prev = entries.filter(e => e.data?.startsWith(allMonths[i])).reduce((s, e) => s + e.valor, 0);
                            const curr = entries.filter(e => e.data?.startsWith(m)).reduce((s, e) => s + e.valor, 0);
                            if (prev === 0 || curr === 0) return null;
                            const variation = ((curr - prev) / prev) * 100;
                            const isUp = variation > 0;
                            return (
                              <div key={m} className="flex items-center gap-1 text-xs">
                                <span className="text-muted-foreground">{formatMonth(m)}:</span>
                                {isUp ? <TrendingUp className="w-3 h-3 text-destructive" /> : <TrendingDown className="w-3 h-3 text-green-600" />}
                                <span className={isUp ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}>
                                  {isUp ? '+' : ''}{variation.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Insights */}
                  {insights.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {insights.map((ins, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {ins.type === 'up' && <TrendingUp className="w-3.5 h-3.5 text-destructive shrink-0" />}
                          {ins.type === 'down' && <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          {ins.type === 'neutral' && <Minus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className={ins.type === 'up' ? 'text-destructive' : ins.type === 'down' ? 'text-emerald-600' : 'text-muted-foreground'}>
                            {ins.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Entry list with edit */}
                  {onEditEntry && (
                    <div className="pt-2">
                      <button
                        onClick={() => setShowEntries(!showEntries)}
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        {showEntries ? 'Ocultar lançamentos' : `Ver lançamentos (${entries.length})`}
                      </button>
                      <AnimatePresence>
                        {showEntries && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 max-h-64 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-1 px-1 font-medium">Data</th>
                                    <th className="text-left py-1 px-1 font-medium">Descrição</th>
                                    <th className="text-left py-1 px-1 font-medium">Categoria</th>
                                    <th className="text-right py-1 px-1 font-medium">Valor</th>
                                    <th className="w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedEntries.map(e => (
                                    <tr key={e.id || `${e.data}-${e.valor}`} className="border-b border-border/20 hover:bg-muted/30">
                                      <td className="py-1.5 px-1 text-muted-foreground">{e.data}</td>
                                      <td className="py-1.5 px-1 truncate max-w-[150px]">{e.descricao || '—'}</td>
                                      <td className="py-1.5 px-1 text-muted-foreground truncate max-w-[100px]">{e.conta_nome}</td>
                                      <td className="py-1.5 px-1 text-right font-medium">{formatCurrency(e.valor)}</td>
                                      <td className="py-1.5 px-1">
                                        {e.id && (
                                          <button
                                            onClick={() => onEditEntry(e)}
                                            className="text-muted-foreground hover:text-primary transition-colors"
                                            title="Editar"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
