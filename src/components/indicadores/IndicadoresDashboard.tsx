import { useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKpiDefinitions, useKpiValues } from './useKpiData';
import { KpiCard } from './KpiCard';
import { KpiConfigDrawer } from './KpiConfigDrawer';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  schoolId: string;
}

function generateMonths(values: { month: string }[]): string[] {
  const now = new Date();
  const months = new Set<string>();
  
  // Always include last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  
  // Include any historical months from values
  values.forEach(v => months.add(v.month));
  
  return Array.from(months).sort();
}

export function IndicadoresDashboard({ schoolId }: Props) {
  const [configOpen, setConfigOpen] = useState(false);
  const { definitions, isLoading, icons } = useKpiDefinitions(schoolId);
  const { data: allValues = [] } = useKpiValues(schoolId);
  
  const months = useMemo(() => generateMonths(allValues), [allValues]);
  const enabledDefs = useMemo(() => definitions.filter(d => d.enabled), [definitions]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-0 right-0 z-10 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setConfigOpen(true)}
        title="Configurar indicadores"
      >
        <Settings className="w-4 h-4" />
      </Button>

      {enabledDefs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-3">Nenhum indicador configurado ainda.</p>
          <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-1" /> Configurar indicadores
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 pt-2">
          {enabledDefs.map(def => (
            <KpiCard
              key={def.id}
              definition={def}
              values={allValues.filter(v => v.kpi_definition_id === def.id)}
              months={months}
            />
          ))}
        </div>
      )}

      <KpiConfigDrawer
        open={configOpen}
        onOpenChange={setConfigOpen}
        schoolId={schoolId}
        definitions={definitions}
        icons={icons}
      />
    </div>
  );
}
