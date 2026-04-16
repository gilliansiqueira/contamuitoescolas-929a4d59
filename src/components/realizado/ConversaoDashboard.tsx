import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, Settings, Check, Plus, Trash2, Upload, Trophy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  schoolId: string;
}

interface ConversionRow {
  id: string;
  school_id: string;
  month: string;
  contatos: number;
  matriculas: number;
  tipo: string;
}

interface Threshold {
  id: string;
  school_id: string;
  min_value: number | null;
  max_value: number | null;
  color: string;
  label: string;
  sort_order: number;
  tipo: string;
}

interface ConversionIcon {
  id: string;
  school_id: string;
  card_key: string;
  file_url: string;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const YEAR_COLORS = ['hsl(var(--primary))', 'hsl(217 91% 60%)', 'hsl(142 71% 45%)', 'hsl(45 93% 47%)', 'hsl(280 67% 55%)'];

const DEFAULT_THRESHOLDS: Record<string, { min_value: number | null; max_value: number | null; color: string; label: string }[]> = {
  ativo: [
    { min_value: null, max_value: 3, color: 'hsl(0 84% 60%)', label: 'Ruim' },
    { min_value: 3, max_value: 6, color: 'hsl(45 93% 47%)', label: 'Regular' },
    { min_value: 6, max_value: 10, color: 'hsl(217 91% 60%)', label: 'Bom' },
    { min_value: 10, max_value: null, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
  ],
  receptivo: [
    { min_value: null, max_value: 25, color: 'hsl(0 84% 60%)', label: 'Ruim' },
    { min_value: 25, max_value: 33, color: 'hsl(45 93% 47%)', label: 'Regular' },
    { min_value: 33, max_value: 38, color: 'hsl(217 91% 60%)', label: 'Bom' },
    { min_value: 38, max_value: null, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
  ],
};

function sortConversionRows(rows: ConversionRow[]) {
  return [...rows].sort((a, b) => a.month.localeCompare(b.month));
}

function getThresholdColor(thresholds: Threshold[], value: number | null): string {
  if (value === null || thresholds.length === 0) return 'hsl(var(--muted-foreground))';
  for (const t of thresholds) {
    const above = t.min_value === null || value >= t.min_value;
    const below = t.max_value === null || value < t.max_value;
    if (above && below) return t.color;
  }
  return thresholds[thresholds.length - 1]?.color || 'hsl(var(--muted-foreground))';
}

function getThresholdLabel(thresholds: Threshold[], value: number | null): string {
  if (value === null || thresholds.length === 0) return '';
  for (const t of thresholds) {
    const above = t.min_value === null || value >= t.min_value;
    const below = t.max_value === null || value < t.max_value;
    if (above && below) return t.label;
  }
  return thresholds[thresholds.length - 1]?.label || '';
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTH_LABELS[parseInt(mo) - 1]}/${y?.slice(2)}`;
}

function ThresholdDot(props: any & { thresholds: Threshold[] }) {
  const { cx, cy, payload, thresholds, dataKey } = props;
  if (!cx || !cy) return null;
  const val = dataKey ? payload?.[dataKey] : payload?.conversao;
  const color = getThresholdColor(thresholds, val);
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
}

// ── Main Component ──
export function ConversaoDashboard({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');

  // Fetch data
  const { data: convData = [], isLoading } = useQuery({
    queryKey: ['conversion_data', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_data').select('*').eq('school_id', schoolId).order('month');
      if (error) throw error;
      return (data as any[]).map(d => ({ ...d, tipo: d.tipo || 'ativo' })) as ConversionRow[];
    },
  });

  const { data: thresholds = [] } = useQuery({
    queryKey: ['conversion_thresholds', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_thresholds').select('*').eq('school_id', schoolId).order('sort_order');
      if (error) throw error;
      return data as Threshold[];
    },
  });

  const { data: icons = [] } = useQuery({
    queryKey: ['conversion_icons', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_icons').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data as ConversionIcon[];
    },
  });

  const iconMap = useMemo(() => {
    const m: Record<string, string> = {};
    icons.forEach(ic => { m[ic.card_key] = ic.file_url; });
    return m;
  }, [icons]);

  // Save mutation
  const saveCell = useMutation({
    mutationFn: async ({ month, contatos, matriculas, tipo }: { month: string; contatos: number; matriculas: number; tipo: string }) => {
      const { error } = await supabase
        .from('conversion_data')
        .upsert(
          { school_id: schoolId, month, contatos, matriculas, tipo },
          { onConflict: 'school_id,month,tipo' }
        );
      if (error) throw error;
    },
    onMutate: async ({ month, contatos, matriculas, tipo }) => {
      await queryClient.cancelQueries({ queryKey: ['conversion_data', schoolId] });
      const previousRows = queryClient.getQueryData<ConversionRow[]>(['conversion_data', schoolId]) ?? [];

      queryClient.setQueryData<ConversionRow[]>(['conversion_data', schoolId], (current = []) => {
        const existing = current.find(row => row.month === month && row.tipo === tipo);

        if (existing) {
          return sortConversionRows(
            current.map(row =>
              row.month === month && row.tipo === tipo
                ? { ...row, contatos, matriculas }
                : row
            )
          );
        }

        return sortConversionRows([
          ...current,
          {
            id: `optimistic-${tipo}-${month}`,
            school_id: schoolId,
            month,
            contatos,
            matriculas,
            tipo,
          },
        ]);
      });

      return { previousRows };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousRows) {
        queryClient.setQueryData(['conversion_data', schoolId], context.previousRows);
      }
      toast.error('Erro ao salvar conversão');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['conversion_data', schoolId] }),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conversion_data').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_data', schoolId] });
      toast.success('Registro removido');
    },
  });

  // Separate by tipo
  const ativoData = useMemo(() => convData.filter(d => d.tipo === 'ativo').sort((a, b) => a.month.localeCompare(b.month)), [convData]);
  const receptivoData = useMemo(() => convData.filter(d => d.tipo === 'receptivo').sort((a, b) => a.month.localeCompare(b.month)), [convData]);

  // Thresholds by tipo
  const ativoThresholds = useMemo(() => thresholds.filter(t => t.tipo === 'ativo'), [thresholds]);
  const receptivoThresholds = useMemo(() => thresholds.filter(t => t.tipo === 'receptivo'), [thresholds]);

  // Enrich with conversao
  const enrich = (data: ConversionRow[]) => data.map(d => ({
    ...d,
    conversao: d.contatos > 0 ? (d.matriculas / d.contatos) * 100 : 0,
  }));

  const ativoEnriched = useMemo(() => enrich(ativoData), [ativoData]);
  const receptivoEnriched = useMemo(() => enrich(receptivoData), [receptivoData]);

  // Current/prev for KPI cards
  const getKpi = (data: ReturnType<typeof enrich>) => {
    const curr = data.length > 0 ? data[data.length - 1] : null;
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const conv = curr?.conversao ?? null;
    const prevConv = prev?.conversao ?? null;
    const variation = conv !== null && prevConv !== null ? conv - prevConv : null;
    return { curr, conv, variation, contatos: curr?.contatos ?? 0, matriculas: curr?.matriculas ?? 0 };
  };

  const ativoKpi = getKpi(ativoEnriched);
  const receptivoKpi = getKpi(receptivoEnriched);

  // Years
  const years = useMemo(() => {
    const ySet = new Set<string>();
    ySet.add(new Date().getFullYear().toString());
    convData.forEach(d => { const y = d.month.split('-')[0]; if (y) ySet.add(y); });
    return Array.from(ySet).sort();
  }, [convData]);

  // Best/worst month
  const getBestWorst = (data: ReturnType<typeof enrich>) => {
    if (data.length === 0) return { best: null, worst: null };
    let best = data[0], worst = data[0];
    data.forEach(d => {
      if (d.conversao > best.conversao) best = d;
      if (d.conversao < worst.conversao) worst = d;
    });
    return { best, worst };
  };

  const ativoBW = getBestWorst(ativoEnriched);
  const receptivoBW = getBestWorst(receptivoEnriched);

  // Filter for display
  const shouldShow = (tipo: string) => tipoFilter === 'todos' || tipoFilter === tipo;

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">Conversão</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[140px] rounded-xl text-xs h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="receptivo">Receptivo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[110px] rounded-xl text-xs h-9">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-1" /> Configurar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {shouldShow('ativo') && (
        <KpiSection
          title="ATIVO"
          kpi={ativoKpi}
          thresholds={ativoThresholds}
          iconMap={iconMap}
          prefix="ativo"
          bestWorst={ativoBW}
        />
      )}
      {shouldShow('receptivo') && (
        <KpiSection
          title="RECEPTIVO"
          kpi={receptivoKpi}
          thresholds={receptivoThresholds}
          iconMap={iconMap}
          prefix="receptivo"
          bestWorst={receptivoBW}
        />
      )}

      {/* Charts */}
      {shouldShow('ativo') && ativoEnriched.length > 1 && (
        <ChartSection title="Conversão Ativa" data={ativoEnriched} thresholds={ativoThresholds} years={years} yearFilter={yearFilter} />
      )}
      {shouldShow('receptivo') && receptivoEnriched.length > 1 && (
        <ChartSection title="Conversão Receptiva" data={receptivoEnriched} thresholds={receptivoThresholds} years={years} yearFilter={yearFilter} />
      )}

      {/* Matrículas & Contatos charts */}
      {shouldShow('ativo') && ativoEnriched.length > 1 && (
        <AbsoluteCharts title="Ativo" data={ativoEnriched} years={years} yearFilter={yearFilter} />
      )}
      {shouldShow('receptivo') && receptivoEnriched.length > 1 && (
        <AbsoluteCharts title="Receptivo" data={receptivoEnriched} years={years} yearFilter={yearFilter} />
      )}

      {/* History Tables */}
      {shouldShow('ativo') && (
        <HistoryTable
          title="Histórico — Ativo"
          tipo="ativo"
          convData={ativoData}
          years={years}
          yearFilter={yearFilter}
          onSave={(month, contatos, matriculas) => saveCell.mutate({ month, contatos, matriculas, tipo: 'ativo' })}
          onDelete={(id) => deleteRow.mutate(id)}
          thresholds={ativoThresholds}
        />
      )}
      {shouldShow('receptivo') && (
        <HistoryTable
          title="Histórico — Receptivo"
          tipo="receptivo"
          convData={receptivoData}
          years={years}
          yearFilter={yearFilter}
          onSave={(month, contatos, matriculas) => saveCell.mutate({ month, contatos, matriculas, tipo: 'receptivo' })}
          onDelete={(id) => deleteRow.mutate(id)}
          thresholds={receptivoThresholds}
        />
      )}

      {/* Config */}
      <ConfigSheet open={configOpen} onOpenChange={setConfigOpen} schoolId={schoolId} thresholds={thresholds} icons={icons} />
    </div>
  );
}

// ── KPI Section ──
function KpiSection({ title, kpi, thresholds, iconMap, prefix, bestWorst }: {
  title: string;
  kpi: { conv: number | null; variation: number | null; contatos: number; matriculas: number };
  thresholds: Threshold[];
  iconMap: Record<string, string>;
  prefix: string;
  bestWorst: { best: any; worst: any };
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Contatos" value={kpi.contatos} format="number" iconUrl={iconMap[`${prefix}_contatos`]} />
        <KpiCard label="Matrículas" value={kpi.matriculas} format="number" iconUrl={iconMap[`${prefix}_matriculas`]} />
        <KpiCard
          label="Conversão"
          value={kpi.conv}
          format="percent"
          iconUrl={iconMap[`${prefix}_conversao`]}
          color={getThresholdColor(thresholds, kpi.conv)}
          badge={getThresholdLabel(thresholds, kpi.conv)}
          badgeColor={getThresholdColor(thresholds, kpi.conv)}
          variation={kpi.variation}
        />
      </div>
      {/* Best/Worst highlights */}
      {(bestWorst.best || bestWorst.worst) && (
        <div className="flex gap-3 mt-2 flex-wrap">
          {bestWorst.best && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Trophy className="w-3.5 h-3.5" />
              Melhor: {formatMonth(bestWorst.best.month)} ({bestWorst.best.conversao.toFixed(1)}%)
            </div>
          )}
          {bestWorst.worst && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              Pior: {formatMonth(bestWorst.worst.month)} ({bestWorst.worst.conversao.toFixed(1)}%)
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Single KPI Card ──
function KpiCard({ label, value, format, iconUrl, color, badge, badgeColor, variation }: {
  label: string;
  value: number | null;
  format: 'number' | 'percent';
  iconUrl?: string;
  color?: string;
  badge?: string;
  badgeColor?: string;
  variation?: number | null;
}) {
  const display = value !== null && value !== undefined
    ? format === 'percent' ? `${value.toFixed(1)}%` : String(value)
    : '—';

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 flex items-center gap-3">
        {iconUrl && (
          <img src={iconUrl} alt={label} className="w-10 h-10 object-contain rounded-lg shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold" style={color ? { color } : undefined}>{display}</p>
          {badge && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: badgeColor }}>
              {badge}
            </span>
          )}
        </div>
        {variation !== undefined && variation !== null && (
          <div className="text-right shrink-0">
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${variation > 0 ? 'text-emerald-600' : variation < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {variation > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : variation < 0 ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {Math.abs(variation).toFixed(1)}%
            </div>
            <p className="text-[10px] text-muted-foreground">vs anterior</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Chart Section (conversion line chart) ──
function ChartSection({ title, data, thresholds, years, yearFilter }: {
  title: string;
  data: (ConversionRow & { conversao: number })[];
  thresholds: Threshold[];
  years: string[];
  yearFilter: string;
}) {
  const filtered = yearFilter !== 'todos' ? data.filter(d => d.month.startsWith(yearFilter)) : data;
  const uniqueYears = [...new Set(filtered.map(d => d.month.split('-')[0]))].sort();
  const isMultiYear = uniqueYears.length > 1;

  const chartData = useMemo(() => {
    if (!isMultiYear) return filtered;
    return Array.from({ length: 12 }, (_, i) => {
      const mo = String(i + 1).padStart(2, '0');
      const point: any = { month: MONTH_LABELS[i] };
      uniqueYears.forEach(y => {
        const row = filtered.find(d => d.month === `${y}-${mo}`);
        point[y] = row ? row.conversao : null;
      });
      return point;
    });
  }, [filtered, isMultiYear, uniqueYears]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
          <ResponsiveContainer width="100%" height={220}>
            {isMultiYear ? (
              <LineChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                <Tooltip formatter={(v: number) => `${v?.toFixed(1)}%`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                {uniqueYears.map((yr, i) => (
                  <Line key={yr} dataKey={yr} name={yr} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={2} dot={{ r: 4, fill: YEAR_COLORS[i % YEAR_COLORS.length] }} connectNulls />
                ))}
              </LineChart>
            ) : (
              <LineChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                <Tooltip formatter={(v: number) => `${v?.toFixed(1)}%`} labelFormatter={formatMonth} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                <Line dataKey="conversao" stroke="#6b7280" strokeWidth={2} dot={<ThresholdDot thresholds={thresholds} />} />
              </LineChart>
            )}
          </ResponsiveContainer>
          {isMultiYear && (
            <div className="flex gap-4 justify-center mt-2">
              {uniqueYears.map((yr, i) => (
                <div key={yr} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full" style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                  {yr}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Absolute Charts (Matrículas + Contatos) ──
function AbsoluteCharts({ title, data, years, yearFilter }: {
  title: string;
  data: (ConversionRow & { conversao: number })[];
  years: string[];
  yearFilter: string;
}) {
  const filtered = yearFilter !== 'todos' ? data.filter(d => d.month.startsWith(yearFilter)) : data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SimpleLineChart title={`Contatos — ${title}`} data={filtered} dataKey="contatos" color="hsl(217 91% 60%)" />
      <SimpleLineChart title={`Matrículas — ${title}`} data={filtered} dataKey="matriculas" color="hsl(142 71% 45%)" />
    </div>
  );
}

function SimpleLineChart({ title, data, dataKey, color }: {
  title: string;
  data: ConversionRow[];
  dataKey: string;
  color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip labelFormatter={formatMonth} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Line dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── History Table ──
function HistoryTable({ title, tipo, convData, years, yearFilter, onSave, onDelete, thresholds }: {
  title: string;
  tipo: string;
  convData: ConversionRow[];
  years: string[];
  yearFilter: string;
  onSave: (month: string, contatos: number, matriculas: number) => void;
  onDelete: (id: string) => void;
  thresholds: Threshold[];
}) {
  const [addYear, setAddYear] = useState('');
  const [localYears, setLocalYears] = useState<string[]>([]);
  const [draftRows, setDraftRows] = useState<Record<string, { contatos: string; matriculas: string }>>({});
  const draftRowsRef = useRef<Record<string, { contatos: string; matriculas: string }>>({});

  const allYears = useMemo(() => {
    const s = new Set([...years, ...localYears]);
    return Array.from(s).sort();
  }, [years, localYears]);

  const displayYears = yearFilter !== 'todos' ? allYears.filter(y => y === yearFilter) : allYears;

  const dataMap = useMemo(() => {
    const m: Record<string, ConversionRow> = {};
    convData.forEach(d => { m[d.month] = d; });
    return m;
  }, [convData]);

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      convData.map(row => [
        row.month,
        {
          contatos: String(row.contatos),
          matriculas: String(row.matriculas),
        },
      ])
    ) as Record<string, { contatos: string; matriculas: string }>;

    draftRowsRef.current = nextDrafts;
    setDraftRows(nextDrafts);
  }, [convData]);

  const handleCellSave = useCallback((month: string, field: 'contatos' | 'matriculas', value: number) => {
    const current = draftRowsRef.current[month] ?? { contatos: '', matriculas: '' };
    const nextRow = { ...current, [field]: String(value) };
    const nextDrafts = { ...draftRowsRef.current, [month]: nextRow };

    draftRowsRef.current = nextDrafts;
    setDraftRows(nextDrafts);
    onSave(
      month,
      nextRow.contatos === '' ? 0 : Number(nextRow.contatos),
      nextRow.matriculas === '' ? 0 : Number(nextRow.matriculas)
    );
  }, [onSave]);

  const handleAddYear = () => {
    const y = addYear.trim();
    if (y && /^\d{4}$/.test(y) && !allYears.includes(y)) {
      setLocalYears(prev => [...prev, y]);
      setAddYear('');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-2">
              <Input
                className="w-20 h-8 text-xs rounded-lg"
                placeholder="Ano"
                value={addYear}
                onChange={e => setAddYear(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddYear()}
              />
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={handleAddYear}>
                <Plus className="w-3 h-3 mr-1" /> Ano
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium w-14">Ano</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium w-14">Mês</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Contatos</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Matrículas</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Conversão</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {displayYears.map((year, yi) =>
                  Array.from({ length: 12 }, (_, mi) => {
                    const mo = String(mi + 1).padStart(2, '0');
                    const key = `${year}-${mo}`;
                    const row = dataMap[key];
                     const draftRow = draftRows[key];
                     const contatosValue = draftRow?.contatos ?? (row ? String(row.contatos) : '');
                     const matriculasValue = draftRow?.matriculas ?? (row ? String(row.matriculas) : '');
                     const contatos = contatosValue === '' ? 0 : Number(contatosValue);
                     const matriculas = matriculasValue === '' ? 0 : Number(matriculasValue);
                     const conv = contatos > 0 ? ((matriculas / contatos) * 100).toFixed(1) : '';
                    return (
                      <tr key={key} className="border-b border-border/30 hover:bg-muted/30">
                        {mi === 0 && (
                          <td className="py-1.5 px-2 font-semibold text-xs" rowSpan={12} style={{ borderLeft: `3px solid ${YEAR_COLORS[yi % YEAR_COLORS.length]}` }}>
                            {year}
                          </td>
                        )}
                        <td className="py-1 px-2 text-xs text-muted-foreground">{MONTH_LABELS[mi]}</td>
                        <td className="py-0.5 px-1">
                          <EditableCell
                            placeholder="0"
                            value={contatosValue === '' ? '' : contatos}
                            onSave={v => handleCellSave(key, 'contatos', v)}
                          />
                        </td>
                        <td className="py-0.5 px-1">
                          <EditableCell
                            placeholder="0"
                            value={matriculasValue === '' ? '' : matriculas}
                            onSave={v => handleCellSave(key, 'matriculas', v)}
                          />
                        </td>
                        <td className="py-1 px-1 text-center text-xs font-semibold" style={{ color: conv ? getThresholdColor(thresholds, parseFloat(conv)) : undefined }}>
                          {conv ? `${conv}%` : ''}
                        </td>
                        <td className="py-1 px-1">
                          {row && (
                            <button onClick={() => onDelete(row.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Editable Cell ──
function EditableCell({ value, placeholder, onSave }: { value: number | ''; placeholder: string; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(value !== '' ? String(value) : '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setDraft(value !== '' ? String(value) : '');
    }
  }, [value, dirty]);

  const commit = useCallback(() => {
    if (!dirty) return;
    const n = parseInt(draft);
    if (!isNaN(n) && n >= 0) {
      onSave(n);
      setDirty(false);
    }
  }, [draft, dirty, onSave]);

  return (
    <input
      className="w-full text-center text-xs py-1 px-1 rounded-md border border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent transition-colors"
      placeholder={placeholder}
      value={draft}
      onChange={e => { setDraft(e.target.value); setDirty(true); }}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
    />
  );
}

// ── Config Sheet ──
function ConfigSheet({ open, onOpenChange, schoolId, thresholds, icons }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  thresholds: Threshold[];
  icons: ConversionIcon[];
}) {
  const queryClient = useQueryClient();
  type RowShape = { min_value: string; max_value: string; color: string; label: string };
  const [ativoRows, setAtivoRows] = useState<RowShape[]>([]);
  const [receptivoRows, setReceptivoRows] = useState<RowShape[]>([]);
  const [initialized, setInitialized] = useState(false);

  useMemo(() => {
    if (!open) { setInitialized(false); return; }
    if (initialized) return;
    const toRows = (tipo: string) => {
      const saved = thresholds.filter(t => t.tipo === tipo);
      const source = saved.length > 0 ? saved : (DEFAULT_THRESHOLDS[tipo] || []).map((d: any, i: number) => ({ ...d, sort_order: i }));
      return source.map((t: any) => ({
        min_value: t.min_value !== null && t.min_value !== undefined ? String(t.min_value) : '',
        max_value: t.max_value !== null && t.max_value !== undefined ? String(t.max_value) : '',
        color: t.color,
        label: t.label,
      }));
    };
    setAtivoRows(toRows('ativo'));
    setReceptivoRows(toRows('receptivo'));
    setInitialized(true);
  }, [open, thresholds, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('conversion_thresholds').delete().eq('school_id', schoolId);
      const mapRows = (rows: RowShape[], tipo: string) => rows.map((r, i) => ({
        school_id: schoolId,
        min_value: r.min_value !== '' ? parseFloat(r.min_value) : null,
        max_value: r.max_value !== '' ? parseFloat(r.max_value) : null,
        color: r.color,
        label: r.label,
        sort_order: i,
        tipo,
      }));
      const inserts = [...mapRows(ativoRows, 'ativo'), ...mapRows(receptivoRows, 'receptivo')];
      const { error } = await supabase.from('conversion_thresholds').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_thresholds', schoolId] });
      toast.success('Faixas salvas');
    },
  });

  const colorOptions = [
    { value: 'hsl(0 84% 60%)', label: 'Vermelho' },
    { value: 'hsl(45 93% 47%)', label: 'Amarelo' },
    { value: 'hsl(217 91% 60%)', label: 'Azul' },
    { value: 'hsl(142 71% 45%)', label: 'Verde' },
  ];

  const iconCards = [
    { key: 'ativo_contatos', label: 'Contatos Ativo' },
    { key: 'ativo_matriculas', label: 'Matrículas Ativo' },
    { key: 'ativo_conversao', label: 'Conversão Ativo' },
    { key: 'receptivo_contatos', label: 'Contatos Receptivo' },
    { key: 'receptivo_matriculas', label: 'Matrículas Receptivo' },
    { key: 'receptivo_conversao', label: 'Conversão Receptivo' },
  ];

  const renderThresholdGroup = (label: string, rows: RowShape[], setRows: (r: RowShape[]) => void) => {
    const addRow = () => setRows([...rows, { min_value: '', max_value: '', color: 'hsl(142 71% 45%)', label: '' }]);
    const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
    const updateRow = (i: number, field: string, val: string) => {
      const next = [...rows];
      (next[i] as any)[field] = val;
      setRows(next);
    };
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 p-3 rounded-xl border bg-card">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input className="rounded-lg text-xs" placeholder="Mín" value={r.min_value} onChange={e => updateRow(i, 'min_value', e.target.value)} />
                <Input className="rounded-lg text-xs" placeholder="Máx" value={r.max_value} onChange={e => updateRow(i, 'max_value', e.target.value)} />
              </div>
              <div className="flex gap-2 items-center">
                <Input className="rounded-lg text-xs flex-1" placeholder="Label" value={r.label} onChange={e => updateRow(i, 'label', e.target.value)} />
                <div className="flex gap-1">
                  {colorOptions.map(c => (
                    <button
                      key={c.value}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${r.color === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ background: c.value }}
                      onClick={() => updateRow(i, 'color', c.value)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => removeRow(i)}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={addRow}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar faixa
        </Button>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações — Conversão</SheetTitle>
          <SheetDescription>Faixas de desempenho, ícones e modelos reutilizáveis.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="faixas" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="faixas" className="flex-1 text-xs">Faixas</TabsTrigger>
            <TabsTrigger value="icones" className="flex-1 text-xs">Ícones</TabsTrigger>
            <TabsTrigger value="modelos" className="flex-1 text-xs">Modelos</TabsTrigger>
          </TabsList>
          <TabsContent value="faixas" className="space-y-6 mt-4">
            {renderThresholdGroup('Faixas — Ativo', ativoRows, setAtivoRows)}
            {renderThresholdGroup('Faixas — Receptivo', receptivoRows, setReceptivoRows)}
            <Button className="w-full rounded-xl" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Check className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </TabsContent>
          <TabsContent value="icones" className="space-y-3 mt-4">
            {iconCards.map(ic => (
              <IconUploadRow key={ic.key} cardKey={ic.key} label={ic.label} schoolId={schoolId} currentIcon={icons.find(i => i.card_key === ic.key)} />
            ))}
          </TabsContent>
          <TabsContent value="modelos" className="mt-4">
            <ConversionModelsTab schoolId={schoolId} thresholds={thresholds} icons={icons} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ── Conversion Models Tab ──
function ConversionModelsTab({ schoolId, thresholds, icons }: {
  schoolId: string;
  thresholds: Threshold[];
  icons: ConversionIcon[];
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['conversion_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_templates').select('*').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: templateItems = [] } = useQuery({
    queryKey: ['conversion_template_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_template_items').select('*');
      if (error) throw error;
      return data as { id: string; template_id: string; tipo: string; thresholds: any; icon_contatos_url: string | null; icon_matriculas_url: string | null; icon_conversao_url: string | null }[];
    },
  });

  // Save current config as a new template
  const saveAsTemplate = useMutation({
    mutationFn: async (name: string) => {
      const { data: tmpl, error: tErr } = await supabase.from('conversion_templates').insert({ name }).select().single();
      if (tErr) throw tErr;

      const items = ['ativo', 'receptivo'].map(tipo => {
        const tipoThresholds = thresholds.filter(t => t.tipo === tipo).map(t => ({
          min_value: t.min_value,
          max_value: t.max_value,
          color: t.color,
          label: t.label,
          sort_order: t.sort_order,
        }));
        const getIcon = (key: string) => icons.find(i => i.card_key === `${tipo}_${key}`)?.file_url || null;
        return {
          template_id: tmpl.id,
          tipo,
          thresholds: tipoThresholds,
          icon_contatos_url: getIcon('contatos'),
          icon_matriculas_url: getIcon('matriculas'),
          icon_conversao_url: getIcon('conversao'),
        };
      });

      const { error: iErr } = await supabase.from('conversion_template_items').insert(items);
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_templates'] });
      queryClient.invalidateQueries({ queryKey: ['conversion_template_items'] });
      toast.success('Modelo salvo');
      setNewName('');
    },
    onError: () => toast.error('Erro ao salvar modelo'),
  });

  // Apply template to school
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const items = templateItems.filter(i => i.template_id === templateId);

      // Clear existing thresholds
      await supabase.from('conversion_thresholds').delete().eq('school_id', schoolId);

      // Insert thresholds from template
      const newThresholds: any[] = [];
      for (const item of items) {
        const parsedThresholds = Array.isArray(item.thresholds) ? item.thresholds : [];
        parsedThresholds.forEach((t: any, idx: number) => {
          newThresholds.push({
            school_id: schoolId,
            tipo: item.tipo,
            min_value: t.min_value ?? null,
            max_value: t.max_value ?? null,
            color: t.color || 'hsl(142 71% 45%)',
            label: t.label || '',
            sort_order: t.sort_order ?? idx,
          });
        });

        // Apply icons from template
        const iconKeys = [
          { field: 'icon_contatos_url', key: `${item.tipo}_contatos` },
          { field: 'icon_matriculas_url', key: `${item.tipo}_matriculas` },
          { field: 'icon_conversao_url', key: `${item.tipo}_conversao` },
        ];
        for (const ik of iconKeys) {
          const url = (item as any)[ik.field];
          if (url) {
            const existing = icons.find(i => i.card_key === ik.key);
            if (existing) {
              await supabase.from('conversion_icons').update({ file_url: url }).eq('id', existing.id);
            } else {
              await supabase.from('conversion_icons').insert({ school_id: schoolId, card_key: ik.key, file_url: url });
            }
          }
        }
      }

      if (newThresholds.length > 0) {
        const { error } = await supabase.from('conversion_thresholds').insert(newThresholds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_thresholds', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['conversion_icons', schoolId] });
      toast.success('Modelo aplicado! Você pode personalizar faixas e ícones.');
    },
    onError: () => toast.error('Erro ao aplicar modelo'),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conversion_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_templates'] });
      queryClient.invalidateQueries({ queryKey: ['conversion_template_items'] });
      toast.success('Modelo removido');
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Salve a configuração atual como modelo reutilizável ou aplique um modelo existente. Após aplicar, você pode personalizar faixas, nomes e ícones sem alterar o modelo original.
      </p>

      {/* Save current as template */}
      <div className="flex gap-2">
        <Input
          className="rounded-xl text-xs flex-1"
          placeholder="Nome do modelo"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && newName.trim() && saveAsTemplate.mutate(newName.trim())}
        />
        <Button
          size="sm"
          className="rounded-xl text-xs"
          onClick={() => newName.trim() && saveAsTemplate.mutate(newName.trim())}
          disabled={saveAsTemplate.isPending || !newName.trim()}
        >
          Salvar atual
        </Button>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum modelo salvo.</div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const items = templateItems.filter(i => i.template_id === t.id);
            const totalThresholds = items.reduce((s, i) => s + (Array.isArray(i.thresholds) ? i.thresholds.length : 0), 0);
            return (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{totalThresholds} faixas • {items.length} tipos</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs"
                  onClick={() => applyTemplate.mutate(t.id)}
                  disabled={applyTemplate.isPending}
                >
                  Aplicar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg text-xs text-red-500"
                  onClick={() => deleteTemplate.mutate(t.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Icon Upload Row ──
function IconUploadRow({ cardKey, label, schoolId, currentIcon }: {
  cardKey: string;
  label: string;
  schoolId: string;
  currentIcon?: ConversionIcon;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop();
      const path = `${schoolId}/conv_${cardKey}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('kpi-icons').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('kpi-icons').getPublicUrl(path);
      const file_url = urlData.publicUrl;

      if (currentIcon) {
        await supabase.from('conversion_icons').update({ file_url }).eq('id', currentIcon.id);
      } else {
        await supabase.from('conversion_icons').insert({ school_id: schoolId, card_key: cardKey, file_url });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_icons', schoolId] });
      toast.success(`Ícone de ${label} atualizado`);
    },
    onError: () => toast.error('Erro ao enviar ícone'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!currentIcon) return;
      await supabase.from('conversion_icons').delete().eq('id', currentIcon.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_icons', schoolId] });
      toast.success('Ícone removido');
    },
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
      {currentIcon ? (
        <img src={currentIcon.file_url} alt={label} className="w-10 h-10 object-contain rounded-lg border" />
      ) : (
        <div className="w-10 h-10 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground">
          <Upload className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f) upload.mutate(f);
      }} />
      <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => fileRef.current?.click()}>
        {currentIcon ? 'Trocar' : 'Enviar'}
      </Button>
      {currentIcon && (
        <Button size="sm" variant="ghost" className="rounded-lg text-xs text-red-500" onClick={() => remove.mutate()}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
