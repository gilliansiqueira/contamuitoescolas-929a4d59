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
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString().padStart(2, '0'));
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  const pushShared = useMonthSync(`${selectedYear}-${selectedMonth}`, (m) => {
    const [y, mo] = m.split('-');
    setSelectedYear(y); setSelectedMonth(mo); setHasManuallySelected(true);
  });

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
      // Filtrar linhas que contém preenchimentos acima de zero
      const activeRows = salesData.filter(s => s.value > 0);
      if (activeRows.length > 0) {
        // Ordena para pegar a data mais recente
        const sorted = activeRows.sort((a, b) => b.month.localeCompare(a.month));
        const latest = sorted[0].month;
        const [y, m] = latest.split('-');
        if (y !== selectedYear || m !== selectedMonth) {
          setSelectedYear(y);
          setSelectedMonth(m);
        }
      }
    }
  }, [salesData, hasManuallySelected, selectedYear, selectedMonth]);

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
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(m) => {
              if (!m) return;
              // Use the LATEST selected month as the active one
              const list = m.split(',').map(s => s.trim()).filter(Boolean).sort();
              const latest = list[list.length - 1] || m;
              const [y, mo] = latest.split('-');
              setHasManuallySelected(true);
              setSelectedYear(y);
              setSelectedMonth(mo);
              if (list.length === 1) pushShared(`${y}-${mo}`);
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

      <VendasCharts data={salesData} selectedMonthStr={`${selectedYear}-${selectedMonth}`} selectedYearStr={selectedYear} />
      
      <div className="pt-4 border-t border-border">
        <VendasTable schoolId={schoolId} defaultYear={selectedYear} availableYears={availableYears} />
      </div>

      <ImportacaoVendas schoolId={schoolId} open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
