import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalesPaymentMethod, SalesData, SalesCardBrand } from './vendas-types';
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

// CellInput gerencia seu próprio estado enquanto digita, para não perder o foco ou o dado.
function CellInput({ initialValue, onSave }: { initialValue: string, onSave: (val: number) => void }) {
  const [val, setVal] = useState(initialValue);

  // Sync prop changes if not focused
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    const numericValue = parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
    onSave(numericValue);
  };

  return (
    <Input 
      className="w-full h-8 text-right bg-transparent border-transparent hover:border-primary/50 focus:bg-background focus:border-primary px-2 transition-all shadow-none text-xs sm:text-sm"
      placeholder="0,00"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

export function VendasTable({ schoolId, defaultYear, availableYears }: Props) {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [extraYears, setExtraYears] = useState<string[]>([]);
  
  const allYears = useMemo(() => {
    return Array.from(new Set([...availableYears, ...extraYears, defaultYear])).sort().reverse();
  }, [availableYears, extraYears, defaultYear]);

  const { data: methods = [] } = useQuery({
    queryKey: ['sales_payment_methods', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId).eq('enabled', true);
      return (data || []) as SalesPaymentMethod[];
    },
  });

  // Buscamos as bandeiras para exibir os ícones
  const { data: cardBrands = [] } = useQuery({
    queryKey: ['sales_card_brands'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_card_brands').select('*');
      return (data || []) as SalesCardBrand[];
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
    mutationFn: async ({ id, month, method_key, brand_id, value }: Partial<SalesData>) => {
      if (id) {
        const { error } = await supabase.from('sales_data').update({ value }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sales_data').insert({
          school_id: schoolId, month: month!, method_key: method_key!, brand_id: brand_id || null, value: value!
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_data', schoolId] });
    },
    onError: () => {
      toast.error('Erro ao salvar valor');
    }
  });

  const methodOptions = useMemo(() => {
    return methods.map(m => {
      let brandId = null;
      let finalMethodKey = m.method_key;
      let iconUrl = null;
      
      // Quando salvamos card brands no VendasConfig, usamos 'brand-ID' no method_key
      if (m.method_key.startsWith('brand-')) {
        brandId = m.method_key.replace('brand-', '');
        finalMethodKey = 'credit'; // Para a tabela sales_data, isso conta como method_key: 'credit'
        const matchedBrand = cardBrands.find(cb => cb.id === brandId);
        if (matchedBrand && matchedBrand.icon_url) {
          iconUrl = matchedBrand.icon_url;
        }
      }

      return {
        id: m.id,
        value: m.method_key, // The raw key from Config
        method_key: finalMethodKey, // The parsed key for DB
        brand_id: brandId,
        label: m.label || m.method_key,
        icon_url: iconUrl
      };
    });
  }, [methods, cardBrands]);

  const [selectedMethod, setSelectedMethod] = useState<string>('todos');

  const visibleRows = useMemo(() => {
    if (selectedMethod === 'todos') {
      return methodOptions;
    }
    return methodOptions.filter(o => o.value === selectedMethod);
  }, [selectedMethod, methodOptions]);

  const handleSave = (month: string, value: number, activeRow: typeof methodOptions[0]) => {
    const monthKey = `${selectedYear}-${month}`;
    
    // Procura registro existente
    const existing = salesData.find(s => 
      s.month === monthKey && 
      s.method_key === activeRow.method_key && 
      (s.brand_id === activeRow.brand_id || (!s.brand_id && !activeRow.brand_id))
    );

    if (existing) {
      if (existing.value !== value) {
        updateSale.mutate({ id: existing.id, value });
      }
    } else if (value > 0) {
      updateSale.mutate({
        month: monthKey,
        method_key: activeRow.method_key,
        brand_id: activeRow.brand_id,
        value
      });
    }
  };

  const getAmountStr = (month: string, activeRow: typeof methodOptions[0]) => {
    const monthKey = `${selectedYear}-${month}`;
    const existing = salesData.find(s => 
      s.month === monthKey && 
      s.method_key === activeRow.method_key && 
      (s.brand_id === activeRow.brand_id || (!s.brand_id && !activeRow.brand_id))
    );
    if (!existing || existing.value === 0) return '';
    return existing.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    <div className="glass-card rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2">
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 text-left font-medium text-muted-foreground min-w-[200px] whitespace-nowrap">Forma de Pagamento</th>
              {MONTHS_LABELS.map((m, i) => (
                <th key={m} className={`py-3 px-2 text-center font-medium text-muted-foreground ${i % 2 === 0 ? 'bg-muted/10' : ''}`}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.value} className={`border-b border-border/50 hover:bg-muted/10 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}>
                <td className="py-3 px-4 font-medium text-xs sm:text-sm border-r border-border/30 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {row.icon_url && <img src={row.icon_url} alt={row.label} className="w-4 h-4 object-contain" />}
                    {row.label}
                  </div>
                </td>
                {MONTHS.map((month, i) => (
                  <td key={month} className={`py-2 px-1 ${i % 2 === 0 ? 'bg-muted/5' : ''}`}>
                    <CellInput 
                      initialValue={getAmountStr(month, row)}
                      onSave={(val) => handleSave(month, val, row)}
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
