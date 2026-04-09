import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import type { KpiDefinitionWithThresholds, KpiValue } from './types';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface Props {
  definition: KpiDefinitionWithThresholds;
  values: KpiValue[];
  months: string[];
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

export function KpiCard({ definition: def, values, months }: Props) {
  const chartData = useMemo(() => {
    return months.map(m => {
      const v = values.find(v => v.month === m);
      return { month: formatMonth(m), value: v?.value ?? null };
    });
  }, [months, values]);

  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const currentVal = values.find(v => v.month === currentMonth)?.value ?? null;
  const prevVal = prevMonth ? values.find(v => v.month === prevMonth)?.value ?? null : null;

  const variation = currentVal !== null && prevVal !== null ? currentVal - prevVal : null;
  const isImprovement = variation !== null
    ? def.direction === 'higher_is_better' ? variation > 0 : variation < 0
    : null;

  const color = getThresholdColor(def, currentVal);
  const label = getThresholdLabel(def, currentVal);

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
          {isImprovement ? (
            <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : variation === 0 ? (
            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-red-500" />
          )}
          <span className={isImprovement ? 'text-emerald-600 font-medium' : variation === 0 ? 'text-muted-foreground' : 'text-red-600 font-medium'}>
            {variation > 0 ? '+' : ''}{formatValue(variation, def.value_type === 'percent' ? 'number' : def.value_type)}
            {def.value_type === 'percent' ? ' p.p.' : ''}
          </span>
          <span className="text-muted-foreground">vs mês anterior</span>
        </div>
      )}

      {/* Chart with performance zones */}
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            {/* Performance zone bands */}
            {def.thresholds.map((t, i) => {
              const lo = t.min_value ?? yMin;
              const hi = t.max_value ?? yMax;
              return (
                <ReferenceArea
                  key={i}
                  y1={Math.max(lo, yMin)}
                  y2={Math.min(hi, yMax)}
                  fill={t.color}
                  fillOpacity={0.08}
                />
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
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: color, strokeWidth: 0 }}
              connectNulls
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
