import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, LineChart as LineIcon } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { useSAOrders, useSAOrderItems, useSAChannels, useSAPaymentMethods } from '../analise-vendas/useAnaliseVendasData';
import { SalesData, SalesPaymentMethod, SalesCardBrand, PAYMENT_METHODS } from './vendas-types';

const COLORS = ['#ea384c', '#0EA5E9', '#F59E0B', '#10B981', '#8B5CF6', '#64748B', '#EC4899', '#14B8A6', '#F97316'];
const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMonth = (m: string) => `${MONTHS_LABELS[parseInt(m.split('-')[1], 10) - 1]}/${m.split('-')[0].slice(2)}`;

export interface CustomChart {
  id: string;
  school_id: string;
  title: string;
  source: string;
  chart_type: string;
  metric: string;
  group_by: string;
  sort_order: number;
}

const CHART_TYPES = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Linha' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Pizza' },
];

const SOURCES = [
  { value: 'vendas', label: 'Vendas (formas de pagamento)' },
  { value: 'analise', label: 'Análise de Vendas (pedidos)' },
];

const METRICS: Record<string, { value: string; label: string }[]> = {
  vendas: [{ value: 'faturamento', label: 'Faturamento' }],
  analise: [
    { value: 'faturamento', label: 'Faturamento bruto' },
    { value: 'lucro', label: 'Lucro bruto' },
    { value: 'quantidade', label: 'Quantidade de itens' },
    { value: 'pedidos', label: 'Nº de pedidos' },
  ],
};

const GROUPS: Record<string, { value: string; label: string }[]> = {
  vendas: [
    { value: 'mes', label: 'Mês' },
    { value: 'forma', label: 'Forma de pagamento' },
    { value: 'bandeira', label: 'Bandeira' },
  ],
  analise: [
    { value: 'mes', label: 'Mês' },
    { value: 'produto', label: 'Produto' },
    { value: 'canal', label: 'Canal' },
    { value: 'forma', label: 'Forma de pagamento' },
  ],
};

interface Props {
  schoolId: string;
  selectedMonths: string[];
}

export function GraficosPersonalizados({ schoolId, selectedMonths }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: charts = [] } = useQuery({
    queryKey: ['sales_custom_charts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_custom_charts')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as CustomChart[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sales_custom_charts', schoolId] });

  const createChart = useMutation({
    mutationFn: async (c: Partial<CustomChart>) => {
      const { error } = await supabase.from('sales_custom_charts').insert({
        school_id: schoolId,
        title: c.title || 'Novo gráfico',
        source: c.source || 'vendas',
        chart_type: c.chart_type || 'bar',
        metric: c.metric || 'faturamento',
        group_by: c.group_by || 'mes',
        sort_order: charts.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setAdding(false); },
  });

  const updateChart = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CustomChart> }) => {
      const { error } = await supabase.from('sales_custom_charts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteChart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_custom_charts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gráficos personalizados</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {charts.length === 0 && !adding && (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          <LineIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum gráfico personalizado ainda.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {charts.map(chart => (
          <ChartCard
            key={chart.id}
            chart={chart}
            schoolId={schoolId}
            selectedMonths={selectedMonths}
            onChange={(patch) => updateChart.mutate({ id: chart.id, patch })}
            onDelete={() => deleteChart.mutate(chart.id)}
          />
        ))}
      </div>

      {adding ? (
        <NewChartForm onCancel={() => setAdding(false)} onCreate={(c) => createChart.mutate(c)} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar gráfico
        </Button>
      )}
    </div>
  );
}

function NewChartForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (c: Partial<CustomChart>) => void }) {
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('vendas');
  const [chartType, setChartType] = useState('bar');
  const [metric, setMetric] = useState('faturamento');
  const [groupBy, setGroupBy] = useState('mes');

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Input placeholder="Título do gráfico" value={title} onChange={e => setTitle(e.target.value)} />
        <Select value={source} onValueChange={(v) => { setSource(v); setMetric('faturamento'); setGroupBy('mes'); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{METRICS[source].map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{GROUPS[source].map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chartType} onValueChange={setChartType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CHART_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onCreate({ title: title || 'Novo gráfico', source, chart_type: chartType, metric, group_by: groupBy })}>
          Criar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

function ChartCard({ chart, schoolId, selectedMonths, onChange, onDelete }: {
  chart: CustomChart;
  schoolId: string;
  selectedMonths: string[];
  onChange: (patch: Partial<CustomChart>) => void;
  onDelete: () => void;
}) {
  const data = useChartData(chart, schoolId, selectedMonths);
  const isCurrency = chart.metric !== 'quantidade' && chart.metric !== 'pedidos';
  const fmtVal = (v: number) => (isCurrency ? fmtBRL(v) : v.toLocaleString('pt-BR'));

  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Input
          value={chart.title}
          onChange={e => onChange({ title: e.target.value })}
          className="h-8 border-none px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Select value={chart.source} onValueChange={(v) => onChange({ source: v, metric: 'faturamento', group_by: 'mes' })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chart.metric} onValueChange={(v) => onChange({ metric: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{(METRICS[chart.source] || []).map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chart.group_by} onValueChange={(v) => onChange({ group_by: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{(GROUPS[chart.source] || []).map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chart.chart_type} onValueChange={(v) => onChange({ chart_type: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CHART_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {data.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          Sem dados para o período selecionado.
        </div>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(chart.chart_type, data, fmtVal)}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function renderChart(type: string, data: { name: string; value: number }[], fmtVal: (v: number) => string) {
  const tooltip = (
    <Tooltip
      formatter={(v: number) => fmtVal(v)}
      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
    />
  );

  if (type === 'pie') {
    return (
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={95} label={false}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        {tooltip}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    );
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 30} />
      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={70} />
      {tooltip}
    </>
  );

  if (type === 'line') {
    return (
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        {axes}
        <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    );
  }

  if (type === 'area') {
    return (
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ccArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.7} />
            <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        {axes}
        <Area type="monotone" dataKey="value" stroke={COLORS[1]} fill="url(#ccArea)" />
      </AreaChart>
    );
  }

  return (
    <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
      {axes}
      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Bar>
    </BarChart>
  );
}

function useChartData(chart: CustomChart, schoolId: string, selectedMonths: string[]) {
  const monthSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);

  const { data: salesData = [] } = useQuery({
    queryKey: ['sales_data', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_data').select('*').eq('school_id', schoolId);
      return (data || []) as SalesData[];
    },
    enabled: chart.source === 'vendas',
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['sales_payment_methods', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId);
      return (data || []) as SalesPaymentMethod[];
    },
    enabled: chart.source === 'vendas',
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['sales_card_brands'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_card_brands').select('*').order('sort_order');
      return (data || []) as SalesCardBrand[];
    },
    enabled: chart.source === 'vendas',
  });

  const { data: orders = [] } = useSAOrders(schoolId);
  const { data: items = [] } = useSAOrderItems(schoolId);
  const { data: channels = [] } = useSAChannels(schoolId);
  const { data: saMethods = [] } = useSAPaymentMethods(schoolId);

  return useMemo(() => {
    const acc = new Map<string, number>();
    const add = (k: string, v: number) => acc.set(k, (acc.get(k) || 0) + v);

    if (chart.source === 'vendas') {
      const methodLabel = (key: string) =>
        methods.find(m => m.method_key === key)?.label
        || PAYMENT_METHODS.find(p => p.value === key)?.label
        || key;
      const brandLabel = (id: string | null) => brands.find(b => b.id === id)?.name || 'Sem bandeira';

      salesData
        .filter(s => monthSet.has(s.month) && Number(s.value) !== 0)
        .forEach(s => {
          const key = chart.group_by === 'mes' ? s.month
            : chart.group_by === 'bandeira' ? brandLabel(s.brand_id)
            : methodLabel(s.method_key);
          add(key, Number(s.value));
        });
    } else {
      const valid = orders.filter(o => o.status !== 'cancelado' && monthSet.has(o.order_date.slice(0, 7)));
      const orderById = new Map(valid.map(o => [o.id, o]));
      const channelName = (id: string | null) => channels.find(c => c.id === id)?.name || 'Sem canal';
      const methodName = (id: string | null) => saMethods.find(m => m.id === id)?.name || 'Sem forma';

      const orderKey = (o: typeof valid[number]) =>
        chart.group_by === 'mes' ? o.order_date.slice(0, 7)
        : chart.group_by === 'canal' ? channelName(o.channel_id)
        : chart.group_by === 'forma' ? methodName(o.payment_method_id)
        : null;

      if (chart.group_by === 'produto' || chart.metric === 'quantidade') {
        items
          .filter(i => orderById.has(i.order_id))
          .forEach(i => {
            const o = orderById.get(i.order_id)!;
            const key = chart.group_by === 'produto' ? (i.product_name || '—') : (orderKey(o) as string);
            const qty = Number(i.quantity);
            if (chart.metric === 'quantidade') add(key, qty);
            else if (chart.metric === 'lucro') add(key, (Number(i.unit_price) - Number(i.unit_cost)) * qty);
            else if (chart.metric === 'pedidos') add(key, 0);
            else add(key, Number(i.unit_price) * qty);
          });
        if (chart.metric === 'pedidos') {
          acc.clear();
          const seen = new Map<string, Set<string>>();
          items.filter(i => orderById.has(i.order_id)).forEach(i => {
            const o = orderById.get(i.order_id)!;
            const key = chart.group_by === 'produto' ? (i.product_name || '—') : (orderKey(o) as string);
            if (!seen.has(key)) seen.set(key, new Set());
            seen.get(key)!.add(o.id);
          });
          seen.forEach((set, key) => acc.set(key, set.size));
        }
      } else {
        valid.forEach(o => {
          const key = orderKey(o) as string;
          if (chart.metric === 'pedidos') add(key, 1);
          else if (chart.metric === 'lucro') {
            const frete = o.shipping_paid_by_customer ? 0 : Number(o.shipping);
            add(key, Number(o.gross_value) - Number(o.cost_total) - Number(o.fees) - frete);
          } else add(key, Number(o.gross_value));
        });
      }
    }

    let rows = [...acc.entries()].map(([name, value]) => ({ name, value }));
    if (chart.group_by === 'mes') {
      rows.sort((a, b) => a.name.localeCompare(b.name));
      rows = rows.map(r => ({ ...r, name: fmtMonth(r.name) }));
    } else {
      rows.sort((a, b) => b.value - a.value).slice(0, 12);
      rows = rows.slice(0, 12);
    }
    return rows.filter(r => r.value !== 0);
  }, [chart, salesData, methods, brands, orders, items, channels, saMethods, monthSet]);
}
