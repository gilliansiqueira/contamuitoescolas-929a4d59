import { useMemo } from 'react';
import { getEntries } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';

interface MonthSelectorProps {
  schoolId: string;
  value: string; // 'all' or 'YYYY-MM'
  onChange: (v: string) => void;
}

export function MonthSelector({ schoolId, value, onChange }: MonthSelectorProps) {
  const months = useMemo(() => {
    const entries = getEntries(schoolId);
    const set = new Set<string>();
    entries.forEach(e => set.add(e.data.slice(0, 7)));
    return Array.from(set).sort();
  }, [schoolId]);

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${names[parseInt(mo) - 1]}/${y}`;
  };

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="w-4 h-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {months.map(m => (
            <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
