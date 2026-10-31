import { AlertTriangle } from 'lucide-react';

export function FinancialReviewNotice({ months }: { months: string[] }) {
  if (!months.length) return null;
  const labels = months.map(month => {
    const [year, number] = month.split('-');
    return `${number}/${year}`;
  });
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
      <span><strong>Período em revisão ({labels.join(', ')}).</strong> Receitas e despesas permanecem disponíveis; Resultado e Margem ficam ocultos até a conferência.</span>
    </div>
  );
}