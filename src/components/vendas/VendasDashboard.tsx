import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalesData } from './vendas-types';
import { VendasConfig } from './VendasConfig';
import { VendasTable } from './VendasTable';
import { VendasCharts } from './VendasCharts';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  schoolId: string;
}

const MONTHS_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function VendasDashboard({ schoolId }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString().padStart(2, '0'));

  const { data: salesData = [] } = useQuery({
    queryKey: ['sales_data', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_data').select('*').eq('school_id', schoolId);
      return (data || []) as SalesData[];
    },
  });

  const availableYears = useMemo(() => {
    const years = new Set<string>([now.getFullYear().toString()]);
    salesData.forEach(s => years.add(s.month.split('-')[0]));
    return Array.from(years).sort().reverse();
  }, [salesData, now]);

  if (showConfig) {
    return <VendasConfig schoolId={schoolId} onBack={() => setShowConfig(false)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-display font-semibold tracking-tight">Vendas Realizadas</h2>
          <p className="text-muted-foreground text-sm">Controle de receitas por forma de pagamento</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_LABELS.map((label, index) => {
                const val = (index + 1).toString().padStart(2, '0');
                return <SelectItem key={val} value={val}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(yr => (
                <SelectItem key={yr} value={yr}>{yr}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      <VendasCharts data={salesData} selectedMonthStr={`${selectedYear}-${selectedMonth}`} selectedYearStr={selectedYear} />
      
      <div className="pt-4 border-t border-border">
        <VendasTable schoolId={schoolId} defaultYear={selectedYear} availableYears={availableYears} />
      </div>
    </div>
  );
}
