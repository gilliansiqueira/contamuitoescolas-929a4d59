import { useMemo } from 'react';
import { useSAOrders, useSAOrderItems, useSAProducts } from '../analise-vendas/useAnaliseVendasData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, Cell,
} from 'recharts';

const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CHART_COLORS = ['#ea384c', '#0EA5E9', '#F59E0B', '#10B981', '#8B5CF6', '#64748B', '#EC4899', '#14B8A6', '#F97316'];
const TOP_N = 8;

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatMonthShort(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTHS_LABELS[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
}

interface Props {
  schoolId: string;
  selectedMonths: string[];
}

export function VendasProdutosCharts({ schoolId, selectedMonths }: Props) {
  const { data: orders = [] } = useSAOrders(schoolId);
  const { data: items = [] } = useSAOrderItems(schoolId);
  const { data: products = [] } = useSAProducts(schoolId);

  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);

  const validOrders = useMemo(() => orders.filter(o => o.status !== 'cancelado'), [orders]);
  const validOrderIds = useMemo(() => new Set(validOrders.map(o => o.id)), [validOrders]);
  const validItems = useMemo(() => items.filter(i => validOrderIds.has(i.order_id)), [items, validOrderIds]);

  const orderDateMap = useMemo(() => {
    const m = new Map<string, string>();
    validOrders.forEach(o => m.set(o.id, o.order_date));
    return m;
  }, [validOrders]);

  // Product icon by name (for potential future use in tooltips)
  const _productIconMap = useMemo(() => {
    const m = new Map<string, string | null>();
    products.forEach(p => m.set(p.name.toLowerCase(), p.icon_url));
    return m;
  }, [products]);

  // === Ranking de produtos (aggregated across selected months) ===
  const rankingData = useMemo(() => {
    const monthItems = validItems.filter(i => {
      const dt = orderDateMap.get(i.order_id);
      if (!dt) return false;
      return selectedSet.has(dt.slice(0, 7));
    });

    const revenueByProduct = new Map<string, number>();
    monthItems.forEach(it => {
      const key = it.product_name || '—';
      const rev = Number(it.unit_price) * Number(it.quantity);
      revenueByProduct.set(key, (revenueByProduct.get(key) || 0) + rev);
    });

    const sorted = [...revenueByProduct.entries()].sort((a, b) => b[1] - a[1]);

    let result: [string, number][];
    if (sorted.length > TOP_N) {
      const top = sorted.slice(0, TOP_N - 1);
      const outrosValue = sorted.slice(TOP_N - 1).reduce((s, [, v]) => s + v, 0);
      result = [...top, ['Outros', outrosValue]];
    } else {
      result = sorted;
    }

    // Reverse so #1 product appears at top of horizontal bar chart
    return result.reverse().map(([name, value]) => ({ name, value }));
  }, [validItems, orderDateMap, selectedSet]);

  // === Participação por produto (stacked area, all months with data) ===
  const { areaData, areaProducts, areaTotals } = useMemo(() => {
    const monthProductRev = new Map<string, Map<string, number>>();

    validItems.forEach(it => {
      const dt = orderDateMap.get(it.order_id);
      if (!dt) return;
      const month = dt.slice(0, 7);
      if (!monthProductRev.has(month)) monthProductRev.set(month, new Map());
      const pm = monthProductRev.get(month)!;
      const key = it.product_name || '—';
      const rev = Number(it.unit_price) * Number(it.quantity);
      pm.set(key, (pm.get(key) || 0) + rev);
    });

    const allMonths = [...monthProductRev.keys()].sort();

    // Determine top products across ALL data
    const totalRevByProduct = new Map<string, number>();
    monthProductRev.forEach(pm => {
      pm.forEach((rev, name) => {
        totalRevByProduct.set(name, (totalRevByProduct.get(name) || 0) + rev);
      });
    });
    const topProducts = [...totalRevByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N - 1)
      .map(([n]) => n);
    const topSet = new Set(topProducts);

    // Build chart rows
    const data = allMonths.map(month => {
      const pm = monthProductRev.get(month) || new Map();
      const row: Record<string, string | number> = { month: formatMonthShort(month) };
      topProducts.forEach(name => { row[name] = pm.get(name) || 0; });
      let outros = 0;
      pm.forEach((rev, name) => { if (!topSet.has(name)) outros += rev; });
      row['Outros'] = outros;
      return row;
    });

    const allProducts = [...topProducts, 'Outros'];
    const totals: Record<string, number> = {};
    allProducts.forEach(p => { totals[p] = 0; });
    data.forEach(row => {
      allProducts.forEach(p => { totals[p] += Number(row[p]) || 0; });
    });

    return { areaData: data, areaProducts: allProducts, areaTotals: totals };
  }, [validItems, orderDateMap]);

  // No Análise de Vendas data at all → hide section entirely
  if (orders.length === 0) return null;

  // Has orders but no product data in the selected period
  const hasRankingData = rankingData.some(d => d.value > 0);

  if (!hasRankingData) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        <p className="text-sm">Nenhum pedido com produtos no período selecionado.</p>
        <p className="text-xs mt-1">Cadastre pedidos na aba <strong>Análise de Vendas</strong> para visualizar os gráficos de produto.</p>
      </div>
    );
  }

  const monthLabel = selectedMonths.length === 0
    ? ''
    : selectedMonths.length === 1
      ? formatMonthShort(selectedMonths[0])
      : `${formatMonthShort(selectedMonths[0])} – ${formatMonthShort(selectedMonths[selectedMonths.length - 1])} (${selectedMonths.length} meses)`;

  return (
    <div className="space-y-6">
      {/* Section divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Análise por Produto</span>
        <span className="text-xs text-muted-foreground/70">dados da aba Análise de Vendas</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Ranking de Produtos */}
      <div className="glass-card p-6 rounded-xl">
        <h4 className="text-sm font-semibold mb-1">Ranking de Produtos por Faturamento</h4>
        <p className="text-xs text-muted-foreground mb-4">{monthLabel} — top {TOP_N - 1} + Outros</p>
        <div style={{ width: '100%', height: Math.max(280, rankingData.length * 42) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={150}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(v: number) => fmtBRL(v)}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {rankingData.map((entry, i) => (
                  <Cell key={i} fill={entry.name === 'Outros' ? '#94A3B8' : CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Participação por Produto (stacked area) */}
      {areaData.length >= 2 && (
        <div className="glass-card p-6 rounded-xl">
          <h4 className="text-sm font-semibold mb-1">Participação por Produto ao Longo do Tempo</h4>
          <p className="text-xs text-muted-foreground mb-4">Composição do faturamento por produto (área empilhada)</p>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {areaProducts.map((name, i) => (
                    <linearGradient key={name} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? '0' : `R$${v / 1000}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, marginTop: 10 }}
                  formatter={(value: string) => `${value} — ${fmtBRL(areaTotals[value] || 0)}`}
                />
                {areaProducts.map((name, i) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="1"
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={`url(#grad-${i})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
