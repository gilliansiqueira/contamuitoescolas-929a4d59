import { useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, Settings, Check, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

interface Props {
  schoolId: string;
}

interface ConversionRow {
  id: string;
  school_id: string;
  month: string;
  contatos: number;
  matriculas: number;
}

interface Threshold {
  id: string;
  school_id: string;
  min_value: number | null;
  max_value: number | null;
  color: string;
  label: string;
  sort_order: number;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const DEFAULT_THRESHOLDS = [
  { min_value: null, max_value: 10, color: 'hsl(0 84% 60%)', label: 'Ruim' },
  { min_value: 10, max_value: 20, color: 'hsl(45 93% 47%)', label: 'Regular' },
  { min_value: 20, max_value: 35, color: 'hsl(217 91% 60%)', label: 'Bom' },
  { min_value: 35, max_value: null, color: 'hsl(142 71% 45%)', label: 'Ótimo' },
];

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

// Custom dot colored by threshold
function ThresholdDot(props: any & { thresholds: Threshold[] }) {
  const { cx, cy, payload, thresholds } = props;
  if (!cx || !cy) return null;
  const color = getThresholdColor(thresholds, payload?.conversao);
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
}

export function ConversaoDashboard({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);

  // Fetch conversion data
  const { data: convData = [], isLoading } = useQuery({
    queryKey: ['conversion_data', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_data').select('*').eq('school_id', schoolId).order('month');
      if (error) throw error;
      return data as ConversionRow[];
    },
  });

  // Fetch thresholds
  const { data: thresholds = [] } = useQuery({
    queryKey: ['conversion_thresholds', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversion_thresholds').select('*').eq('school_id', schoolId).order('sort_order');
      if (error) throw error;
      return data as Threshold[];
    },
  });

  // Save cell mutation
  const saveCell = useMutation({
    mutationFn: async ({ month, contatos, matriculas }: { month: string; contatos: number; matriculas: number }) => {
      const existing = convData.find(r => r.month === month);
      if (existing) {
        const { error } = await supabase.from('conversion_data').update({ contatos, matriculas }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('conversion_data').insert({ school_id: schoolId, month, contatos, matriculas });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversion_data', schoolId] }),
  });

  // Sorted months and chart data
  const sortedData = useMemo(() => {
    return [...convData].sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d,
      conversao: d.contatos > 0 ? (d.matriculas / d.contatos) * 100 : 0,
    }));
  }, [convData]);

  // Current and previous month
  const current = sortedData.length > 0 ? sortedData[sortedData.length - 1] : null;
  const prev = sortedData.length > 1 ? sortedData[sortedData.length - 2] : null;
  const currentConv = current?.conversao ?? null;
  const prevConv = prev?.conversao ?? null;
  const variation = currentConv !== null && prevConv !== null ? currentConv - prevConv : null;

  // Years for table
  const years = useMemo(() => {
    const ySet = new Set<string>();
    const now = new Date().getFullYear().toString();
    ySet.add(now);
    convData.forEach(d => { const y = d.month.split('-')[0]; if (y) ySet.add(y); });
    return Array.from(ySet).sort();
  }, [convData]);

  // Map for quick lookup
  const dataMap = useMemo(() => {
    const m: Record<string, ConversionRow> = {};
    convData.forEach(d => { m[d.month] = d; });
    return m;
  }, [convData]);

  // Multi-year chart data
  const chartDataByYear = useMemo(() => {
    const yrs = [...new Set(sortedData.map(d => d.month.split('-')[0]))].sort();
    if (yrs.length <= 1) return null;
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    return months.map(mo => {
      const point: any = { month: MONTH_LABELS[parseInt(mo) - 1] };
      yrs.forEach(y => {
        const row = sortedData.find(d => d.month === `${y}-${mo}`);
        point[y] = row ? row.conversao : null;
      });
      return point;
    });
  }, [sortedData]);

  const yearColors = ['hsl(var(--primary))', 'hsl(217 91% 60%)', 'hsl(142 71% 45%)', 'hsl(45 93% 47%)'];

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Conversão</h2>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setConfigOpen(true)}>
          <Settings className="w-4 h-4 mr-1" /> Configurar
        </Button>
      </div>

      {/* KPI Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Conversão</p>
                <p className="text-4xl font-bold" style={{ color: getThresholdColor(thresholds, currentConv) }}>
                  {currentConv !== null ? `${currentConv.toFixed(1)}%` : '—'}
                </p>
                {current && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {current.contatos} contatos → {current.matriculas} matrículas
                  </p>
                )}
                {currentConv !== null && (
                  <span
                    className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: getThresholdColor(thresholds, currentConv) }}
                  >
                    {getThresholdLabel(thresholds, currentConv)}
                  </span>
                )}
              </div>
              {variation !== null && (
                <div className="text-right">
                  <div className={`flex items-center gap-1 text-sm font-semibold ${variation > 0 ? 'text-emerald-600' : variation < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {variation > 0 ? <ArrowUp className="w-4 h-4" /> : variation < 0 ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {Math.abs(variation).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">vs mês anterior</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Chart */}
      {sortedData.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Evolução da Conversão</h3>
              <ResponsiveContainer width="100%" height={240}>
                {chartDataByYear ? (
                  <LineChart data={chartDataByYear} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(1)}%`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                    {[...new Set(sortedData.map(d => d.month.split('-')[0]))].sort().map((yr, i) => (
                      <Line key={yr} dataKey={yr} name={yr} stroke={yearColors[i % yearColors.length]} strokeWidth={2} dot={{ r: 4, fill: yearColors[i % yearColors.length] }} connectNulls />
                    ))}
                  </LineChart>
                ) : (
                  <LineChart data={sortedData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(1)}%`} labelFormatter={formatMonth} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                    <Line dataKey="conversao" stroke="#6b7280" strokeWidth={2} dot={<ThresholdDot thresholds={thresholds} />} />
                  </LineChart>
                )}
              </ResponsiveContainer>
              {chartDataByYear && (
                <div className="flex gap-4 justify-center mt-2">
                  {[...new Set(sortedData.map(d => d.month.split('-')[0]))].sort().map((yr, i) => (
                    <div key={yr} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-3 h-3 rounded-full" style={{ background: yearColors[i % yearColors.length] }} />
                      {yr}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Editable History Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Histórico de Conversão</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium w-16">Ano</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className="text-center py-2 px-1 text-muted-foreground font-medium min-w-[80px]">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {years.map((year, yi) => (
                    <YearRow
                      key={year}
                      year={year}
                      dataMap={dataMap}
                      colorIndex={yi}
                      onSave={(month, contatos, matriculas) => saveCell.mutate({ month, contatos, matriculas })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Config Sheet */}
      <ConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        schoolId={schoolId}
        thresholds={thresholds}
      />
    </div>
  );
}

// ── Year Row ──
function YearRow({ year, dataMap, colorIndex, onSave }: {
  year: string;
  dataMap: Record<string, ConversionRow>;
  colorIndex: number;
  onSave: (month: string, contatos: number, matriculas: number) => void;
}) {
  const colors = ['hsl(var(--primary))', 'hsl(217 91% 60%)', 'hsl(142 71% 45%)', 'hsl(45 93% 47%)'];
  const borderColor = colors[colorIndex % colors.length];

  return (
    <>
      {/* Contatos row */}
      <tr className="border-b border-border/30">
        <td className="py-1.5 px-2 font-semibold text-xs" rowSpan={3} style={{ borderLeft: `3px solid ${borderColor}` }}>
          {year}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const mo = String(i + 1).padStart(2, '0');
          const key = `${year}-${mo}`;
          const row = dataMap[key];
          return (
            <td key={`c-${mo}`} className="py-0.5 px-1">
              <EditableCell
                placeholder="Cont."
                value={row?.contatos ?? ''}
                onSave={(v) => onSave(key, v, row?.matriculas ?? 0)}
              />
            </td>
          );
        })}
      </tr>
      {/* Matriculas row */}
      <tr className="border-b border-border/30">
        {Array.from({ length: 12 }, (_, i) => {
          const mo = String(i + 1).padStart(2, '0');
          const key = `${year}-${mo}`;
          const row = dataMap[key];
          return (
            <td key={`m-${mo}`} className="py-0.5 px-1">
              <EditableCell
                placeholder="Matr."
                value={row?.matriculas ?? ''}
                onSave={(v) => onSave(key, row?.contatos ?? 0, v)}
              />
            </td>
          );
        })}
      </tr>
      {/* Conversão row (calculated) */}
      <tr className="border-b">
        {Array.from({ length: 12 }, (_, i) => {
          const mo = String(i + 1).padStart(2, '0');
          const key = `${year}-${mo}`;
          const row = dataMap[key];
          const conv = row && row.contatos > 0 ? ((row.matriculas / row.contatos) * 100).toFixed(1) : '';
          return (
            <td key={`cv-${mo}`} className="py-1 px-1 text-center text-xs font-semibold text-primary">
              {conv ? `${conv}%` : ''}
            </td>
          );
        })}
      </tr>
    </>
  );
}

// ── Editable Cell ──
function EditableCell({ value, placeholder, onSave }: { value: number | ''; placeholder: string; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(value !== '' ? String(value) : '');
  const [dirty, setDirty] = useState(false);

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

// ── Config Sheet for Thresholds ──
function ConfigSheet({ open, onOpenChange, schoolId, thresholds }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  thresholds: Threshold[];
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<{ min_value: string; max_value: string; color: string; label: string }[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Init rows from existing thresholds or defaults
  useMemo(() => {
    if (!open) { setInitialized(false); return; }
    if (initialized) return;
    const source = thresholds.length > 0 ? thresholds : DEFAULT_THRESHOLDS.map((d, i) => ({ ...d, sort_order: i }));
    setRows(source.map(t => ({
      min_value: t.min_value !== null ? String(t.min_value) : '',
      max_value: t.max_value !== null ? String(t.max_value) : '',
      color: t.color,
      label: t.label,
    })));
    setInitialized(true);
  }, [open, thresholds, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing
      await supabase.from('conversion_thresholds').delete().eq('school_id', schoolId);
      // Insert new
      const inserts = rows.map((r, i) => ({
        school_id: schoolId,
        min_value: r.min_value !== '' ? parseFloat(r.min_value) : null,
        max_value: r.max_value !== '' ? parseFloat(r.max_value) : null,
        color: r.color,
        label: r.label,
        sort_order: i,
      }));
      const { error } = await supabase.from('conversion_thresholds').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion_thresholds', schoolId] });
      toast.success('Faixas de desempenho salvas');
      onOpenChange(false);
    },
  });

  const addRow = () => setRows([...rows, { min_value: '', max_value: '', color: 'hsl(142 71% 45%)', label: '' }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: string) => {
    const next = [...rows];
    (next[i] as any)[field] = val;
    setRows(next);
  };

  const colorOptions = [
    { value: 'hsl(0 84% 60%)', label: 'Vermelho' },
    { value: 'hsl(45 93% 47%)', label: 'Amarelo' },
    { value: 'hsl(217 91% 60%)', label: 'Azul' },
    { value: 'hsl(142 71% 45%)', label: 'Verde' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Faixas de Desempenho — Conversão</SheetTitle>
          <SheetDescription>Configure as faixas de cor para a taxa de conversão.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
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
          <Button className="w-full rounded-xl mt-4" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Check className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
