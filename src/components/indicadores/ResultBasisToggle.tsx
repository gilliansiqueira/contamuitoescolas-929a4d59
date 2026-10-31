import { Button } from '@/components/ui/button';
import { useResultBasis } from '@/hooks/useResultadoBase';

export function ResultBasisToggle({ schoolId, compact }: { schoolId: string; compact?: boolean }) {
  const [basis, setBasis] = useResultBasis(schoolId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{compact ? 'Resultado' : 'Ver resultado por'}</span>
      <div className="flex gap-1">
        <Button size="sm" variant={basis === 'competencia' ? 'default' : 'outline'} className="h-7 px-3 text-xs" onClick={() => setBasis('competencia')}>Competência</Button>
        <Button size="sm" variant={basis === 'caixa' ? 'default' : 'outline'} className="h-7 px-3 text-xs" onClick={() => setBasis('caixa')}>Caixa</Button>
      </div>
      {!compact && (
        <span className="text-xs text-muted-foreground">
          {basis === 'competencia' ? 'Cada passeio conta no mês em que acontece.' : 'Dinheiro que entrou e saiu em cada mês.'}
        </span>
      )}
    </div>
  );
}
