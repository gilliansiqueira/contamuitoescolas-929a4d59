import { useMemo, useState } from 'react';
import { useAvailableMonths } from '@/hooks/useFinancialData';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthSelectorProps {
  schoolId: string;
  value: string; // 'all' or comma-separated 'YYYY-MM'
  onChange: (v: string) => void;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]}/${y}`;
}

function parseValue(v: string): Set<string> {
  if (!v || v === 'all') return new Set();
  return new Set(v.split(',').map(s => s.trim()).filter(Boolean));
}

function serialize(set: Set<string>): string {
  if (set.size === 0) return 'all';
  return Array.from(set).sort().join(',');
}

export function MonthSelector({ schoolId, value, onChange }: MonthSelectorProps) {
  const { data: months = [] } = useAvailableMonths(schoolId);
  const [open, setOpen] = useState(false);
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const selected = useMemo(() => parseValue(value), [value]);

  // Group months by year (descending year)
  const byYear = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of months) {
      const y = m.slice(0, 4);
      if (!map.has(y)) map.set(y, new Set());
      map.get(y)!.add(m);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [months]);

  const sortedSelected = useMemo(() => Array.from(selected).sort(), [selected]);

  const label = useMemo(() => {
    if (selected.size === 0) return 'Todos os meses';
    if (selected.size === 1) return formatMonth(sortedSelected[0]);
    // Detect contiguous range
    const allMonths = months.slice().sort();
    const idxs = sortedSelected.map(m => allMonths.indexOf(m)).filter(i => i >= 0);
    const isRange = idxs.length === selected.size &&
      idxs.every((v, i, arr) => i === 0 || v === arr[i - 1] + 1);
    if (isRange && selected.size > 1) {
      return `${formatMonth(sortedSelected[0])} – ${formatMonth(sortedSelected[sortedSelected.length - 1])}`;
    }
    return `${selected.size} meses selecionados`;
  }, [selected, sortedSelected, months]);

  const toggle = (m: string, shift: boolean) => {
    const next = new Set(selected);
    if (shift && lastClicked) {
      const allMonths = months.slice().sort();
      const a = allMonths.indexOf(lastClicked);
      const b = allMonths.indexOf(m);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(allMonths[i]);
        setLastClicked(m);
        onChange(serialize(next));
        return;
      }
    }
    if (next.has(m)) next.delete(m); else next.add(m);
    setLastClicked(m);
    onChange(serialize(next));
  };

  const setAll = () => { setLastClicked(null); onChange('all'); };
  const clear = () => { setLastClicked(null); onChange('all'); };
  const lastN = (n: number) => {
    const sorted = months.slice().sort();
    const pick = sorted.slice(-n);
    setLastClicked(null);
    onChange(serialize(new Set(pick)));
  };
  const currentYear = () => {
    const y = String(new Date().getFullYear());
    const pick = months.filter(m => m.startsWith(y));
    setLastClicked(null);
    onChange(serialize(new Set(pick)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-medium min-w-[180px] justify-start">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="truncate">{label}</span>
          {selected.size > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="ml-auto opacity-60 hover:opacity-100"
              aria-label="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border">
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={setAll}>Todos</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => lastN(3)}>Últimos 3</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => lastN(6)}>Últimos 6</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => lastN(12)}>Últimos 12</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={currentYear}>Ano atual</Button>
        </div>
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {byYear.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem dados disponíveis</p>
          ) : (
            byYear.map(([year, yearMonths]) => (
              <div key={year}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{year}</div>
                <div className="grid grid-cols-4 gap-1">
                  {MONTH_NAMES.map((mn, idx) => {
                    const mKey = `${year}-${String(idx + 1).padStart(2, '0')}`;
                    const available = yearMonths.has(mKey);
                    const isSelected = selected.has(mKey);
                    return (
                      <button
                        key={mn}
                        disabled={!available}
                        onClick={(e) => toggle(mKey, e.shiftKey)}
                        className={cn(
                          'h-7 text-[11px] rounded border transition-colors',
                          available ? 'cursor-pointer' : 'cursor-not-allowed opacity-30',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-accent'
                        )}
                      >
                        {mn}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border">
          Dica: <kbd className="px-1 rounded bg-muted">Shift</kbd>+clique para selecionar intervalo
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Utility: check if a date string matches the selected months filter */
export function matchesMonthFilter(date: string, selectedMonth: string): boolean {
  if (selectedMonth === 'all' || !selectedMonth) return true;
  const months = selectedMonth.split(',');
  const entryMonth = date.slice(0, 7);
  return months.includes(entryMonth);
}
