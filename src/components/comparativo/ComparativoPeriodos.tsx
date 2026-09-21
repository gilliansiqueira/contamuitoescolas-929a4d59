import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight, CalendarRange } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { processLedger } from '@/lib/ledgerEngine';

interface Props {
  schoolId: string;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatShort(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return formatCurrency(v);
}
function labelMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MESES[parseInt(mo) - 1]}/${y?.slice(2) || ''}`;
}
function monthsBetween(start: string, end: string) {
  if (!start || !end || start > end) return [] as string[];
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
function shiftYear(month: string, delta: number) {
  const [y, m] = month.split('-');
  return `${Number(y) + delta}-${m}`;
}
function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function MonthRangePicker({
  label, start, end, options, onChange,
}: {
  label: string;
  start: string;
  end: string;
  options: string[];
  onChange: (start: string, end: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground w-20 shrink-0">{label}</span>
      <select
        value={start}
        onChange={e => onChange(e.target.value, end)}
        className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map(m => <option key={m} value={m}>{labelMonth(m)}</option>)}
      </select>
      <span className="text-xs text-muted-foreground">até</span>
      <select
        value={end}
        onChange={e => onChange(start, e.target.value)}
        className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map(m => <option key={m} value={m}>{labelMonth(m)}</option>)}
      </select>
    </div>
  );
}

function DeltaBadge({ diff, pct, invert }: { diff: number; pct: number | null; invert?: boolean }) {
  const isFlat = Math.abs(diff) < 0.005;
  const isUp = diff > 0;
  const good = invert ? !isUp : isUp;
  const color = isFlat ? 'text-muted-foreground' : good ? 'text-emerald-600' : 'text-destructive';
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {formatCurrency(Math.abs(diff))}
      {pct !== null && <span className="opacity-80">({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>}
    </span>
  );
}

export function ComparativoPeriodos({ schoolId }: Props) {
  const { data: entries = [], isLoading } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  const { data: realized = [] } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { fetchAllRows } = await import('@/lib/fetchAll');
      return fetchAllRows<any>('realized_entries', q => q.eq('school_id', schoolId).order('data'));
    },
    enabled: !!schoolId,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!schoolId,
  });

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { const ym = (e.data || '').slice(0, 7); if (ym) set.add(ym); });
    realized.forEach((e: any) => { const ym = (e.data || '').slice(0, 7); if (ym) set.add(ym); });
    return Array.from(set).sort();
  }, [entries, realized]);

  const defaults = useMemo(() => {
    if (availableMonths.length === 0) {
      const now = new Date();
      const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return { aStart: shiftYear(cur, -1), aEnd: shiftYear(cur, -1), bStart: cur, bEnd: cur };
    }
    const last = availableMonths[availableMonths.length - 1];
    const year = last.slice(0, 4);
    const bStart = `${year}-01`;
    return {
      aStart: shiftYear(bStart, -1),
      aEnd: shiftYear(last, -1),
      bStart: availableMonths.includes(bStart) ? bStart : availableMonths[0],
      bEnd: last,
    };
  }, [availableMonths]);

  const [range, setRange] = useState<{ aStart: string; aEnd: string; bStart: string; bEnd: string } | null>(null);
  const r = range ?? defaults;

  const optionMonths = useMemo(() => {
    const set = new Set(availableMonths);
    availableMonths.forEach(m => { set.add(shiftYear(m, -1)); set.add(shiftYear(m, 1)); });
    return Array.from(set).sort();
  }, [availableMonths]);

  const monthsA = useMemo(() => monthsBetween(r.aStart, r.aEnd), [r]);
  const monthsB = useMemo(() => monthsBetween(r.bStart, r.bEnd), [r]);

  const byMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    entries.forEach(e => {
      const ym = (e.data || '').slice(0, 7);
      if (!ym) return;
      (map[ym] ||= []).push(e);
    });
    return map;
  }, [entries]);

  const aggregate = (months: string[]) => {
    const all = months.flatMap(m => byMonth[m] || []);
    return processLedger(all as any, classifications as any);
  };

  const totA = useMemo(() => aggregate(monthsA), [monthsA, byMonth, classifications]);
  const totB = useMemo(() => aggregate(monthsB), [monthsB, byMonth, classifications]);

  const chartData = useMemo(() => {
    const len = Math.max(monthsA.length, monthsB.length);
    return Array.from({ length: len }, (_, i) => {
      const ma = monthsA[i];
      const mb = monthsB[i];
      const a = ma ? processLedger((byMonth[ma] || []) as any, classifications as any) : null;
      const b = mb ? processLedger((byMonth[mb] || []) as any, classifications as any) : null;
      return {
        pos: mb ? labelMonth(mb) : ma ? labelMonth(ma) : `${i + 1}º`,
        mesA: ma ? labelMonth(ma) : '—',
        mesB: mb ? labelMonth(mb) : '—',
        receitaA: a?.receitas ?? null,
        receitaB: b?.receitas ?? null,
        despesaA: a?.despesas ?? null,
        despesaB: b?.despesas ?? null,
        resultadoA: a ? a.resultado : null,
        resultadoB: b ? b.resultado : null,
      };
    });
  }, [monthsA, monthsB, byMonth, classifications]);

  const contaGrupoMap = useMemo(() => {
    const map: Record<string, string> = {};
    contas.forEach((c: any) => {
      if (c?.nome) map[normalizeStr(c.nome)] = c.grupo || 'Outros';
    });
    return map;
  }, [contas]);

  const categoryRows = useMemo(() => {
    const setA = new Set(monthsA);
    const setB = new Set(monthsB);
    const groups: Record<string, { a: number; b: number; subs: Record<string, { a: number; b: number }> }> = {};
    realized.forEach((e: any) => {
      const ym = (e.data || '').slice(0, 7);
      const inA = setA.has(ym);
      const inB = setB.has(ym);
      if (!inA && !inB) return;
      const sub = e.conta_nome || 'Sem categoria';
      const grupo = contaGrupoMap[normalizeStr(sub)] || 'Outros';
      const g = (groups[grupo] ||= { a: 0, b: 0, subs: {} });
      const s = (g.subs[sub] ||= { a: 0, b: 0 });
      const v = Number(e.valor || 0);
      if (inA) { g.a += v; s.a += v; }
      if (inB) { g.b += v; s.b += v; }
    });
    return Object.entries(groups)
      .map(([name, g]) => ({
        name,
        a: g.a,
        b: g.b,
        diff: g.b - g.a,
        subs: Object.entries(g.subs)
          .map(([sn, s]) => ({ name: sn, a: s.a, b: s.b, diff: s.b - s.a }))
          .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)),
      }))
      .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  }, [realized, monthsA, monthsB, contaGrupoMap]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const totalCatB = categoryRows.reduce((s, c) => s + c.b, 0);

  const cards = [
    { key: 'receita', label: 'Receita', a: totA.receitas, b: totB.receitas, invert: false },
    { key: 'despesa', label: 'Despesa', a: totA.despesas, b: totB.despesas, invert: true },
    { key: 'resultado', label: 'Resultado', a: totA.resultado, b: totB.resultado, invert: false },
    { key: 'caixa', label: 'Saldo de caixa', a: totA.saldoMovimento, b: totB.saldoMovimento, invert: false },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Seleção de períodos */}
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Comparar períodos</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MonthRangePicker
              label="Período A"
              start={r.aStart}
              end={r.aEnd}
              options={optionMonths}
              onChange={(aStart, aEnd) => setRange({ ...r, aStart, aEnd })}
            />
            <MonthRangePicker
              label="Período B"
              start={r.bStart}
              end={r.bEnd}
              options={optionMonths}
              onChange={(bStart, bEnd) => setRange({ ...r, bStart, bEnd })}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => setRange({ ...r, aStart: shiftYear(r.bStart, -1), aEnd: shiftYear(r.bEnd, -1) })}
            >
              Mesmo período do ano anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => {
                const year = r.bEnd.slice(0, 4);
                setRange({
                  aStart: `${Number(year) - 1}-01`, aEnd: `${Number(year) - 1}-12`,
                  bStart: `${year}-01`, bEnd: r.bEnd,
                });
              }}
            >
              Ano completo anterior
            </Button>
            {range && (
              <Button size="sm" variant="ghost" className="rounded-xl text-xs" onClick={() => setRange(null)}>
                Restaurar padrão
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A: {monthsA.length ? `${labelMonth(r.aStart)} – ${labelMonth(r.aEnd)} (${monthsA.length} meses)` : 'período inválido'}
            {' · '}
            B: {monthsB.length ? `${labelMonth(r.bStart)} – ${labelMonth(r.bEnd)} (${monthsB.length} meses)` : 'período inválido'}
          </p>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => {
          const diff = c.b - c.a;
          const pct = Math.abs(c.a) > 0.005 ? (diff / Math.abs(c.a)) * 100 : null;
          return (
            <motion.div key={c.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="rounded-2xl h-full">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <div className="space-y-0.5">
                    <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(c.b)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">Período A: {formatCurrency(c.a)}</p>
                  </div>
                  <DeltaBadge diff={diff} pct={pct} invert={c.invert} />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Gráficos */}
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-6">
          {([
            { title: 'Receita', keyA: 'receitaA', keyB: 'receitaB', color: 'hsl(var(--secondary))' },
            { title: 'Despesa', keyA: 'despesaA', keyB: 'despesaB', color: 'hsl(var(--destructive))' },
            { title: 'Resultado', keyA: 'resultadoA', keyB: 'resultadoB', color: 'hsl(var(--primary))' },
          ] as const).map(cfg => (
            <div key={cfg.title} className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{cfg.title} mês a mês</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ left: 10, right: 10, top: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="pos" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => formatShort(v)} width={70} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    formatter={(v: any, name: any) => [v === null ? '—' : formatCurrency(v), String(name)]}
                    labelFormatter={(_l, payload: any) => {
                      const p = payload?.[0]?.payload;
                      return p ? `${p.mesA} × ${p.mesB}` : '';
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey={cfg.keyA} name="Período A" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey={cfg.keyB} name="Período B" stroke={cfg.color} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Variação por categoria */}
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Variação por categoria</h3>
            <p className="text-xs text-muted-foreground">
              Despesas do Relatório Realizado · clique na categoria para ver as subcategorias
            </p>
          </div>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem lançamentos realizados nos períodos escolhidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Categoria</th>
                    <th className="text-right py-2 px-2 font-medium">Período A</th>
                    <th className="text-right py-2 px-2 font-medium">Período B</th>
                    <th className="text-right py-2 px-2 font-medium">Diferença</th>
                    <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">% do total B</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map(row => {
                    const pct = Math.abs(row.a) > 0.005 ? (row.diff / Math.abs(row.a)) * 100 : null;
                    const open = !!openGroups[row.name];
                    return (
                      <Fragment key={row.name}>
                        <tr
                          className="border-b border-border/30 hover:bg-muted/30 cursor-pointer"
                          onClick={() => setOpenGroups(p => ({ ...p, [row.name]: !p[row.name] }))}
                        >
                          <td className="py-2 px-2 font-semibold text-foreground">
                            <span className="inline-flex items-center gap-1">
                              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {row.name}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{formatCurrency(row.a)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-foreground font-medium">{formatCurrency(row.b)}</td>
                          <td className="py-2 px-2 text-right"><DeltaBadge diff={row.diff} pct={pct} invert /></td>
                          <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                            {totalCatB > 0 ? `${((row.b / totalCatB) * 100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                        {open && row.subs.map(s => {
                          const spct = Math.abs(s.a) > 0.005 ? (s.diff / Math.abs(s.a)) * 100 : null;
                          return (
                            <tr key={`${row.name}-${s.name}`} className="border-b border-border/20 bg-muted/20">
                              <td className="py-1.5 pl-8 pr-2 text-muted-foreground">{s.name}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{formatCurrency(s.a)}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-foreground">{formatCurrency(s.b)}</td>
                              <td className="py-1.5 px-2 text-right"><DeltaBadge diff={s.diff} pct={spct} invert /></td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                                {totalCatB > 0 ? `${((s.b / totalCatB) * 100).toFixed(1)}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
