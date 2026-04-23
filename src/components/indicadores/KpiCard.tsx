import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import type { KpiDefinitionWithThresholds, KpiValue } from './types';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { Insight } from '@/components/InsightsBar';

const TONE_STYLES: Record<Insight['tone'], { container: string; iconWrap: string; icon: string; title: string }> = {
  success: {
    container: 'border-emerald-500/30 bg-emerald-500/10',
    iconWrap: 'bg-emerald-500/15',
    icon: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    container: 'border-amber-500/30 bg-amber-500/10',
    iconWrap: 'bg-amber-500/15',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-700 dark:text-amber-300',
  },
  danger: {
    container: 'border-red-500/30 bg-red-500/10',
    iconWrap: 'bg-red-500/15',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-700 dark:text-red-300',
  },
  info: {
    container: 'border-sky-500/30 bg-sky-500/10',
    iconWrap: 'bg-sky-500/15',
    icon: 'text-sky-600 dark:text-sky-400',
    title: 'text-sky-700 dark:text-sky-300',
  },
  neutral: {
    container: 'border-border bg-muted/40',
    iconWrap: 'bg-muted',
    icon: 'text-muted-foreground',
    title: 'text-foreground',
  },
};

interface Props {
  definition: KpiDefinitionWithThresholds;
  values: KpiValue[];
  months: string[];
  insights?: Insight[];
  /** Mês de referência para o valor exibido no card. Default: último mês de `months`. */
  referenceMonth?: string;
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
}

function formatValue(v: number, type: string) {
  if (type === 'currency') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (type === 'percent') return `${v}%`;
  return v.toLocaleString('pt-BR');
}

function getThresholdColor(def: KpiDefinitionWithThresholds, value: number | null): string {
  if (value === null || !def.thresholds.length) return 'hsl(var(--muted-foreground))';
  for (const t of def.thresholds) {
    const min = t.min_value ?? -Infinity;
    const max = t.max_value ?? Infinity;
    if (value >= min && value < max) return t.color;
  }
  return def.thresholds[def.thresholds.length - 1].color;
}

function getThresholdLabel(def: KpiDefinitionWithThresholds, value: number | null): string {
  if (value === null || !def.thresholds.length) return '—';
  for (const t of def.thresholds) {
    const min = t.min_value ?? -Infinity;
    const max = t.max_value ?? Infinity;
    if (value >= min && value < max) return t.label;
  }
  return def.thresholds[def.thresholds.length - 1].label;
}

const NEUTRAL_LINE_COLOR = '#6b7280'; // gray-500

// Year line colors for multi-year support — paleta distinta por ano (alto contraste)
const YEAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Custom dot that uses threshold color
function ThresholdDot(props: any) {
  const { cx, cy, payload, def } = props;
  if (cx === undefined || cy === undefined || payload.value === null) return null;
  const color = getThresholdColor(def, payload.value);
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />;
}

export function KpiCard({ definition: def, values, months, insights = [], referenceMonth }: Props) {
  // Group values by year
  const years = useMemo(() => {
    const allMonths = new Set<string>();
    values.forEach(v => allMonths.add(v.month));
    months.forEach(m => allMonths.add(m));
    const yrs = new Set<string>();
    allMonths.forEach(m => yrs.add(m.split('-')[0]));
    return Array.from(yrs).sort();
  }, [values, months]);

  const isMultiYear = years.length > 1;

  // Single year chart data
  const chartData = useMemo(() => {
    if (isMultiYear) return [];
    return months.map(m => {
      const v = values.find(v => v.month === m);
      return { month: formatMonth(m), value: v?.value ?? null };
    });
  }, [months, values, isMultiYear]);

  // Multi-year chart data: one line per year, X axis = month number
  const multiYearData = useMemo(() => {
    if (!isMultiYear) return [];
    const monthNums = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return monthNums.map((mo, i) => {
      const point: any = { month: monthLabels[i] };
      years.forEach(y => {
        const v = values.find(v => v.month === `${y}-${mo}`);
        point[y] = v?.value ?? null;
      });
      return point;
    });
  }, [values, years, isMultiYear]);

  // Mês "atual" exibido no card: usa referenceMonth se fornecido, senão último de `months`
  const currentMonth = referenceMonth ?? months[months.length - 1];
  const currentIdx = months.indexOf(currentMonth);
  const prevMonth = currentIdx > 0 ? months[currentIdx - 1] : undefined;
  const currentVal = values.find(v => v.month === currentMonth)?.value ?? null;
  const prevVal = prevMonth ? values.find(v => v.month === prevMonth)?.value ?? null : null;

  const variation = currentVal !== null && prevVal !== null ? currentVal - prevVal : null;
  const isImprovement = variation !== null
    ? def.direction === 'higher_is_better' ? variation > 0 : variation < 0
    : null;

  const color = getThresholdColor(def, currentVal);
  const label = getThresholdLabel(def, currentVal);

  // Format variation with correct unit (no p.p.)
  const formatVariation = (v: number) => {
    const prefix = v > 0 ? '+' : '';
    return `${prefix}${formatValue(v, def.value_type)}`;
  };

  // Compute Y domain from thresholds and data
  const allValues = values.map(v => v.value);
  const thresholdBounds = def.thresholds.flatMap(t => [t.min_value, t.max_value].filter(v => v !== null && isFinite(v!))) as number[];
  const allNums = [...allValues, ...thresholdBounds];
  const yMin = allNums.length ? Math.floor(Math.min(...allNums) * 0.9) : 0;
  const yMax = allNums.length ? Math.ceil(Math.max(...allNums) * 1.1) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 flex flex-col"
    >
      {/* Per-KPI insights */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {insights.map(ins => {
            const styles = TONE_STYLES[ins.tone];
            const Icon = ins.icon;
            return (
              <div
                key={ins.id}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${styles.container}`}
              >
                {Icon && (
                  <div className={`shrink-0 rounded-md p-1 ${styles.iconWrap}`}>
                    <Icon className={`w-3.5 h-3.5 ${styles.icon}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold leading-tight ${styles.title}`}>{ins.title}</p>
                  {ins.description && (
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{ins.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center gap-2 mb-3">
        {def.icon?.file_url ? (
          <img
            src={def.icon.file_url}
            alt={def.name}
            className="object-contain"
            style={{ width: 64, height: 64 }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
            {def.name.charAt(0)}
          </div>
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{def.name}</span>
      </div>

      {/* Value */}
      <div className="text-center mb-1">
        <span className="text-3xl font-extrabold" style={{ color }}>
          {currentVal !== null ? formatValue(currentVal, def.value_type) : '—'}
        </span>
      </div>

      {/* Status badge */}
      <div className="flex justify-center mb-2">
        <span
          className="text-[10px] font-bold px-3 py-0.5 rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>

      {/* Variation */}
      {variation !== null && (
        <div className="flex items-center justify-center gap-1 mb-3 text-xs">
          {variation > 0 ? (
            <ArrowUp className="w-3.5 h-3.5" style={{ color: isImprovement ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)' }} />
          ) : variation < 0 ? (
            <ArrowDown className="w-3.5 h-3.5" style={{ color: isImprovement ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)' }} />
          ) : (
            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={variation === 0 ? 'text-muted-foreground' : 'font-medium'} style={isImprovement ? { color: 'hsl(142 71% 45%)' } : variation !== 0 ? { color: 'hsl(0 84% 60%)' } : undefined}>
            {formatVariation(variation)}
          </span>
          <span className="text-muted-foreground">vs mês anterior</span>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height={160}>
          {isMultiYear ? (
            <LineChart data={multiYearData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              {def.thresholds.map((t, i) => {
                const lo = t.min_value ?? yMin;
                const hi = t.max_value ?? yMax;
                return (
                  <ReferenceArea key={i} y1={Math.max(lo, yMin)} y2={Math.min(hi, yMax)} fill={t.color} fillOpacity={0.08} />
                );
              })}
              <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[yMin, yMax]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [formatValue(v, def.value_type), name]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  name={year}
                  stroke={YEAR_COLORS[idx % YEAR_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: YEAR_COLORS[idx % YEAR_COLORS.length] }}
                  connectNulls
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              {def.thresholds.map((t, i) => {
                const lo = t.min_value ?? yMin;
                const hi = t.max_value ?? yMax;
                return (
                  <ReferenceArea key={i} y1={Math.max(lo, yMin)} y2={Math.min(hi, yMax)} fill={t.color} fillOpacity={0.08} />
                );
              })}
              <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[yMin, yMax]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [formatValue(v, def.value_type), def.name]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={NEUTRAL_LINE_COLOR}
                strokeWidth={2.5}
                dot={<ThresholdDot def={def} />}
                connectNulls
                activeDot={{ r: 5 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Year legend for multi-year */}
      {isMultiYear && (
        <div className="flex justify-center gap-3 mt-1">
          {years.map((year, idx) => (
            <div key={year} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: YEAR_COLORS[idx % YEAR_COLORS.length] }} />
              {year}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
