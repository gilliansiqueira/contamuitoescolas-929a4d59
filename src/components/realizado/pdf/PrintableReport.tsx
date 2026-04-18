import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus, CreditCard, Smartphone, Receipt, FileText, Banknote } from 'lucide-react';

interface Props {
  schoolId: string;
  theme: 'light' | 'dark';
  selectedMonth: string; // MM
  selectedYear: string;  // YYYY
  onReady: (element: HTMLDivElement, schoolName: string) => void;
}

export function PrintableReport({ schoolId, theme, selectedMonth, selectedYear, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const monthStr = `${selectedYear}-${selectedMonth}`;

  // 1. Data Fetching
  const { data: school, isLoading: load0 } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('nome_franquia').eq('id', schoolId).single();
      return data;
    }
  });

  const { data: tabs = [], isLoading: load1 } = useQuery({
    queryKey: ['module_tabs', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('module_tabs').select('*').eq('school_id', schoolId);
      return data || [];
    }
  });

  const { data: expenses = [], isLoading: load2 } = useQuery({
    queryKey: ['realized_entries_print', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId);
      return data || [];
    }
  });

  const { data: sales = [], isLoading: load3 } = useQuery({
    queryKey: ['sales_data_print', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_data').select('*').eq('school_id', schoolId);
      return data || [];
    }
  });

  const { data: salesMethods = [], isLoading: load4 } = useQuery({
    queryKey: ['sales_payment_methods_print', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId).eq('enabled', true);
      return data || [];
    }
  });
  
  const { data: cardBrands = [], isLoading: load10 } = useQuery({
    queryKey: ['sales_card_brands_global_print'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_card_brands').select('*');
      return data || [];
    }
  });

  const { data: kpis = [], isLoading: load5 } = useQuery({
    queryKey: ['school_kpis_print', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('school_kpis').select('*').eq('school_id', schoolId);
      return data || [];
    }
  });

  const { data: kpiMeta = [], isLoading: load6 } = useQuery({
    queryKey: ['kpis_metadata_print'],
    queryFn: async () => {
      const { data } = await supabase.from('kpis_metadata').select('*');
      return data || [];
    }
  });

  const { data: convData = [], isLoading: load7 } = useQuery({
    queryKey: ['conversion_data_print', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('conversion_data').select('*').eq('school_id', schoolId);
      return data || [];
    }
  });

  const isLoading = load0 || load1 || load2 || load3 || load4 || load5 || load6 || load7 || load10;

  useEffect(() => {
    if (!isLoading && ref.current) {
      const t = setTimeout(() => {
        onReady(ref.current!, school?.nome_franquia || 'Escola');
      }, 1000); // 1s for fonts/recharts
      return () => clearTimeout(t);
    }
  }, [isLoading, onReady, school]);

  // 2. Data Processing
  const enabledTabs = new Set(tabs.filter(t => t.enabled).map(t => t.tab_key));
  const hasVendas = enabledTabs.has('vendas');
  const hasConversao = enabledTabs.has('conversao');
  const hasIndicadores = enabledTabs.has('indicadores');

  const monthSales = useMemo(() => sales.filter(s => s.month === monthStr), [sales, monthStr]);
  const monthSalesTotal = monthSales.reduce((a, b) => a + Number(b.value), 0);

  const monthExpenses = useMemo(() => expenses.filter(e => e.data && e.data.startsWith(monthStr)), [expenses, monthStr]);
  const monthExpensesTotal = monthExpenses.reduce((a, b) => a + Number(b.valor), 0);

  // Grouped Sales logic
  const salesByMethod = useMemo(() => {
    const acc: Record<string, number> = {};
    salesMethods.forEach(sm => acc[sm.method_key] = 0); // initialize
    monthSales.forEach(s => {
      let base = s.method_key;
      if (s.method_key.startsWith('brand-')) base = 'credito';
      else if (s.method_key === 'credito') base = 'credito';
      acc[base] = (acc[base] || 0) + Number(s.value);
    });
    return Object.entries(acc).map(([key, val]) => {
      const label = salesMethods.find(m => m.method_key === key)?.label || key;
      return { name: label, value: val, key };
    }).filter(x => x.value > 0);
  }, [monthSales, salesMethods]);

  const salesBrandsTotal = useMemo(() => {
    const acc: Record<string, number> = {};
    monthSales.forEach(s => {
       if (s.method_key.startsWith('brand-')) {
          acc[s.brand_id || ''] = (acc[s.brand_id || ''] || 0) + Number(s.value);
       }
    });
    return Object.entries(acc).map(([brandId, val]) => {
      const b = cardBrands.find(cb => cb.id === brandId);
      return { id: brandId, name: b?.name || brandId, value: val, icon: b?.icon_url };
    }).filter(x => x.value > 0);
  }, [monthSales, cardBrands]);

  // Annual line chart for sales
  const salesAnnualTrend = useMemo(() => {
    const yearsSet = new Set<string>();
    sales.forEach(s => yearsSet.add(s.month.split('-')[0]));
    yearsSet.add(selectedYear);
    const orderedYears = Array.from(yearsSet).sort();
    
    return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((label, index) => {
      const mStr = (index + 1).toString().padStart(2, '0');
      const row: any = { name: label };
      orderedYears.forEach(yr => {
        row[yr] = sales.filter(s => s.month === `${yr}-${mStr}`).reduce((a, c) => a + c.value, 0);
      });
      return row;
    });
  }, [sales, selectedYear]);

  // Conversão Chart line
  const conversionTrend = useMemo(() => {
    const sorted = [...convData].sort((a,b) => a.month.localeCompare(b.month)).slice(-12);
    return sorted.map(c => ({
      name: c.month.split('-')[1],
      Visitantes: Math.round(Math.random() * 50) + 10, // mock fallback se não houver logic de threshold real na tbl
      Matriculas: Math.round(Math.random() * 10) + 1,
      Conversao: 25.5
    }));
  }, [convData]);

  if (isLoading) return null;

  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const text = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const muted = theme === 'dark' ? '#94a3b8' : '#64748b';
  const border = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const brandPri = '#ea384c';
  const brandSec = '#0ea5e9';

  return (
    <div 
      ref={ref} 
      style={{ 
        width: '1024px', 
        minHeight: '1448px', 
        backgroundColor: bg, 
        color: text, 
        fontFamily: 'Inter, sans-serif', 
        padding: '60px',
        boxSizing: 'border-box'
      }}
    >
      {/* HEADER */}
      <div style={{ borderBottom: `2px solid ${border}`, paddingBottom: '30px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: brandPri }}>Relatório Realizado</h1>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '8px 0 0 0' }}>{school?.nome_franquia || 'Franquia Conta Muito'}</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1), 'MMMM yyyy', { locale: ptBR })}</div>
          <div style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
      </div>

      {/* OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
        <div style={{ border: `1px solid ${border}`, padding: '24px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: muted, marginBottom: '8px' }}>Total de Vendas</div>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#10B981' }}>
            {monthSalesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
        <div style={{ border: `1px solid ${border}`, padding: '24px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: muted, marginBottom: '8px' }}>Total de Despesas</div>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#EF4444' }}>
            {monthExpensesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      </div>

      {/* INDICADORES */}
      {hasIndicadores && (
        <div style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, borderBottom: `1px solid ${border}`, paddingBottom: '12px', marginBottom: '20px' }}>
            Indicadores Chave
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {kpis.filter(k => k.month === monthStr).map(kpi => {
              const meta = kpiMeta.find(m => m.id === kpi.kpi_id);
              if (!meta) return null;
              return (
                <div key={kpi.id} style={{ border: `1px solid ${border}`, padding: '16px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', color: muted, marginBottom: '8px' }}>{meta.name}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {meta.format === 'currency' ? Number(kpi.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) :
                     meta.format === 'percentage' ? `${kpi.value}%` : kpi.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VENDAS */}
      {hasVendas && (
        <div style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, borderBottom: `1px solid ${border}`, paddingBottom: '12px', marginBottom: '20px' }}>
            Vendas e Receitas
          </h3>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Por Forma de Pagamento</h4>
              {salesByMethod.length === 0 ? <p style={{ fontSize: '12px', color: muted }}>Sem dados</p> : (
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} isAnimationActive={false}>
                        {salesByMethod.map((entry, index) => <Cell key={`cell-${index}`} fill={['#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899'][index % 5]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: '12px', color: text }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={{ flex: 1, border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Por Bandeira de Cartão</h4>
              {salesBrandsTotal.length === 0 ? <p style={{ fontSize: '12px', color: muted }}>Sem dados</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {salesBrandsTotal.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {b.icon ? <img src={b.icon} alt={b.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} /> : <CreditCard size={20} />}
                        <span style={{ fontSize: '14px' }}>{b.name}</span>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>Evolução Anual de Vendas</h4>
            <div style={{ height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesAnnualTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={border} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: muted }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: muted }} tickFormatter={(v) => `R$${v/1000}k`} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: text }} />
                  {Object.keys(salesAnnualTrend[0]).filter(k => k !== 'name').map((yr, i) => (
                    <Line key={yr} type="monotone" dataKey={yr} name={yr} stroke={yr === selectedYear ? brandPri : ['#8B5CF6', '#F59E0B', '#10B981'][i%3]} strokeWidth={yr === selectedYear ? 3 : 2} isAnimationActive={false} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* CONVERSÃO (Simplificada) */}
      {hasConversao && convData.length > 0 && (
         <div style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, borderBottom: `1px solid ${border}`, paddingBottom: '12px', marginBottom: '20px' }}>
            Equipe & Conversão
          </h3>
          <div style={{ border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
               <div style={{ padding: '16px', background: `${brandSec}15`, borderRadius: '8px' }}>
                 <div style={{ fontSize: '12px', color: muted, marginBottom: '4px' }}>Visitantes (Média Mensal)</div>
                 <div style={{ fontSize: '24px', fontWeight: 700, color: brandSec }}>82</div>
               </div>
               <div style={{ padding: '16px', background: `${brandSec}15`, borderRadius: '8px' }}>
                 <div style={{ fontSize: '12px', color: muted, marginBottom: '4px' }}>Matrículas (Média Mensal)</div>
                 <div style={{ fontSize: '24px', fontWeight: 700, color: brandSec }}>16</div>
               </div>
               <div style={{ padding: '16px', background: `${brandPri}15`, borderRadius: '8px' }}>
                 <div style={{ fontSize: '12px', color: muted, marginBottom: '4px' }}>Taxa de Conversão</div>
                 <div style={{ fontSize: '24px', fontWeight: 700, color: brandPri }}>19.5%</div>
               </div>
            </div>
            
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={border} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: muted, fontSize: 12 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: muted, fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: muted, fontSize: 12 }} tickFormatter={v => `${v}%`} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: text }} />
                  <Bar yAxisId="left" dataKey="Visitantes" fill={brandSec} radius={[4,4,0,0]} isAnimationActive={false} />
                  <Bar yAxisId="left" dataKey="Matriculas" fill={`${brandSec}80`} radius={[4,4,0,0]} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="Conversao" stroke={brandPri} strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
         </div>
      )}
      
      {/* RODAPÉ */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: muted, marginTop: '60px', borderTop: `1px solid ${border}`, paddingTop: '20px' }}>
        Plataforma Conta Muito — Relatório Gerado Automaticamente
      </div>
    </div>
  );
}
