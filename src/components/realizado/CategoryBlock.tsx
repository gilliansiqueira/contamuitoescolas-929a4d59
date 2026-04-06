import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell, LabelList } from 'recharts';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Entry {
  data: string;
  valor: number;
  conta_nome: string;
}

interface Props {
  name: string;
  entries: Entry[];
  totalGeral: number;
  faturamento: number;
  allMonths: string[];
  index: number;
}

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

export function CategoryBlock({ name, entries, totalGeral, faturamento, allMonths, index }: Props) {
  const [expanded, setExpanded] = useState(false);
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
      .sort((a, b) => a.value - b.value); // menor → maior
  }, [entries]);

  const monthlyData = useMemo(() => {
    return allMonths.map(m => {
      const monthEntries = entries.filter(e => e.data?.startsWith(m));
      return { mes: formatMonth(m), raw: m, valor: monthEntries.reduce((s, e) => s + e.valor, 0) };
    }).filter(d => d.valor > 0);
  }, [entries, allMonths]);

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

    if (monthlyData.length >= 2) {
      const last = monthlyData[monthlyData.length - 1].valor;
      const prev = monthlyData[monthlyData.length - 2].valor;
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
  }, [bySubcat, total, faturamento, monthlyData]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {/* Clickable header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <div>
                <h3 className="font-display font-semibold text-foreground text-sm">{name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
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

          {/* Expanded drill-down */}
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
                  {/* Subcategory horizontal bars */}
                  {bySubcat.length > 0 && (
                    <div className="pt-4">
                      <p className="text-xs text-muted-foreground font-medium mb-3">Categorias Filhas</p>
                      <ResponsiveContainer width="100%" height={Math.max(bySubcat.length * 36, 80)}>
                        <BarChart data={bySubcat} layout="vertical" margin={{ left: 10, right: 70, top: 0, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                          <Tooltip
                            formatter={(v: number) => formatCurrency(v)}
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22} fill="hsl(var(--primary))" opacity={0.8}>
                            <LabelList dataKey="value" position="right" formatter={(v: number) => formatCurrencyShort(v)} style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Monthly evolution line chart */}
                  {monthlyData.length > 1 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-3">Evolução Mensal</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={monthlyData} margin={{ left: 10, right: 10, top: 5, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => formatCurrencyShort(v)} width={60} />
                          <Tooltip
                            formatter={(v: number) => formatCurrency(v)}
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          />
                          <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Variation indicators */}
                      {monthlyData.length >= 2 && (
                        <div className="flex gap-3 mt-2 flex-wrap">
                          {monthlyData.slice(1).map((d, i) => {
                            const prev = monthlyData[i].valor;
                            if (prev === 0) return null;
                            const variation = ((d.valor - prev) / prev) * 100;
                            const isUp = variation > 0;
                            return (
                              <div key={d.mes} className="flex items-center gap-1 text-xs">
                                <span className="text-muted-foreground">{d.mes}:</span>
                                {isUp ? (
                                  <TrendingUp className="w-3 h-3 text-destructive" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-emerald-600" />
                                )}
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
