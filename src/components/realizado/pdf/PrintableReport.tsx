import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, Tooltip,
} from 'recharts';
import { CreditCard } from 'lucide-react';

interface Props {
  schoolId: string;
  theme: 'light' | 'dark';
  selectedMonth: string; // MM
  selectedYear: string;  // YYYY
  onReady: (element: HTMLDivElement, schoolName: string) => void;
}

// A4 page in CSS pixels at 96dpi: ~794 x 1123. We use 1000x1414 for higher DPI capture
const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1414;

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PALETTE = ['#10B981', '#F59E0B', '#0EA5E9', '#8B5CF6', '#EC4899', '#EF4444', '#14B8A6', '#F97316'];

export function PrintableReport({ schoolId, theme, selectedMonth, selectedYear, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const monthStr = `${selectedYear}-${selectedMonth}`;

  // ============ Data Fetching ============
  const { data: school, isLoading: l0 } = useQuery({
    queryKey: ['pdf_school', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('nome').eq('id', schoolId).single();
      return data;
    },
  });

  const { data: tabs = [], isLoading: l1 } = useQuery({
    queryKey: ['pdf_tabs', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('module_tabs').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const { data: expenses = [], isLoading: l2 } = useQuery({
    queryKey: ['pdf_expenses', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const { data: revenue = [], isLoading: l2b } = useQuery({
    queryKey: ['pdf_revenue', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('monthly_revenue').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const { data: sales = [], isLoading: l3 } = useQuery({
    queryKey: ['pdf_sales', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_data').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const { data: salesMethods = [], isLoading: l4 } = useQuery({
    queryKey: ['pdf_sales_methods', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId).eq('enabled', true);
      return data || [];
    },
  });

  const { data: cardBrands = [], isLoading: l5 } = useQuery({
    queryKey: ['pdf_brands'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_card_brands').select('*');
      return data || [];
    },
  });

  const { data: kpiDefs = [], isLoading: l6 } = useQuery({
    queryKey: ['pdf_kpi_defs', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_definitions').select('*').eq('school_id', schoolId).eq('enabled', true);
      return data || [];
    },
  });

  const { data: kpiValues = [], isLoading: l7 } = useQuery({
    queryKey: ['pdf_kpi_values', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_values').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const { data: kpiThresholds = [] } = useQuery({
    queryKey: ['pdf_kpi_thresholds', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_thresholds').select('*');
      return data || [];
    },
  });

  const { data: convData = [], isLoading: l8 } = useQuery({
    queryKey: ['pdf_conv', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('conversion_data').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['pdf_accounts', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId);
      return data || [];
    },
  });

  const isLoading = l0 || l1 || l2 || l2b || l3 || l4 || l5 || l6 || l7 || l8;

  // ============ Visibility ============
  const visibility = { relatorio: true, indicadores: true, conversao: true, vendas: true };
  tabs.forEach((t: any) => {
    if (t.tab_key in visibility) (visibility as any)[t.tab_key] = t.enabled;
  });

  // ============ Derived data ============
  const monthExpenses = useMemo(
    () => expenses.filter((e: any) => e.data && e.data.startsWith(monthStr)),
    [expenses, monthStr]
  );
  const totalExpenses = monthExpenses.reduce((a: number, b: any) => a + Number(b.valor), 0);

  const monthRevenue = useMemo(() => {
    const r = revenue.find((x: any) => x.month === monthStr);
    return r ? Number(r.value) : 0;
  }, [revenue, monthStr]);

  const monthSales = useMemo(() => sales.filter((s: any) => s.month === monthStr), [sales, monthStr]);
  const totalSales = monthSales.reduce((a: number, b: any) => a + Number(b.value), 0);

  // Expenses grouped by parent category (mãe)
  const expensesByCategory = useMemo(() => {
    const accMap = new Map<string, any>(accounts.map((a: any) => [a.id, a]));
    const groups: Record<string, number> = {};
    monthExpenses.forEach((e: any) => {
      const acc = e.conta_id ? accMap.get(e.conta_id) : null;
      let parentName = 'Outros';
      if (acc) {
        if (acc.pai_id) {
          const parent = accMap.get(acc.pai_id);
          parentName = parent?.nome || acc.nome;
        } else {
          parentName = acc.nome;
        }
      } else if (e.conta_nome) {
        parentName = e.conta_nome;
      }
      groups[parentName] = (groups[parentName] || 0) + Number(e.valor);
    });
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses, accounts]);

  // Sales grouped by method
  const salesByMethod = useMemo(() => {
    const acc: Record<string, number> = {};
    salesMethods.forEach((sm: any) => (acc[sm.method_key] = 0));
    monthSales.forEach((s: any) => {
      let base = s.method_key;
      if (s.method_key.startsWith('brand-')) base = s.method_key.includes('debito') ? 'debito' : 'credito';
      acc[base] = (acc[base] || 0) + Number(s.value);
    });
    return Object.entries(acc)
      .map(([key, val]) => {
        const label = salesMethods.find((m: any) => m.method_key === key)?.label || key;
        return { name: label, value: val, key };
      })
      .filter((x) => x.value > 0);
  }, [monthSales, salesMethods]);

  const salesBrandsTotal = useMemo(() => {
    const acc: Record<string, number> = {};
    monthSales.forEach((s: any) => {
      if (s.method_key.startsWith('brand-')) {
        acc[s.brand_id || ''] = (acc[s.brand_id || ''] || 0) + Number(s.value);
      }
    });
    return Object.entries(acc)
      .map(([brandId, val]) => {
        const b = cardBrands.find((cb: any) => cb.id === brandId);
        return { id: brandId, name: b?.name || brandId, value: val, icon: b?.icon_url };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthSales, cardBrands]);

  // Conversion (last 12 months)
  const convTrend = useMemo(() => {
    const sorted = [...convData].sort((a: any, b: any) => a.month.localeCompare(b.month)).slice(-12);
    return sorted.map((c: any) => ({
      name: c.month.split('-')[1] + '/' + c.month.split('-')[0].slice(2),
      Contatos: c.contatos,
      Matriculas: c.matriculas,
      Conversao: c.contatos > 0 ? Number(((c.matriculas / c.contatos) * 100).toFixed(1)) : 0,
    }));
  }, [convData]);

  const monthConv = useMemo(() => {
    const m = convData.find((c: any) => c.month === monthStr);
    if (!m) return null;
    return {
      contatos: m.contatos,
      matriculas: m.matriculas,
      taxa: m.contatos > 0 ? (m.matriculas / m.contatos) * 100 : 0,
    };
  }, [convData, monthStr]);

  // Helper for KPI variation
  const getKpiVariation = (defId: string) => {
    const sorted = kpiValues
      .filter((v: any) => v.kpi_definition_id === defId)
      .sort((a: any, b: any) => a.month.localeCompare(b.month));
    const currentIdx = sorted.findIndex((v: any) => v.month === monthStr);
    if (currentIdx <= 0) return null;
    const curr = Number(sorted[currentIdx].value);
    const prev = Number(sorted[currentIdx - 1].value);
    if (prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  // ============ Trigger onReady when ready ============
  useEffect(() => {
    if (!isLoading && ref.current) {
      const t = setTimeout(() => {
        onReady(ref.current!, school?.nome || 'Escola');
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [isLoading, onReady, school]);

  if (isLoading) return null;

  // ============ Theme tokens ============
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0B1120' : '#FFFFFF',
    surface: isDark ? '#111827' : '#F9FAFB',
    surface2: isDark ? '#1F2937' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    muted: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#1E293B' : '#E5E7EB',
    primary: '#0EA5A4', // teal
    accent: '#F59E0B', // orange
    success: '#10B981',
    danger: '#EF4444',
  };

  // ============ Reusable styles ============
  const pageStyle: React.CSSProperties = {
    width: `${PAGE_WIDTH}px`,
    minHeight: `${PAGE_HEIGHT}px`,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    padding: '60px 70px',
    boxSizing: 'border-box',
    position: 'relative',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 24px 0',
    paddingBottom: '12px',
    borderBottom: `3px solid ${colors.primary}`,
    color: colors.text,
    display: 'inline-block',
  };

  const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '20px',
    ...extra,
  });

  const Header = (
    <div
      style={{
        borderBottom: `2px solid ${colors.primary}`,
        paddingBottom: '24px',
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: colors.accent,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '4px',
          }}
        >
          Relatório Realizado
        </div>
        <h1 style={{ fontSize: '34px', fontWeight: 800, margin: 0, color: colors.text, lineHeight: 1.1 }}>
          {school?.nome || 'Escola'}
        </h1>
        <div style={{ fontSize: '15px', color: colors.muted, marginTop: '6px' }}>
          Período: {format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: '999px',
            background: `${colors.primary}20`,
            color: colors.primary,
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          Conta Muito
        </div>
        <div style={{ fontSize: '11px', color: colors.muted, marginTop: '8px' }}>
          Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </div>
      </div>
    </div>
  );

  const Footer = (idx: number, total: number) => (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '70px',
        right: '70px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: colors.muted,
        borderTop: `1px solid ${colors.border}`,
        paddingTop: '10px',
      }}
    >
      <span>{school?.nome || ''} · Relatório Realizado</span>
      <span>Página {idx} de {total}</span>
    </div>
  );

  // ============ Build pages ============
  const pageNodes: React.ReactNode[] = [];

  // ----- PAGE 1: Resumo Executivo + Despesas por categoria -----
  pageNodes.push(
    <div className="pdf-page" key="p1" style={pageStyle}>
      {Header}

      <h3 style={sectionTitle}>Resumo Executivo</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={card({ borderLeft: `4px solid ${colors.success}` })}>
          <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', fontWeight: 500 }}>FATURAMENTO</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: colors.success }}>{fmtBRL(monthRevenue)}</div>
        </div>
        <div style={card({ borderLeft: `4px solid ${colors.danger}` })}>
          <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', fontWeight: 500 }}>DESPESAS</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: colors.danger }}>{fmtBRL(totalExpenses)}</div>
        </div>
        <div style={card({ borderLeft: `4px solid ${colors.primary}` })}>
          <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', fontWeight: 500 }}>RESULTADO</div>
          <div
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: monthRevenue - totalExpenses >= 0 ? colors.success : colors.danger,
            }}
          >
            {fmtBRL(monthRevenue - totalExpenses)}
          </div>
        </div>
      </div>

      <h3 style={sectionTitle}>Análise de Despesas</h3>
      {expensesByCategory.length === 0 ? (
        <div style={{ ...card(), textAlign: 'center', color: colors.muted, padding: '40px' }}>
          Sem dados de despesas no período.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={card({ height: '380px' })}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Distribuição por Categoria
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={expensesByCategory.slice(0, 8)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  isAnimationActive={false}
                  label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expensesByCategory.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconSize={10}
                  wrapperStyle={{ fontSize: '11px', color: colors.text, paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={card()}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Top Categorias</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: colors.muted, fontWeight: 600 }}>Categoria</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: colors.muted, fontWeight: 600 }}>Valor</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: colors.muted, fontWeight: 600 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {expensesByCategory.slice(0, 10).map((c, i) => (
                  <tr key={c.name} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '2px',
                          background: PALETTE[i % PALETTE.length],
                          display: 'inline-block',
                        }}
                      />
                      {c.name}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{fmtBRL(c.value)}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: colors.muted }}>
                      {totalExpenses > 0 ? ((c.value / totalExpenses) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Footer(1, 0)}
    </div>
  );

  // ----- PAGE 2: Indicadores -----
  if (visibility.indicadores) {
    const enabledKpis = kpiDefs.filter((d: any) =>
      kpiValues.some((v: any) => v.kpi_definition_id === d.id)
    );
    pageNodes.push(
      <div className="pdf-page" key="p2" style={pageStyle}>
        {Header}
        <h3 style={sectionTitle}>Indicadores Chave (KPIs)</h3>
        {enabledKpis.length === 0 ? (
          <div style={{ ...card(), textAlign: 'center', color: colors.muted, padding: '40px' }}>
            Sem indicadores cadastrados.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {enabledKpis.map((def: any) => {
              const kv = kpiValues.find((v: any) => v.kpi_definition_id === def.id && v.month === monthStr);
              const variation = getKpiVariation(def.id);
              const value = kv ? Number(kv.value) : null;
              const formatted =
                value === null
                  ? '—'
                  : def.value_type === 'currency'
                  ? fmtBRL(value)
                  : def.value_type === 'percent'
                  ? `${value.toLocaleString('pt-BR')}%`
                  : value.toLocaleString('pt-BR');

              // Threshold color
              const thresholds = kpiThresholds.filter((t: any) => t.kpi_definition_id === def.id);
              let thresholdColor = colors.primary;
              let thresholdLabel = '';
              if (value !== null) {
                const match = thresholds.find((t: any) => {
                  const okMin = t.min_value === null || value >= Number(t.min_value);
                  const okMax = t.max_value === null || value <= Number(t.max_value);
                  return okMin && okMax;
                });
                if (match) {
                  thresholdColor = match.color;
                  thresholdLabel = match.label;
                }
              }

              return (
                <div key={def.id} style={card({ borderLeft: `4px solid ${thresholdColor}` })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '13px', color: colors.muted, fontWeight: 600 }}>{def.name}</div>
                    {thresholdLabel && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: `${thresholdColor}20`,
                          color: thresholdColor,
                        }}
                      >
                        {thresholdLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: colors.text }}>
                    {formatted}
                  </div>
                  {variation !== null && (
                    <div
                      style={{
                        fontSize: '12px',
                        marginTop: '6px',
                        color: variation >= 0 ? colors.success : colors.danger,
                        fontWeight: 600,
                      }}
                    >
                      {variation >= 0 ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}% vs mês anterior
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {Footer(2, 0)}
      </div>
    );
  }

  // ----- PAGE 3: Conversão -----
  if (visibility.conversao && convData.length > 0) {
    pageNodes.push(
      <div className="pdf-page" key="p3" style={pageStyle}>
        {Header}
        <h3 style={sectionTitle}>Equipe & Conversão</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={card({ borderLeft: `4px solid ${colors.primary}` })}>
            <div style={{ fontSize: '12px', color: colors.muted, fontWeight: 600 }}>CONTATOS</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: colors.primary, marginTop: '6px' }}>
              {monthConv?.contatos ?? '—'}
            </div>
          </div>
          <div style={card({ borderLeft: `4px solid ${colors.accent}` })}>
            <div style={{ fontSize: '12px', color: colors.muted, fontWeight: 600 }}>MATRÍCULAS</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: colors.accent, marginTop: '6px' }}>
              {monthConv?.matriculas ?? '—'}
            </div>
          </div>
          <div style={card({ borderLeft: `4px solid ${colors.success}` })}>
            <div style={{ fontSize: '12px', color: colors.muted, fontWeight: 600 }}>TAXA DE CONVERSÃO</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: colors.success, marginTop: '6px' }}>
              {monthConv ? `${monthConv.taxa.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>

        <div style={card({ height: '380px' })}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Evolução nos Últimos Meses
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={convTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 11 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 11 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: colors.text }} />
              <Bar yAxisId="left" dataKey="Contatos" fill={colors.primary} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar yAxisId="left" dataKey="Matriculas" fill={colors.accent} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="Conversao"
                stroke={colors.success}
                strokeWidth={3}
                dot={{ r: 4, fill: colors.success }}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {Footer(3, 0)}
      </div>
    );
  }

  // ----- PAGE 4: Vendas -----
  if (visibility.vendas && (totalSales > 0 || salesByMethod.length > 0)) {
    pageNodes.push(
      <div className="pdf-page" key="p4" style={pageStyle}>
        {Header}
        <h3 style={sectionTitle}>Vendas e Receitas</h3>

        <div style={card({ marginBottom: '20px', borderLeft: `4px solid ${colors.success}` })}>
          <div style={{ fontSize: '12px', color: colors.muted, fontWeight: 600 }}>TOTAL DE VENDAS NO MÊS</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: colors.success, marginTop: '6px' }}>
            {fmtBRL(totalSales)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={card({ height: '340px' })}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Por Forma de Pagamento</div>
            {salesByMethod.length === 0 ? (
              <div style={{ color: colors.muted, fontSize: '12px' }}>Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="88%">
                <PieChart>
                  <Pie
                    data={salesByMethod}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={50}
                    isAnimationActive={false}
                    label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {salesByMethod.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '11px', color: colors.text }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={card()}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Por Bandeira de Cartão</div>
            {salesBrandsTotal.length === 0 ? (
              <div style={{ color: colors.muted, fontSize: '12px' }}>Sem detalhamento por bandeira.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {salesBrandsTotal.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: colors.surface,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {b.icon ? (
                        <img
                          src={b.icon}
                          alt={b.name}
                          crossOrigin="anonymous"
                          style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      ) : (
                        <CreditCard size={24} color={colors.primary} />
                      )}
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{b.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: colors.text }}>{fmtBRL(b.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {Footer(4, 0)}
      </div>
    );
  }

  // Recompute footer numbers (replace 0 with total)
  const total = pageNodes.length;
  const finalNodes = pageNodes.map((node, i) => {
    if (!node || typeof node !== 'object' || !('props' in (node as any))) return node;
    const n = node as any;
    const newChildren = (n.props.children as any[]).map((c: any) => {
      if (c && c.props && c.props.style?.position === 'absolute' && c.props.style?.bottom === '24px') {
        return Footer(i + 1, total);
      }
      return c;
    });
    return { ...n, props: { ...n.props, children: newChildren } };
  });

  return (
    <div ref={ref} style={{ background: colors.bg }}>
      {finalNodes}
    </div>
  );
}
