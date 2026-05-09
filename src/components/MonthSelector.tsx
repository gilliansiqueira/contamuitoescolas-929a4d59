import { useAvailableMonths } from '@/hooks/useFinancialData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface MonthSelectorProps {
  schoolId: string;
  value: string; // 'all' or single 'YYYY-MM' (legacy: comma-separated)
  onChange: (v: string) => void;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]}/${y}`;
}

export function MonthSelector({ schoolId, value, onChange }: MonthSelectorProps) {
  const { data: months = [] } = useAvailableMonths(schoolId);

  // Normaliza valor legado (comma-separated) para o primeiro mês
  const currentValue = value === 'all' || !value
    ? 'all'
    : value.includes(',')
      ? value.split(',')[0]
      : value;

  // Lista ordenada do mais recente para o mais antigo
  const sortedMonths = [...months].sort().reverse();

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-muted-foreground" />
      <Select value={currentValue} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Selecionar mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {sortedMonths.map(m => (
            <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Utility: check if a date string matches the selected months filter */
export function matchesMonthFilter(date: string, selectedMonth: string): boolean {
  if (selectedMonth === 'all' || !selectedMonth) return true;
  const months = selectedMonth.split(',');
  const entryMonth = date.slice(0, 7);
  return months.includes(entryMonth);
}
