import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFinancialMonthStatuses } from '@/hooks/useFinancialMonthStatus';
import { useResultBasis, useResultadoMensal } from '@/hooks/useResultadoBase';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))'];
const cur = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number | null) => v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const compact = (v: number) => Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : `R$ ${v.toFixed(0)}`;

interface Mes { receita: number; resultado: number; socios: number; estimado: boolean }

export function MargemSemSociosCard({ schoolId, referenceMonth }: { schoolId: string; referenceMonth?: string }) {
  const [modo, setModo] = useState<'pct' | 'valor'>('pct');
  const [basis] = useResultBasis(schoolId);
  const { meses: base } = useResultadoMensal(schoolId, basis);
  const { data: statuses = [] } = useFinancialMonthStatuses(schoolId);

  const r = useMemo(() => {
    const review = new Set(statuses.filter((s: any) => s.status === 'review').map((s: any) => s.month));
    const meses = base as Map<string, Mes>;

    const available = Array.from(meses.keys()).filter(m => !review.has(m)).sort();
    const ref = available.filter(m => !referenceMonth || m <= referenceMonth).at(-1) || '';
    const throughMonth = ref ? Number(ref.slice(5, 7)) : 12;
    const years = Array.from(new Set(available.map(m => m.slice(0, 4)))).filter(y => !ref || y <= ref.slice(0, 4)).sort();
    const val = (m: string, mode: 'pct' | 'valor') => {
      const a = meses.get(m); if (!a || review.has(m)) return null;
      const v = a.resultado + a.socios;
      return mode === 'valor' ? v : a.receita > 0 ? (v / a.receita) * 100 : null;
    };
    const summaries = years.map(y => {
      let rec = 0, v = 0;
      for (let i = 1; i <= throughMonth; i++) { const a = meses.get(`${y}-${String(i).padStart(2, '0')}`); if (a && !review.has(`${y}-${String(i).padStart(2, '0')}`)) { rec += a.receita; v += a.resultado + a.socios; } }
      return { year: y, valor: v, pct: rec > 0 ? (v / rec) * 100 : null };
    });
    return { meses, ref, throughMonth, years, val, summaries };
  }, [base, statuses, referenceMonth]);

  if (!r.ref || r.years.length === 0) return null;
  const a = r.meses.get(r.ref)!;
  const margemNormal = a.receita > 0 ? (a.resultado / a.receita) * 100 : null;
  const chart = MONTHS.map((label, i) => {
    const row: Record<string, any> = { month: label };
    r.years.forEach(y => { row[y] = i + 1 <= r.throughMonth ? r.val(`${y}-${String(i + 1).padStart(2, '0')}`, modo) : null; });
    return row;
  });

  return (
    <Card>
      <CardContent className="p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8">
          <div className="lg:border-r lg:border-border/60 lg:pr-8">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
              <div>
                <h3 className="text-sm font-semibold">Margem líquida sem sócios ({basis === 'caixa' ? 'caixa' : 'competência'})</h3>
                <p className="text-xs text-muted-foreground">Sem pró-labore, bônus e distribuição de lucro</p>
              </div>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase text-muted-foreground">{MONTHS[Number(r.ref.slice(5, 7)) - 1]}/{r.ref.slice(0, 4)}{a.estimado ? ' · estimado' : ''}</p>
            <p className={`mt-1 text-2xl font-extrabold ${r.val(r.ref, 'valor')! < 0 ? 'text-destructive' : 'text-success'}`}>{pct(r.val(r.ref, 'pct'))}</p>
            <p className="text-sm font-semibold">{cur(r.val(r.ref, 'valor'))}</p>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Margem líquida normal</span><span>{pct(margemNormal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pago aos sócios</span><span>{cur(a.socios)}</span></div>
            </div>
            <div className="mt-4 border-t border-border/60 pt-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Acumulado por ano</p>
              <div className="mt-2 space-y-2">
                {r.summaries.map((s, i) => (
                  <div key={s.year} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{s.year}</span>
                    <span className="text-right"><strong>{cur(s.valor)}</strong> · {pct(s.pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Mês a mês por ano</h4>
              <div className="flex gap-1">
                <Button size="sm" variant={modo === 'pct' ? 'default' : 'outline'} className="h-7 px-3 text-xs" onClick={() => setModo('pct')}>%</Button>
                <Button size="sm" variant={modo === 'valor' ? 'default' : 'outline'} className="h-7 px-3 text-xs" onClick={() => setModo('valor')}>R$</Button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={chart} margin={{ top: 18, right: 14, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => modo === 'pct' ? `${v}%` : compact(v)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={76} />
                <Tooltip formatter={(v: number, n: string) => [modo === 'pct' ? pct(v) : cur(v), n]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                {r.years.map((y, i) => <Line key={y} type="monotone" dataKey={y} name={y} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 5 }} connectNulls={false} />)}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 text-[10px] text-muted-foreground">
              {r.years.map((y, i) => <span key={y} className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{y}</span>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
