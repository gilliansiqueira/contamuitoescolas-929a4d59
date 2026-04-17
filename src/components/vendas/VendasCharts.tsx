import { useMemo } from 'react';
import { SalesData, PAYMENT_METHODS } from './vendas-types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CreditCard, Smartphone, Receipt, FileText, Banknote, HelpCircle } from 'lucide-react';

interface Props {
  data: SalesData[];
  selectedMonthStr: string; // YYYY-MM format
  selectedYearStr: string;
}

const COLORS = ['#ea384c', '#0EA5E9', '#F59E0B', '#10B981', '#8B5CF6', '#64748B'];
const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function VendasCharts({ data, selectedMonthStr, selectedYearStr }: Props) {
  // Dados do mês específico para o PieChart e Cards
  const monthData = useMemo(() => data.filter(s => s.month === selectedMonthStr), [data, selectedMonthStr]);
  const monthTotal = monthData.reduce((acc, curr) => acc + curr.value, 0);

  // Agrupamento por forma de pagamento no mês selecionado
  const byMethod = useMemo(() => {
    const acc: Record<string, number> = {};
    monthData.forEach(item => {
      // If method_key is like "credit-visa", sum into "credit" or keep it separated?
      // Since it's byMethod, we group by base method format.
      let baseMethod = item.method_key;
      if (item.method_key.startsWith('credit-')) baseMethod = 'credit';
      acc[baseMethod] = (acc[baseMethod] || 0) + item.value;
    });
    return Object.keys(acc).map(key => {
      const pmLabel = PAYMENT_METHODS.find(pm => pm.value === key)?.label || key;
      return {
        name: pmLabel,
        value: acc[key],
        method: key
      }
    }).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [monthData]);

  // Evolução anual para o BarChart (Total de vendas de cada mês)
  const annualTrend = useMemo(() => {
    const yearData = data.filter(s => s.month.startsWith(selectedYearStr));
    return MONTHS_LABELS.map((label, index) => {
      const monthStr = `${selectedYearStr}-${(index + 1).toString().padStart(2, '0')}`;
      const totalMes = yearData.filter(s => s.month === monthStr).reduce((acc, curr) => acc + curr.value, 0);
      return {
        name: label,
        Total: totalMes
      };
    });
  }, [data, selectedYearStr]);

  const getIcon = (method: string) => {
    switch (method) {
      case 'credit': return <CreditCard className="w-5 h-5 text-primary" />;
      case 'debit': return <CreditCard className="w-5 h-5 text-primary" />;
      case 'pix': return <Smartphone className="w-5 h-5 text-primary" />;
      case 'boleto': return <FileText className="w-5 h-5 text-primary" />;
      case 'check': return <Receipt className="w-5 h-5 text-primary" />;
      case 'cash': return <Banknote className="w-5 h-5 text-primary" />;
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
          <h4 className="text-sm font-semibold mb-4 ml-2">Total de Vendas por Mês ({selectedYearStr})</h4>
          <div className="flex-1 w-full relative min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `R$${val/1000}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
                />
                <Bar dataKey="Total" fill="#ea384c" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
