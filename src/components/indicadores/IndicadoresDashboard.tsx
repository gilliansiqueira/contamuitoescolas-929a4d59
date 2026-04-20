import { useMemo, useState } from 'react';
import { Settings, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKpiDefinitions, useKpiValues } from './useKpiData';
import { KpiCard } from './KpiCard';
import { KpiConfigDrawer } from './KpiConfigDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { usePresentation } from '@/components/presentation-provider';
import type { Insight } from '@/components/InsightsBar';

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
  const { definitions, isLoading, icons } = useKpiDefinitions(schoolId);
  const { data: allValues = [] } = useKpiValues(schoolId);
  
  const months = useMemo(() => generateMonths(allValues), [allValues]);
  const enabledDefs = useMemo(() => definitions.filter(d => d.enabled), [definitions]);

  // Compute insights grouped by KPI definition id (so each card shows its own)
  const insightsByDef = useMemo<Record<string, Insight[]>>(() => {
    const map: Record<string, Insight[]> = {};
    const currentMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];

    function thresholdLabel(def: any, value: number | null): { label: string; toneIdx: number } | null {
      if (value === null || !def.thresholds?.length) return null;
      for (let i = 0; i < def.thresholds.length; i++) {
        const t = def.thresholds[i];
        const min = t.min_value ?? -Infinity;
        const max = t.max_value ?? Infinity;
        if (value >= min && value < max) return { label: t.label, toneIdx: i };
      }
      return { label: def.thresholds[def.thresholds.length - 1].label, toneIdx: def.thresholds.length - 1 };
    }

    enabledDefs.forEach(def => {
      const list: Insight[] = [];
      const current = allValues.find(v => v.kpi_definition_id === def.id && v.month === currentMonth)?.value ?? null;
      const prev = prevMonth ? allValues.find(v => v.kpi_definition_id === def.id && v.month === prevMonth)?.value ?? null : null;
      if (current === null) {
        map[def.id] = list;
        return;
      }

      const t = thresholdLabel(def, current);
      // Critical (worst tier — toneIdx 0 by convention "ruim")
      if (t && def.thresholds.length >= 2 && t.toneIdx === 0) {
        list.push({
          id: `crit-${def.id}`,
          tone: 'danger',
          icon: AlertTriangle,
          title: `${def.name} em estado crítico`,
          description: `Valor atual classificado como "${t.label}".`,
        });
      }
      // Excellent (best tier)
      if (t && def.thresholds.length >= 2 && t.toneIdx === def.thresholds.length - 1) {
        list.push({
          id: `top-${def.id}`,
          tone: 'success',
          icon: CheckCircle2,
          title: `${def.name} no melhor patamar`,
          description: `Classificado como "${t.label}".`,
        });
      }

      // Trend insight
      if (prev !== null && current !== prev) {
        const variation = current - prev;
        const isImprovement = def.direction === 'higher_is_better' ? variation > 0 : variation < 0;
        const pct = prev !== 0 ? Math.abs(variation / prev) * 100 : 0;
        if (pct >= 10) {
          list.push({
            id: `trend-${def.id}`,
            tone: isImprovement ? 'success' : 'warning',
            icon: isImprovement ? TrendingUp : TrendingDown,
            title: `${def.name} ${isImprovement ? 'melhorou' : 'piorou'} ${pct.toFixed(0)}%`,
            description: `Variação significativa vs mês anterior.`,
          });
        }
      }

      map[def.id] = list;
    });

    return map;
  }, [enabledDefs, allValues, months]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="relative">
      {!isPresentationMode && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-0 right-0 z-10 h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setConfigOpen(true)}
          title="Configurar indicadores"
        >
          <Settings className="w-4 h-4" />
        </Button>
      )}

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
        <div className="space-y-5 pt-2">
          {insights.length > 0 && <InsightsBar insights={insights} title="Destaques dos indicadores" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {enabledDefs.map(def => (
              <KpiCard
                key={def.id}
                definition={def}
                values={allValues.filter(v => v.kpi_definition_id === def.id)}
                months={months}
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
