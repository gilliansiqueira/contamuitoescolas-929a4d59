import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { FinancialEntry, TypeClassification } from '@/types/financial';
import { resolveEntryLedgerRule, resolveEntryTipoKey } from '@/lib/ledgerEngine';

interface UnclassifiedAlertProps {
  entries: FinancialEntry[];
  classifications: TypeClassification[];
  className?: string;
}

/**
 * Banner de aviso: lista lançamentos cujo tipo não tem classificação conhecida
 * (caíram no fallback do ledger). Puramente informativo — não altera cálculos.
 */
export function UnclassifiedAlert({ entries, classifications, className }: UnclassifiedAlertProps) {
  const { count, total, labels } = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    let count = 0;
    let total = 0;
    for (const e of entries) {
      const rule = resolveEntryLedgerRule(e, classifications);
      if (!rule.unclassified) continue;
      count += 1;
      total += Number(e.valor || 0);
      const key = rule.label || resolveEntryTipoKey(e, classifications) || e.tipo;
      const cur = map.get(key) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(e.valor || 0);
      map.set(key, cur);
    }
    const labels = Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);
    return { count, total, labels };
  }, [entries, classifications]);

  if (count === 0) return null;

  return (
    <div
      className={`rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-3 ${className ?? ''}`}
      data-export-hide
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-amber-800 dark:text-amber-300">
          {count} lançamento{count > 1 ? 's' : ''} com tipo não classificado
          {total > 0 && (
            <> · {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>
          )}
        </p>
        <p className="text-amber-700/90 dark:text-amber-200/80 mt-0.5">
          Cadastre esses tipos no Modelo da Empresa para que sejam contabilizados corretamente.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {labels.map(([label, agg]) => (
            <span
              key={label}
              className="rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-2 py-0.5 text-xs"
            >
              {label} ({agg.count})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
