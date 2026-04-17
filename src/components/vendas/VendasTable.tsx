import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PAYMENT_METHODS, CARD_BRANDS, SalesPaymentMethod, SalesData } from './vendas-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface Props {
  schoolId: string;
  defaultYear: string;
  availableYears: string[];
}

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function VendasTable({ schoolId, defaultYear, availableYears }: Props) {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [extraYears, setExtraYears] = useState<string[]>([]);
  
  const allYears = useMemo(() => {
    return Array.from(new Set([...availableYears, ...extraYears, defaultYear])).sort().reverse();
  }, [availableYears, extraYears, defaultYear]);

  // Se o ano atual do Dash mudar e não existir localmente, podemos sincronizar,
  // mas como recebemos defaultYear apenas para o inicio, use-o se possível.

  const { data: methods = [] } = useQuery({
    queryKey: ['sales_payment_methods', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId).eq('enabled', true);
      return (data || []) as SalesPaymentMethod[];
    },
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ['sales_data', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_data').select('*').eq('school_id', schoolId);
      return (data || []) as SalesData[];
    },
  });

  const updateSale = useMutation({
    mutationFn: async ({ id, month, payment_method, card_brand, amount }: Partial<SalesData>) => {
      if (id) {
        const { error } = await supabase.from('sales_data').update({ amount }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sales_data').insert({
          school_id: schoolId, month: month!, payment_method: payment_method!, card_brand, amount: amount!
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_data', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_sales_data', schoolId] });
    },
    onError: () => {
      toast.error('Erro ao salvar valor');
    }
  });

  const methodOptions = useMemo(() => {
    return methods.map(m => {
      const pLabel = PAYMENT_METHODS.find(p => p.value === m.payment_method)?.label || m.payment_method;
      const cLabel = m.card_brand ? CARD_BRANDS.find(c => c.value === m.card_brand)?.label : null;
      return {
        value: `${m.payment_method}${m.card_brand ? '-' + m.card_brand : ''}`,
        payment_method: m.payment_method,
        card_brand: m.card_brand,
        label: cLabel ? `${pLabel} - ${cLabel}` : pLabel
      };
    });
  }, [methods]);

  const [selectedMethod, setSelectedMethod] = useState<string>('todos');

  const visibleRows = useMemo(() => {
    if (selectedMethod === 'todos') {
      return methodOptions;
    }
    return methodOptions.filter(o => o.value === selectedMethod);
  }, [selectedMethod, methodOptions]);

  const handleBlur = (month: string, amountStr: string, activeMethod: any) => {
    const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0;
    const monthKey = `${selectedYear}-${month}`;
    
    const existing = salesData.find(s => 
      s.month === monthKey && 
      s.payment_method === activeMethod.payment_method && 
      s.card_brand === activeMethod.card_brand
    );

    if (existing) {
      if (existing.amount !== amount) {
        updateSale.mutate({ id: existing.id, amount });
      }
    } else if (amount > 0) {
      updateSale.mutate({
        month: monthKey,
        payment_method: activeMethod.payment_method,
        card_brand: activeMethod.card_brand,
        amount
      });
    }
  };

  const getAmountStr = (month: string, activeMethod: any) => {
    const monthKey = `${selectedYear}-${month}`;
    const existing = salesData.find(s => 
      s.month === monthKey && 
      s.payment_method === activeMethod.payment_method && 
      s.card_brand === activeMethod.card_brand
    );
    if (!existing || existing.amount === 0) return '';
    return existing.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAddYear = () => {
    const oldestYear = Math.min(...allYears.map(y => parseInt(y, 10)));
    const newYear = (oldestYear - 1).toString();
    setExtraYears(prev => [...prev, newYear]);
    setSelectedYear(newYear);
  };

  if (methods.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg">Histórico Mensal para Edição</h3>
          <p className="text-muted-foreground text-xs">Preencha os valores linha por linha. Salva automaticamente.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {allYears.map(yr => (
                <SelectItem key={yr} value={yr}>{yr}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={handleAddYear} title="Adicionar Ano Anterior">
            <Plus className="w-4 h-4" />
          </Button>

          <Select value={selectedMethod} onValueChange={setSelectedMethod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Forma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos (Visão Completa)</SelectItem>
              {methodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-4 text-left font-medium text-muted-foreground bg-muted/20 min-w-[200px]">Forma de Pagamento</th>
              {MONTHS_LABELS.map((m, i) => (
                <th key={m} className={`py-3 px-2 text-center font-medium text-muted-foreground ${i % 2 === 0 ? 'bg-muted/5' : ''}`}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.value} className={`border-b border-border/50 hover:bg-muted/10 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}>
                <td className="py-3 px-4 font-medium text-xs sm:text-sm border-r border-border/30">{row.label}</td>
                {MONTHS.map((month, i) => (
                  <td key={month} className={`py-2 px-1 ${i % 2 === 0 ? 'bg-muted/5' : ''}`}>
                    <Input 
                      className="w-full h-8 text-right bg-transparent border-transparent hover:border-border focus:bg-background focus:border-primary px-2 transition-all shadow-none text-xs sm:text-sm"
                      placeholder="0,00"
                      defaultValue={getAmountStr(month, row)}
                      onBlur={(e) => handleBlur(month, e.target.value, row)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
