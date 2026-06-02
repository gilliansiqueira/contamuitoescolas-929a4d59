import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, DollarSign, TrendingDown, Layers } from 'lucide-react';

interface Entry {
  data: string;
  valor: number;
}

interface Revenue {
  month: string;
  value: number;
}

interface Props {
  activeMonth: string; // YYYY-MM
  entries: Entry[];
  revenues: Revenue[];
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonth(m: string) {
  if (!m || m.length < 7) return '—';
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]}/${y?.slice(2) || ''}`;
}

function shiftMonth(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shiftYear(ym: string, deltaYears: number): string {
  const [y, m] = ym.split('-');
  return `${parseInt(y) + deltaYears}-${m}`;
}

function sumEntriesInRange(entries: Entry[], fromYM: string, toYM: string): number {
  return entries.reduce((s, e) => {
    const ym = e.data?.slice(0, 7);
    if (!ym || ym < fromYM || ym > toYM) return s;
    return s + Number(e.valor || 0);
  }, 0);
}

function sumEntriesInMonth(entries: Entry[], ym: string): number {
  return sumEntriesInRange(entries, ym, ym);
}

function sumRevenueInRange(revs: Revenue[], fromYM: string, toYM: string): number {
  return revs.reduce((s, r) => {
    if (!r.month || r.month < fromYM || r.month > toYM) return s;
    return s + Number(r.value || 0);
  }, 0);
}

function Delta({ current, base, invertColors = false }: { current: number; base: number; invertColors?: boolean }) {
  if (base === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const diff = current - base;
  const pct = (diff / Math.abs(base)) * 100;
  const isUp = diff > 0;
  const isFlat = Math.abs(diff) < 0.005;
  // For revenue, up = good; for expenses, up = bad → invertColors
  const goodTone = invertColors ? !isUp : isUp;
  const color = isFlat ? 'text-muted-foreground' : goodTone ? 'text-emerald-600' : 'text-destructive';
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
  const sign = isUp ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {sign}{formatCurrency(diff)} ({sign}{pct.toFixed(1)}%)
    </span>
  );
}

function CompareCard({
  title,
  subtitle,
  current,
  currentLabel,
  mom,
  momLabel,
  yoy,
  yoyLabel,
  icon: Icon,
  invertColors = false,
  accent,
}: {
  title: string;
  subtitle?: string;
  current: number;
  currentLabel: string;
  mom: number | null;
  momLabel: string;
  yoy: number | null;
  yoyLabel: string;
  icon: any;
  invertColors?: boolean;
  accent: string;
}) {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${accent}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{title}</p>
            </div>
            {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-1 ml-9">{subtitle}</p>}
          </div>
        </div>

        <div>
          <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(current)}</p>
          <p className="text-[10px] text-muted-foreground">{currentLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">MoM</p>
            {mom !== null ? (
              <>
                <Delta current={current} base={mom} invertColors={invertColors} />
                <p className="text-[10px] text-muted-foreground tabular-nums">{momLabel}: {formatCurrency(mom)}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dado</p>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">YoY</p>
            {yoy !== null ? (
              <>
                <Delta current={current} base={yoy} invertColors={invertColors} />
                <p className="text-[10px] text-muted-foreground tabular-nums">{yoyLabel}: {formatCurrency(yoy)}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dado</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparativeMetrics({ activeMonth, entries, revenues }: Props) {
  const metrics = useMemo(() => {
    if (!activeMonth || activeMonth.length !== 7) return null;
    const year = activeMonth.slice(0, 4);
    const yearStart = `${year}-01`;

    const prevMonth = shiftMonth(activeMonth, -1);
    const prevYearMonth = shiftYear(activeMonth, -1);
    const prevYear = prevYearMonth.slice(0, 4);
    const prevYearStart = `${prevYear}-01`;
    const prevYearActiveMonth = prevYearMonth; // same month, prev year

    // FATURAMENTO
    const revCurr = sumRevenueInRange(revenues, activeMonth, activeMonth);
    const revPrevM = sumRevenueInRange(revenues, prevMonth, prevMonth);
    const revPrevY = sumRevenueInRange(revenues, prevYearActiveMonth, prevYearActiveMonth);

    // DESPESAS (mês)
    const expCurr = sumEntriesInMonth(entries, activeMonth);
    const expPrevM = sumEntriesInMonth(entries, prevMonth);
    const expPrevY = sumEntriesInMonth(entries, prevYearActiveMonth);

    // ACUMULADO ANO (jan→activeMonth do MESMO ANO)
    const accCurr = sumEntriesInRange(entries, yearStart, activeMonth);
    // MoM acumulado = acumulado até mês anterior (mesmo ano se ainda no mesmo ano, senão null)
    const prevMonthInSameYear = prevMonth.slice(0, 4) === year ? prevMonth : null;
    const accPrevM = prevMonthInSameYear ? sumEntriesInRange(entries, yearStart, prevMonthInSameYear) : null;
    // YoY acumulado = jan→sameMonth do ano anterior
    const accPrevY = sumEntriesInRange(entries, prevYearStart, prevYearActiveMonth);

    // ACUMULADO FATURAMENTO (para reforço — opcional, mas reaproveitamos no acumulado)
    // não usado nos cards atuais, mas útil se quisermos no futuro.

    // Detect "real" zeros (sem dados) vs zeros declarados:
    // Tratamos prev como null somente quando não houver QUALQUER registro naquele mês/ano.
    const hasAnyExpInPrevM = entries.some(e => e.data?.startsWith(prevMonth));
    const hasAnyExpInPrevY = entries.some(e => e.data?.startsWith(prevYearActiveMonth));
    const hasAnyRevInPrevM = revenues.some(r => r.month === prevMonth);
    const hasAnyRevInPrevY = revenues.some(r => r.month === prevYearActiveMonth);
    const hasAnyAccPrevY = entries.some(e => {
      const ym = e.data?.slice(0, 7);
      return ym && ym >= prevYearStart && ym <= prevYearActiveMonth;
    });

    return {
      activeMonth,
      prevMonth,
      prevYearActiveMonth,
      year,
      yearStart,
      faturamento: {
        current: revCurr,
        mom: hasAnyRevInPrevM ? revPrevM : null,
        yoy: hasAnyRevInPrevY ? revPrevY : null,
      },
      despesas: {
        current: expCurr,
        mom: hasAnyExpInPrevM ? expPrevM : null,
        yoy: hasAnyExpInPrevY ? expPrevY : null,
      },
      acumulado: {
        current: accCurr,
        mom: accPrevM,
        yoy: hasAnyAccPrevY ? accPrevY : null,
        prevMonthLabel: prevMonthInSameYear,
      },
    };
  }, [activeMonth, entries, revenues]);

  if (!metrics) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <CompareCard
          title="Faturamento"
          subtitle={formatMonth(metrics.activeMonth)}
          icon={DollarSign}
          accent="bg-primary/10 text-primary"
          current={metrics.faturamento.current}
          currentLabel={`Mês ${formatMonth(metrics.activeMonth)}`}
          mom={metrics.faturamento.mom}
          momLabel={formatMonth(metrics.prevMonth)}
          yoy={metrics.faturamento.yoy}
          yoyLabel={formatMonth(metrics.prevYearActiveMonth)}
          invertColors={false}
        />

        <CompareCard
          title="Despesas totais"
          subtitle={formatMonth(metrics.activeMonth)}
          icon={TrendingDown}
          accent="bg-destructive/10 text-destructive"
          current={metrics.despesas.current}
          currentLabel={`Mês ${formatMonth(metrics.activeMonth)}`}
          mom={metrics.despesas.mom}
          momLabel={formatMonth(metrics.prevMonth)}
          yoy={metrics.despesas.yoy}
          yoyLabel={formatMonth(metrics.prevYearActiveMonth)}
          invertColors={true}
        />

        <CompareCard
          title="Acumulado do ano"
          subtitle={`Jan/${metrics.year.slice(2)} → ${formatMonth(metrics.activeMonth)}`}
          icon={Layers}
          accent="bg-orange-500/10 text-orange-600"
          current={metrics.acumulado.current}
          currentLabel={`Despesas Jan–${formatMonth(metrics.activeMonth).split('/')[0]}/${metrics.year}`}
          mom={metrics.acumulado.mom}
          momLabel={metrics.acumulado.prevMonthLabel ? `Jan→${formatMonth(metrics.acumulado.prevMonthLabel)}` : '—'}
          yoy={metrics.acumulado.yoy}
          yoyLabel={`Jan–${formatMonth(metrics.prevYearActiveMonth).split('/')[0]}/${metrics.prevYearActiveMonth.slice(0, 4)}`}
          invertColors={true}
        />
      </div>
    </motion.div>
  );
}
