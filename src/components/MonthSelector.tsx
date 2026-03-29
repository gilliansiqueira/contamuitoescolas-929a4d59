import { useMemo } from 'react';
import { getEntries } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MonthSelectorProps {
  schoolId: string;
  value: string; // 'all' or comma-separated 'YYYY-MM,YYYY-MM'
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

  const selectedMonths = value === 'all' ? [] : value.split(',').filter(Boolean);

  const toggleMonth = (m: string) => {
    if (selectedMonths.includes(m)) {
      const next = selectedMonths.filter(x => x !== m);
      onChange(next.length === 0 ? 'all' : next.join(','));
    } else {
      const next = [...selectedMonths, m].sort();
      onChange(next.join(','));
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
      <button
        onClick={() => onChange('all')}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          value === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
        }`}
      >
        Todos
      </button>
      {months.map(m => (
        <button
          key={m}
          onClick={() => toggleMonth(m)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            selectedMonths.includes(m)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          {formatMonth(m)}
        </button>
      ))}
    </div>
  );
}

/** Utility: check if a date string matches the selected months filter */
export function matchesMonthFilter(date: string, selectedMonth: string): boolean {
  if (selectedMonth === 'all') return true;
  const months = selectedMonth.split(',');
  const entryMonth = date.slice(0, 7);
  return months.includes(entryMonth);
}
