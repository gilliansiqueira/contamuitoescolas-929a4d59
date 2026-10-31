import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Minus, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { useFinancialMonthStatuses } from '@/hooks/useFinancialMonthStatus';
import { useResultBasis, useResultadoMensal } from '@/hooks/useResultadoBase';

interface Props {
  schoolId: string;
  referenceMonth?: string;
}

interface HistoricalRow {
  month: string;
  tipo_valor: string;
  valor: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const YEAR_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

function currency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function compactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export function ResultadoAnualCard({ schoolId, referenceMonth }: Props) {
  const [basis] = useResultBasis(schoolId);
  const { meses, isLoading: entriesLoading } = useResultadoMensal(schoolId, basis);
  const classificationsLoading = false;
  const historicalLoading = false;
  const { data: monthStatuses = [], isLoading: statusesLoading } = useFinancialMonthStatuses(schoolId);

  const result = useMemo(() => {
    const reviewMonths = new Set(monthStatuses.filter(status => status.status === 'review').map(status => status.month));
    const monthly = new Map<string, number>();
    meses.forEach((a, m) => monthly.set(m, a.resultado));

    const availableMonths = Array.from(monthly.keys()).sort();
    const effectiveReference = referenceMonth || availableMonths.at(-1) || '';
    const latestYear = effectiveReference.slice(0, 4);
    const throughMonth = effectiveReference ? Number(effectiveReference.slice(5, 7)) : 12;
    const years = Array.from(new Set(availableMonths.map(month => month.slice(0, 4))))
      .filter(year => !latestYear || year <= latestYear)
      .sort();

    const chartRows = MONTHS.map((month, index) => {
      const monthNumber = index + 1;
      const row: Record<string, string | number | null> = { month };
      years.forEach(year => {
        const key = `${year}-${String(monthNumber).padStart(2, '0')}`;
        row[year] = monthNumber <= throughMonth && !reviewMonths.has(key) ? monthly.get(key) ?? null : null;
      });
      return row;
    });

    const summaries = years.map(year => {
      let total = 0;
      for (let month = 1; month <= throughMonth; month += 1) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (!reviewMonths.has(key)) total += monthly.get(key) ?? 0;
      }
      return { year, total, inReview: Array.from(reviewMonths).some(key => key.startsWith(`${year}-`) && Number(key.slice(5, 7)) <= throughMonth) };
    });

    return { years, throughMonth, chartRows, summaries, current: reviewMonths.has(effectiveReference) ? null : monthly.get(effectiveReference) ?? null, currentInReview: reviewMonths.has(effectiveReference) };
  }, [meses, referenceMonth, monthStatuses]);

  if (entriesLoading || classificationsLoading || historicalLoading || statusesLoading || result.years.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8">
          <div className="flex flex-col justify-center lg:border-r lg:border-border/60 lg:pr-8">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><TrendingUp className="h-5 w-5" /></div>
              <div>
                <h3 className="text-sm font-semibold">Resultado ({basis === 'caixa' ? 'caixa' : 'competência'})</h3>
                <p className="text-xs text-muted-foreground">{basis === 'caixa' ? 'Dinheiro que entrou menos o que saiu no mês' : 'Receitas menos despesas dos passeios e da operação no mês em que aconteceram'}</p>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Mês de referência</p>
              <p className={`mt-1 text-2xl font-extrabold ${result.current != null && result.current < 0 ? 'text-destructive' : 'text-success'}`}>
                 {result.currentInReview ? 'Em revisão' : result.current == null ? '—' : currency(result.current)}
              </p>
            </div>
            <div className="mt-5 border-t border-border/60 pt-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Acumulado por ano</p>
              <div className="mt-3 space-y-2.5">
                {result.summaries.map((item, index) => {
                  const previous = result.summaries[index - 1]?.total;
                  const relative = previous != null && previous !== 0 ? item.total / Math.abs(previous) - Math.sign(previous) : null;
                  return (
                    <div key={item.year} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }} />
                       <div><span className="text-muted-foreground">{item.year}</span><p className="font-bold text-foreground">{item.inReview ? 'Em revisão' : currency(item.total)}</p></div>
                      {relative == null ? <Minus className="h-3.5 w-3.5 text-muted-foreground" /> : (
                        <span className={`flex items-center gap-0.5 font-semibold ${relative >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {relative >= 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                          {Math.abs(relative).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2">
              <h4 className="text-sm font-semibold">Resultado mensal por ano</h4>
              <p className="text-xs text-muted-foreground">Comparação de janeiro a {MONTHS[result.throughMonth - 1].toLowerCase()}</p>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={result.chartRows} margin={{ top: 18, right: 14, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={76} />
                <Tooltip formatter={(value: number, name: string) => [currency(value), name]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                {result.years.map((year, index) => (
                  <Line key={year} type="monotone" dataKey={year} name={year} stroke={YEAR_COLORS[index % YEAR_COLORS.length]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: YEAR_COLORS[index % YEAR_COLORS.length] }} activeDot={{ r: 5 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {result.years.map((year, index) => <div key={year} className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="h-0.5 w-3 rounded" style={{ backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }} />{year}</div>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}