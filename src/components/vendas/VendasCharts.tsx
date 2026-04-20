import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalesData, SalesCardBrand, PAYMENT_METHODS } from './vendas-types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { CreditCard, Smartphone, Receipt, FileText, Banknote, HelpCircle } from 'lucide-react';

interface Props {
  data: SalesData[];
  selectedMonthStr: string; // YYYY-MM format
  selectedYearStr: string;
}

const COLORS = ['#ea384c', '#0EA5E9', '#F59E0B', '#10B981', '#8B5CF6', '#64748B'];
const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const METHODS_WITH_BRANDS = new Set(['credito', 'debito']);

export function VendasCharts({ data, selectedMonthStr, selectedYearStr }: Props) {
  // Card brands (used to render brand-level summary)
  const { data: cardBrands = [] } = useQuery({
    queryKey: ['sales_card_brands'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_card_brands').select('*').order('sort_order');
      return (data || []) as SalesCardBrand[];
    },
  });

  // Dados do mês específico para o PieChart e Cards
  const monthData = useMemo(() => data.filter(s => s.month === selectedMonthStr), [data, selectedMonthStr]);
  const monthTotal = monthData.reduce((acc, curr) => acc + curr.value, 0);

  // Agrupamento por forma de pagamento no mês selecionado
  // Mapeia method_key (credito, debito, pix...). Trata 'brand-<id>' (legado) como crédito.
  const byMethod = useMemo(() => {
    const acc: Record<string, number> = {};
    monthData.forEach(item => {
      let baseMethod = item.method_key;
      if (baseMethod.startsWith('brand-')) baseMethod = 'credito';
      acc[baseMethod] = (acc[baseMethod] || 0) + item.value;
    });
    return Object.keys(acc).map(key => {
      const pmLabel = PAYMENT_METHODS.find(pm => pm.value === key)?.label || key;
      return { name: pmLabel, value: acc[key], method: key };
    }).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [monthData]);

  // Agrupamento por bandeira no mês (soma crédito + débito)
  const byBrand = useMemo(() => {
    const acc: Record<string, number> = {};
    monthData.forEach(item => {
      if (!item.brand_id) return;
      acc[item.brand_id] = (acc[item.brand_id] || 0) + item.value;
    });
    return Object.entries(acc)
      .map(([brand_id, value]) => {
        const brand = cardBrands.find(b => b.id === brand_id);
        return {
          brand_id,
          name: brand?.name || 'Bandeira',
          icon_url: brand?.icon_url || null,
          value,
        };
      })
      .filter(b => b.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthData, cardBrands]);

  // Evolução anual para o LineChart (Todos os anos com dados)
  const annualTrend = useMemo(() => {
    // Identificar todos os anos que existem nos dados + o ano selecionado
    const yearsSet = new Set<string>();
    data.forEach(s => yearsSet.add(s.month.split('-')[0]));
    yearsSet.add(selectedYearStr);
    const orderedYears = Array.from(yearsSet).sort();

    return MONTHS_LABELS.map((label, index) => {
      const mStr = (index + 1).toString().padStart(2, '0');
      const row: any = { name: label };
      
      orderedYears.forEach(yr => {
        const monthFilter = `${yr}-${mStr}`;
        const totalMes = data.filter(s => s.month === monthFilter).reduce((acc, curr) => acc + curr.value, 0);
        // Só renderiza a linha se o ano já aconteceu até este mês (ou mostra zero). Retornar undefined quebra a linha, vamos retornar o valor ou 0.
        row[yr] = totalMes;
      });
      return row;
    });
  }, [data, selectedYearStr]);

  const activeYears = Object.keys(annualTrend[0]).filter(k => k !== 'name');
  const LINE_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#ea384c', '#0EA5E9'];

  const getIcon = (method: string) => {
    switch (method) {
      case 'credito': return <CreditCard className="w-5 h-5 text-primary" />;
      case 'debito': return <CreditCard className="w-5 h-5 text-primary" />;
      case 'pix': return <Smartphone className="w-5 h-5 text-primary" />;
      case 'boleto': return <FileText className="w-5 h-5 text-primary" />;
      case 'cheque': return <Receipt className="w-5 h-5 text-primary" />;
      case 'dinheiro': return <Banknote className="w-5 h-5 text-primary" />;
      default: return <HelpCircle className="w-5 h-5 text-primary" />;
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const monthLabel = MONTHS_LABELS[parseInt(selectedMonthStr.split('-')[1], 10) - 1];

  if (monthTotal === 0 && annualTrend.every(m => m.Total === 0)) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        Nenhum dado de venda registrado para {monthLabel} de {selectedYearStr}. 
        Preencha os valores na tabela abaixo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 rounded-xl flex flex-col justify-center relative overflow-hidden bg-primary/5 border-primary/20">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Total de Vendas ({monthLabel})</h4>
          <p className="text-3xl font-display font-bold text-primary">{formatCurrency(monthTotal)}</p>
        </div>

        <div className="glass-card p-6 rounded-xl col-span-2 md:col-span-2">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Resumo por Forma de Pagamento no Mês</h4>
          {byMethod.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {byMethod.map(item => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-full border border-border">
                    {getIcon(item.method)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                    <p className="font-semibold text-sm">{formatCurrency(item.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem vendas registradas neste mês.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-4 rounded-xl min-h-[300px] flex flex-col">
          <h4 className="text-sm font-semibold mb-4 ml-2">Participação ({monthLabel})</h4>
          <div className="flex-1 w-full relative min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byMethod}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {byMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl min-h-[300px] flex flex-col">
          <h4 className="text-sm font-semibold mb-4 ml-2">Total de Vendas Mensal (Ao Longo dos Anos)</h4>
          <div className="flex-1 w-full relative min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annualTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => val === 0 ? '0' : `R$${val/1000}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
                {activeYears.map((yr, i) => (
                  <Line 
                    key={yr} 
                    type="monotone" 
                    dataKey={yr} 
                    name={yr} 
                    stroke={yr === selectedYearStr ? '#ea384c' : (LINE_COLORS[i % LINE_COLORS.length])} 
                    strokeWidth={yr === selectedYearStr ? 3 : 2} 
                    dot={{ r: 3 }} 
                    activeDot={{ r: 6 }} 
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
