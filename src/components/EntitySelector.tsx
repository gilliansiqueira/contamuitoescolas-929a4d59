import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGlobalPeriod } from '@/contexts/GlobalPeriodContext';

/** Filtro global de CNPJ — só aparece quando a empresa tem 2+ CNPJs. */
export function EntitySelector() {
  const { entities, entityId, setEntityId } = useGlobalPeriod();
  if (entities.length < 2) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/5 border border-primary/20" title="CNPJ aplicado em todas as abas">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">CNPJ</span>
      <Select value={entityId} onValueChange={setEntityId}>
        <SelectTrigger className="h-8 w-[170px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os CNPJs</SelectItem>
          {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          <SelectItem value="none">Sem CNPJ definido</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
