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
  /** Primeiro ano exibido no comparativo (padrão 2024). */
  startYear?: number;
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
  startYear = 2024,
}: Props) {
  const data = useMemo(() => {
    if (!activeMonth || activeMonth.length !== 7) return null;
    const year = parseInt(activeMonth.slice(0, 4));
    const activeMonthIdx = parseInt(activeMonth.slice(5, 7)); // 1-12

    const bucket: Record<string, number> = {};
    const has: Record<string, boolean> = {};
    entries.forEach(e => {
      const ym = e.data?.slice(0, 7);
      if (!ym) return;
      bucket[ym] = (bucket[ym] || 0) + Number(e.valor || 0);
      has[ym] = true;
    });

    const firstYear = Math.min(startYear, year - 1);
    const years: number[] = [];
    for (let y = firstYear; y <= year; y++) {
      const hasAny = Object.keys(has).some(k => k.startsWith(`${y}-`));
      // sempre inclui o ano atual e o anterior; outros só com dados
      if (hasAny || y === year || y === year - 1) years.push(y);
    }

    const points = MONTHS.map((label, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const row: Record<string, any> = { mes: label };
      years.forEach(y => {
        const ym = `${y}-${mm}`;
        const isFuture = y === year && i + 1 > activeMonthIdx;
        row[String(y)] = isFuture ? null : (has[ym] ? bucket[ym] || 0 : null);
      });
      return row;
    });

    // acumulado de cada ano até o mês ativo (mesma janela para comparar)
    const acc: Record<number, number> = {};
    const hasYear: Record<number, boolean> = {};
    years.forEach(y => {
      let sum = 0;
      let any = false;
      for (let i = 1; i <= activeMonthIdx; i++) {
        const ym = `${y}-${String(i).padStart(2, '0')}`;
        if (has[ym]) any = true;
        sum += bucket[ym] || 0;
      }
      acc[y] = sum;
      hasYear[y] = any;
    });

    return { points, years, year, acc, hasYear, activeMonthIdx };
  }, [activeMonth, entries, startYear]);

  if (!data) return null;
  const { points, years, year, acc, hasYear } = data;

  const toneClass = (delta: number | null) => {
    if (delta === null || Math.abs(delta) < 0.05) return 'text-muted-foreground';
    const isUp = delta > 0;
    const good = invertColors ? !isUp : isUp;
    return good ? 'text-emerald-600' : 'text-destructive';
  };

  const lineStyle = (y: number, idx: number) => {
    const isCurrent = y === year;
    if (isCurrent) {
      return { stroke: 'hsl(var(--primary))', strokeWidth: 2.5, dash: undefined as string | undefined, r: 4 };
    }
    const older = years.length - 1 - idx; // 1 = ano anterior
    const opacity = Math.max(0.3, 1 - older * 0.22);
    return {
      stroke: `hsl(var(--muted-foreground) / ${opacity})`,
      strokeWidth: 2,
      dash: older === 1 ? '5 4' : older === 2 ? '2 3' : '8 3 2 3',
      r: 3,
    };
  };

  const yearsDesc = [...years].reverse();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {title && <p className="text-xs font-semibold text-foreground">{title}</p>}
          <p className="text-[11px] text-muted-foreground">
            Evolução mensal · {years[0]} – {year}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Acumulado até {MONTHS[data.activeMonthIdx - 1]}
          </p>
          <div className="mt-0.5 space-y-0.5">
            {yearsDesc.map(y => {
              const prev = acc[y - 1];
              const delta = hasYear[y] && hasYear[y - 1] && prev > 0
                ? ((acc[y] - prev) / prev) * 100
                : null;
              const Icon = delta === null || Math.abs(delta) < 0.05 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
              return (
                <div key={y} className="flex items-center justify-end gap-2">
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{y}</span>
                  <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold tabular-nums ${y === year ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {hasYear[y] ? formatCurrency(acc[y]) : '—'}
                  </span>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold w-16 justify-end ${toneClass(delta)}`}>
                    {delta !== null ? (
                      <>
                        <Icon className="w-3 h-3" />
                        {`${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                      </>
                    ) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ResponsiveContainer key={`${year}-${years.length}`} width="100%" height={height}>
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
              const y = Number(name);
              const prev = props?.payload?.[String(y - 1)];
              if (typeof prev === 'number' && prev > 0) {
                const d = ((v - prev) / prev) * 100;
                return [
                  `${formatCurrency(v)} (${d > 0 ? '+' : ''}${d.toFixed(1)}% vs ${y - 1})`,
                  String(name),
                ];
              }
              return [formatCurrency(v), String(name)];
            }}
            labelFormatter={(l) => String(l)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {years.map((y, idx) => {
            const s = lineStyle(y, idx);
            return (
              <Line
                key={y}
                type="monotone"
                dataKey={String(y)}
                name={String(y)}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
                strokeDasharray={s.dash}
                dot={{ r: s.r }}
                activeDot={{ r: s.r + 2 }}
                connectNulls={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
