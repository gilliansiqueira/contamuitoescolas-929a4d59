import { useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKpiDefinitions, useKpiValues } from './useKpiData';
import { KpiCard } from './KpiCard.quintal';
import { KpiConfigDrawer } from './KpiConfigDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { usePresentation } from '@/components/presentation-provider';
import { ResultadoAnualCard } from './ResultadoAnualCard';
import { ResultBasisToggle } from './ResultBasisToggle';
import { GestaoIndicadores } from './GestaoIndicadores';
import { MargemSemSociosCard } from './MargemSemSociosCard';
import { RecebimentosFormaCard } from './RecebimentosFormaCard';
import { useAvailableMonths } from '@/hooks/useFinancialData';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMonthSync, useRangeSync } from '@/components/realizado/SharedMonthContext';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';
import { useFinancialReview } from '@/hooks/useFinancialMonthStatus';
import { FinancialReviewNotice } from '@/components/FinancialReviewNotice';

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

function normalizeIndicatorName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function IndicadoresDashboardQuintal({ schoolId }: Props) {
  const { isPresentationMode } = usePresentation();
  const [configOpen, setConfigOpen] = useState(false);
  const [referenceMonth, setReferenceMonth] = useState<string>(''); // '' or comma-separated list
  const { definitions, isLoading, icons } = useKpiDefinitions(schoolId);
  const { data: allValues = [] } = useKpiValues(schoolId);
  const { data: financialMonths = [] } = useAvailableMonths(schoolId);
  
  const months = useMemo(() => generateMonths([
    ...allValues,
    ...financialMonths.map(month => ({ month })),
  ]), [allValues, financialMonths]);
  const enabledDefs = useMemo(() => definitions.filter(d => d.enabled), [definitions]);
  const marginDefs = useMemo(() => {
    const margins = enabledDefs.filter(def => normalizeIndicatorName(def.name).includes('margem'));
    return margins.sort((a, b) => {
      const aName = normalizeIndicatorName(a.name);
      const bName = normalizeIndicatorName(b.name);
      const rank = (name: string) => name.includes('bruta') ? 0 : name.includes('liquida') ? 1 : 2;
      return rank(aName) - rank(bName) || a.sort_order - b.sort_order;
    });
  }, [enabledDefs]);

  const selectedRefList = useMemo(
    () => referenceMonth && referenceMonth !== 'all' ? referenceMonth.split(',').map(s => s.trim()).filter(Boolean) : [],
    [referenceMonth]
  );
  // Effective reference = latest of the selected, or latest available
  const effectiveRefMonth = selectedRefList[selectedRefList.length - 1] || months[months.length - 1];
  const { isInReview, reviewMonths } = useFinancialReview(schoolId, (referenceMonth && referenceMonth !== 'all' ? referenceMonth : '') || effectiveRefMonth || 'all');
  const isMultiRef = selectedRefList.length > 1;

  const pushShared = useMonthSync(
    selectedRefList.length === 1 ? selectedRefList[0] : null,
    (m) => setReferenceMonth(m)
  );
  useRangeSync(referenceMonth, (r) => setReferenceMonth(r));

  // Lista de meses com dados (para o seletor)
  const monthsWithData = useMemo(() => {
    const set = new Set([...allValues.map(v => v.month), ...financialMonths]);
    return Array.from(set).sort();
  }, [allValues, financialMonths]);

  function formatMonthLabel(m: string) {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${names[parseInt(mo, 10) - 1]}/${y}`;
  }




  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5">
        {[1, 2].map(i => <Skeleton key={i} className="h-80 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="relative">
      {isInReview && <div className="mb-4"><FinancialReviewNotice months={reviewMonths} /></div>}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Filtro de mês de referência */}
        {monthsWithData.length > 0 && (
          <div className="flex items-center gap-2">

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

      {isInReview ? (
        <div className="rounded-2xl border bg-card p-8 text-center font-semibold text-muted-foreground">Margens em revisão</div>
      ) : marginDefs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-3">Nenhum indicador de margem configurado ainda.</p>
          {!isPresentationMode && (
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings className="w-4 h-4 mr-1" /> Configurar indicadores
            </Button>
          )}
        </div>
      ) : (
        <div className="pt-2">
          <div className="grid grid-cols-1 gap-5">
            {marginDefs.map(def => (
              <KpiCard
                key={def.id}
                definition={def}
                values={allValues.filter(v => v.kpi_definition_id === def.id)}
                months={months}
                referenceMonth={effectiveRefMonth}
                expandedLayout
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3 sm:hidden"><ResultBasisToggle schoolId={schoolId} /></div>
        <ResultadoAnualCard schoolId={schoolId} referenceMonth={effectiveRefMonth} />
      </div>

      {!isInReview && <div className="mt-5"><MargemSemSociosCard schoolId={schoolId} referenceMonth={effectiveRefMonth} /></div>}
      <div className="mt-5"><RecebimentosFormaCard schoolId={schoolId} referenceMonth={effectiveRefMonth} /></div>

      {!isInReview && effectiveRefMonth && <GestaoIndicadores schoolId={schoolId} referenceMonth={effectiveRefMonth} />}

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
