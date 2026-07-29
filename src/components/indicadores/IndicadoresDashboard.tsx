import { useMemo, useState } from 'react';
import { Settings, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKpiDefinitions, useKpiValues } from './useKpiData';
import { KpiCard } from './KpiCard';
import { KpiConfigDrawer } from './KpiConfigDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { usePresentation } from '@/components/presentation-provider';
import type { Insight } from '@/components/InsightsBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMonthSync, useRangeSync } from '@/components/realizado/SharedMonthContext';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';

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
  const { isPresentationMode } = usePresentation();
  const [configOpen, setConfigOpen] = useState(false);
  const [referenceMonth, setReferenceMonth] = useState<string>(''); // '' or comma-separated list
  const { definitions, isLoading, icons } = useKpiDefinitions(schoolId);
  const { data: allValues = [] } = useKpiValues(schoolId);
  
  const months = useMemo(() => generateMonths(allValues), [allValues]);
  const enabledDefs = useMemo(() => definitions.filter(d => d.enabled), [definitions]);

  const selectedRefList = useMemo(
    () => referenceMonth ? referenceMonth.split(',').map(s => s.trim()).filter(Boolean) : [],
    [referenceMonth]
  );
  // Effective reference = latest of the selected, or latest available
  const effectiveRefMonth = selectedRefList[selectedRefList.length - 1] || months[months.length - 1];
  const isMultiRef = selectedRefList.length > 1;

  const pushShared = useMonthSync(
    selectedRefList.length === 1 ? selectedRefList[0] : null,
    (m) => setReferenceMonth(m)
  );
  useRangeSync(referenceMonth, (r) => setReferenceMonth(r));

  // Lista de meses com dados (para o seletor)
  const monthsWithData = useMemo(() => {
    const set = new Set(allValues.map(v => v.month));
    return Array.from(set).sort();
  }, [allValues]);

  function formatMonthLabel(m: string) {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${names[parseInt(mo, 10) - 1]}/${y}`;
  }




  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Filtro de mês de referência */}
        {monthsWithData.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Mês de referência:
            </span>
            <SingleMonthPicker
              multi
              value={referenceMonth}
              onChange={(m) => {
                setReferenceMonth(m);
                const list = m ? m.split(',') : [];
                if (list.length === 1) pushShared(list[0]);
              }}
              availableMonths={monthsWithData}
              allowEmpty
              emptyLabel={`Mais recente (${formatMonthLabel(months[months.length - 1])})`}
            />
            {isMultiRef && (
              <span className="text-[10px] text-muted-foreground">
                Referência: <strong>{formatMonthLabel(effectiveRefMonth)}</strong> (último selecionado)
              </span>
            )}
          </div>
        )}
        {!isPresentationMode && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setConfigOpen(true)}
            title="Configurar indicadores"
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </div>

      {enabledDefs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-3">Nenhum indicador configurado ainda.</p>
          {!isPresentationMode && (
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings className="w-4 h-4 mr-1" /> Configurar indicadores
            </Button>
          )}
        </div>
      ) : (
        <div className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {enabledDefs.map(def => (
              <KpiCard
                key={def.id}
                definition={def}
                values={allValues.filter(v => v.kpi_definition_id === def.id)}
                months={months}
                
                referenceMonth={effectiveRefMonth}
              />
            ))}
          </div>
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
