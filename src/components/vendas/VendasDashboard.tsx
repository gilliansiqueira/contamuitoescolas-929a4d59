import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalesData } from './vendas-types';
import { VendasConfig } from './VendasConfig';
import { VendasTable } from './VendasTable';
import { VendasCharts } from './VendasCharts';
import { Button } from '@/components/ui/button';
import { Settings2, Upload } from 'lucide-react';
import { useMonthSync } from '@/components/realizado/SharedMonthContext';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';
import { ImportacaoVendas } from './ImportacaoVendas';

interface Props {
  schoolId: string;
}

const MONTHS_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function VendasDashboard({ schoolId }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const now = new Date();
  // Multi-month value: comma-separated 'YYYY-MM,YYYY-MM,...'.
  const [pickerValue, setPickerValue] = useState<string>(
    `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  );
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  const selectedList = useMemo(
    () => pickerValue.split(',').map(s => s.trim()).filter(Boolean).sort(),
    [pickerValue]
  );
  const latestMonth = selectedList[selectedList.length - 1] || `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const [selectedYear, selectedMonth] = latestMonth.split('-');

  // Sincronia com outras abas apenas em modo mês único.
  const pushShared = useMonthSync(
    selectedList.length === 1 ? selectedList[0] : null,
    (m) => { setPickerValue(m); setHasManuallySelected(true); }
  );

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

  useEffect(() => {
    if (salesData.length > 0 && !hasManuallySelected) {
      const activeRows = salesData.filter(s => s.value > 0);
      if (activeRows.length > 0) {
        const sorted = [...activeRows].sort((a, b) => b.month.localeCompare(a.month));
        const latest = sorted[0].month;
        if (latest !== pickerValue) setPickerValue(latest);
      }
    }
  }, [salesData, hasManuallySelected, pickerValue]);

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
          <SingleMonthPicker
            multi
            value={pickerValue}
            onChange={(m) => {
              setHasManuallySelected(true);
              setPickerValue(m);
              const list = m.split(',').map(s => s.trim()).filter(Boolean);
              if (list.length === 1) pushShared(list[0]);
            }}
            availableMonths={salesData.map(s => s.month)}
          />

          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar planilha
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      <VendasCharts
        data={salesData}
        selectedMonths={selectedList.length > 0 ? selectedList : [latestMonth]}
        selectedYearStr={selectedYear}
      />
      
      <div className="pt-4 border-t border-border">
        <VendasTable schoolId={schoolId} defaultYear={selectedYear} availableYears={availableYears} />
      </div>

      <ImportacaoVendas schoolId={schoolId} open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
