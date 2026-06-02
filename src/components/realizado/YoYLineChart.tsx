import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Entry {
  data: string;
  valor: number;
}

interface Props {
  title?: string;
  activeMonth: string; // YYYY-MM — defines o "ano atual"
  entries: Entry[];    // entradas de todos os anos
  /** true: subir = ruim (despesas). false: subir = bom (faturamento). */
  invertColors?: boolean;
  height?: number;
  compact?: boolean;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatShort(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatCurrency(v);
}

export function YoYLineChart({
  title,
  activeMonth,
  entries,
  invertColors = true,
  height = 220,
  compact = false,
}: Props) {
  const data = useMemo(() => {
    if (!activeMonth || activeMonth.length !== 7) return null;
    const year = parseInt(activeMonth.slice(0, 4));
    const prevYear = year - 1;
    const activeMonthIdx = parseInt(activeMonth.slice(5, 7)); // 1-12

    const bucket: Record<string, number> = {};
    const has: Record<string, boolean> = {};
    entries.forEach(e => {
      const ym = e.data?.slice(0, 7);
      if (!ym) return;
      bucket[ym] = (bucket[ym] || 0) + Number(e.valor || 0);
      has[ym] = true;
    });

    const points = MONTHS.map((label, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const curYM = `${year}-${mm}`;
      const prevYM = `${prevYear}-${mm}`;
      // Não projetar valores futuros do ano atual
      const curVal = i + 1 > activeMonthIdx ? null : (has[curYM] ? bucket[curYM] || 0 : null);
      const prevVal = has[prevYM] ? bucket[prevYM] || 0 : null;
      return {
        mes: label,
        [year]: curVal,
        [prevYear]: prevVal,
        _cur: curVal,
        _prev: prevVal,
      } as Record<string, any>;
    });

    let accCur = 0;
    let accPrev = 0;
    for (let i = 1; i <= activeMonthIdx; i++) {
      const mm = String(i).padStart(2, '0');
      accCur += bucket[`${year}-${mm}`] || 0;
      accPrev += bucket[`${prevYear}-${mm}`] || 0;
    }

    const hasPrevYearData = Object.keys(has).some(k => k.startsWith(`${prevYear}-`));

    return { points, year, prevYear, accCur, accPrev, hasPrevYearData };
  }, [activeMonth, entries]);

  if (!data) return null;
  const { points, year, prevYear, accCur, accPrev, hasPrevYearData } = data;

  const delta = accPrev > 0 ? ((accCur - accPrev) / accPrev) * 100 : null;
  const isUp = delta !== null && delta > 0.05;
  const isFlat = delta === null || Math.abs(delta) < 0.05;
  const goodTone = invertColors ? !isUp : isUp;
  const deltaColor = isFlat
    ? 'text-muted-foreground'
    : goodTone
      ? 'text-emerald-600'
      : 'text-destructive';
  const DeltaIcon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {title && <p className="text-xs font-semibold text-foreground">{title}</p>}
          <p className="text-[11px] text-muted-foreground">
            Evolução mensal · {year} vs {prevYear}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Acumulado {year}</p>
          <p className={`${compact ? 'text-xs' : 'text-sm'} font-bold tabular-nums text-foreground`}>
            {formatCurrency(accCur)}
          </p>
          {hasPrevYearData ? (
            <div className="flex items-center justify-end gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                vs {prevYear}: {formatCurrency(accPrev)}
              </span>
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${deltaColor}`}>
                <DeltaIcon className="w-3 h-3" />
                {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '—'}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Sem histórico de {prevYear}</p>
          )}
        </div>
      </div>

      <ResponsiveContainer key={`${year}-${points.length}`} width="100%" height={height}>
        <LineChart data={points} margin={{ left: 10, right: 10, top: 6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v: number) => formatShort(v)}
            width={70}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            formatter={(v: any, name: any, props: any) => {
              if (v === null || v === undefined) return ['—', String(name)];
              const isCurrent = String(name) === String(year);
              if (isCurrent) {
                const prev = props?.payload?._prev;
                if (typeof prev === 'number' && prev > 0) {
                  const d = ((v - prev) / prev) * 100;
                  return [
                    `${formatCurrency(v)} (${d > 0 ? '+' : ''}${d.toFixed(1)}% vs ${prevYear})`,
                    String(name),
                  ];
                }
              }
              return [formatCurrency(v), String(name)];
            }}
            labelFormatter={(l) => String(l)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey={String(prevYear)}
            name={String(prevYear)}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey={String(year)}
            name={String(year)}
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
