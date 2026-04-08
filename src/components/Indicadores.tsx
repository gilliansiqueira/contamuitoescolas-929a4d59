import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { motion } from 'framer-motion';

import lucratividadeIcon from '@/assets/lucratividade.png';
import inadimplenciaIcon from '@/assets/inadimplencia.png';
import alunosTurmaIcon from '@/assets/alunos_turma.png';
import alunosModalidadeIcon from '@/assets/alunos_modalidade.png';
import evasaoIcon from '@/assets/evasao.png';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Props {
  schoolId: string;
}

interface KpiRow {
  id: string;
  school_id: string;
  month: string;
  lucratividade: number | null;
  inadimplencia: number | null;
  media_alunos_turma: number | null;
  alunos_modalidade: number | null;
  evasao: number | null;
}

interface KpiDef {
  key: keyof Pick<KpiRow, 'lucratividade' | 'inadimplencia' | 'media_alunos_turma' | 'alunos_modalidade' | 'evasao'>;
  label: string;
  unit: string;
  icon: string;
  goodDirection: 'up' | 'down';
  ranges: { max: number; color: string; label: string }[];
}

const KPI_DEFS: KpiDef[] = [
  {
    key: 'lucratividade', label: 'Lucratividade', unit: '%', icon: lucratividadeIcon, goodDirection: 'up',
    ranges: [
      { max: 10, color: 'hsl(0 84% 60%)', label: 'Ruim' },
      { max: 15, color: 'hsl(45 93% 47%)', label: 'Regular' },
      { max: 20, color: 'hsl(217 91% 60%)', label: 'Bom' },
      { max: Infinity, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
    ],
  },
  {
    key: 'inadimplencia', label: 'Inadimplência', unit: '%', icon: inadimplenciaIcon, goodDirection: 'down',
    ranges: [
      { max: 2, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
      { max: 2.5, color: 'hsl(217 91% 60%)', label: 'Bom' },
      { max: 3, color: 'hsl(45 93% 47%)', label: 'Regular' },
      { max: Infinity, color: 'hsl(0 84% 60%)', label: 'Ruim' },
    ],
  },
  {
    key: 'media_alunos_turma', label: 'Média Alunos/Turma', unit: '', icon: alunosTurmaIcon, goodDirection: 'up',
    ranges: [
      { max: 3, color: 'hsl(0 84% 60%)', label: 'Ruim' },
      { max: 4, color: 'hsl(45 93% 47%)', label: 'Regular' },
      { max: 5.89, color: 'hsl(217 91% 60%)', label: 'Bom' },
      { max: Infinity, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
    ],
  },
  {
    key: 'alunos_modalidade', label: 'Alunos por Modalidade', unit: '%', icon: alunosModalidadeIcon, goodDirection: 'up',
    ranges: [
      { max: 70, color: 'hsl(0 84% 60%)', label: 'Ruim' },
      { max: 75, color: 'hsl(45 93% 47%)', label: 'Regular' },
      { max: 80, color: 'hsl(217 91% 60%)', label: 'Bom' },
      { max: Infinity, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
    ],
  },
  {
    key: 'evasao', label: 'Evasão', unit: '%', icon: evasaoIcon, goodDirection: 'down',
    ranges: [
      { max: 2.5, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
      { max: 3, color: 'hsl(217 91% 60%)', label: 'Bom' },
      { max: 3.5, color: 'hsl(45 93% 47%)', label: 'Regular' },
      { max: Infinity, color: 'hsl(0 84% 60%)', label: 'Ruim' },
    ],
  },
];

function getColor(def: KpiDef, value: number | null): string {
  if (value === null) return 'hsl(var(--muted-foreground))';
  for (const r of def.ranges) {
    if (value < r.max) return r.color;
  }
  return def.ranges[def.ranges.length - 1].color;
}

function getLabel(def: KpiDef, value: number | null): string {
  if (value === null) return '—';
  for (const r of def.ranges) {
    if (value < r.max) return r.label;
  }
  return def.ranges[def.ranges.length - 1].label;
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
}

function generateMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function Indicadores({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const months = useMemo(generateMonths, []);
  const [selectedMonth, setSelectedMonth] = useState(months[months.length - 1]);
  const [form, setForm] = useState<Record<string, number | ''>>({});

  const { data: kpis = [] } = useQuery({
    queryKey: ['school_kpis', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_kpis')
        .select('*')
        .eq('school_id', schoolId)
        .order('month');
      if (error) throw error;
      return data as KpiRow[];
    },
  });

  const currentKpi = useMemo(() => kpis.find(k => k.month === selectedMonth), [kpis, selectedMonth]);

  // Initialize form when month changes
  useMemo(() => {
    const vals: Record<string, number | ''> = {};
    for (const def of KPI_DEFS) {
      const v = currentKpi?.[def.key];
      vals[def.key] = v != null ? v : '';
    }
    setForm(vals);
  }, [currentKpi, selectedMonth]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        school_id: schoolId,
        month: selectedMonth,
      };
      for (const def of KPI_DEFS) {
        payload[def.key] = form[def.key] === '' ? null : Number(form[def.key]);
      }
      const { error } = await supabase
        .from('school_kpis')
        .upsert(payload, { onConflict: 'school_id,month' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school_kpis', schoolId] });
      toast.success('Indicadores salvos!');
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const chartData = useMemo(() => {
    return months.map(m => {
      const row = kpis.find(k => k.month === m);
      const point: any = { month: formatMonth(m) };
      for (const def of KPI_DEFS) {
        point[def.key] = row?.[def.key] ?? null;
      }
      return point;
    });
  }, [months, kpis]);

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-muted-foreground">Mês:</label>
        <div className="flex gap-1 flex-wrap">
          {months.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                m === selectedMonth
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {formatMonth(m)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards with input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI_DEFS.map(def => {
          const val = form[def.key];
          const numVal = val === '' ? null : Number(val);
          const color = getColor(def, numVal);
          const label = getLabel(def, numVal);

          return (
            <motion.div
              key={def.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl p-4 space-y-2"
            >
              <div className="flex flex-col items-center gap-1">
                <img src={def.icon} alt={def.label} width={36} height={36} className="object-contain" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{def.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={val}
                  onChange={e => setForm({ ...form, [def.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="bg-surface h-8 text-sm"
                  placeholder="—"
                />
                {def.unit && <span className="text-xs text-muted-foreground shrink-0">{def.unit}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: color }}
                >
                  {label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-1" />
          Salvar {formatMonth(selectedMonth)}
        </Button>
      </div>

      {/* Evolution Charts */}
      <div className="space-y-6">
        {KPI_DEFS.map(def => (
          <motion.div
            key={def.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-1">
              <img src={def.icon} alt={def.label} width={24} height={24} className="object-contain" />
              <h4 className="text-sm font-semibold">{def.label}</h4>
            </div>
            <div className="flex gap-2 mb-3 flex-wrap">
              {def.ranges.map(r => (
                <span
                  key={r.label}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: r.color }}
                >
                  {r.label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => [`${v}${def.unit}`, def.label]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey={def.key}
                  stroke={getColor(def, chartData.find(d => d[def.key] != null)?.[def.key] ?? null)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                  label={({ x, y, value }: any) =>
                    value != null ? (
                      <text x={x} y={y - 10} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))">
                        {value}{def.unit}
                      </text>
                    ) : null
                  }
                />
                {/* Reference lines for thresholds */}
                {def.ranges.slice(0, -1).map(r => (
                  <ReferenceLine
                    key={r.max}
                    y={r.max}
                    stroke={r.color}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
