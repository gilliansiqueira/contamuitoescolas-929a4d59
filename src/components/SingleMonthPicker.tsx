import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /**
   * Selected month(s). In single mode: 'YYYY-MM' or ''.
   * In multi mode: comma-separated 'YYYY-MM,YYYY-MM' or ''.
   */
  value: string;
  onChange: (m: string) => void;
  /** Months available with data (for highlighting). */
  availableMonths?: string[];
  placeholder?: string;
  /** Whether to allow an "all months" / latest sentinel. */
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  /** Number of years (back) to render. Default 3. */
  yearsBack?: number;
  /** Number of years (forward) to render. Default 1. */
  yearsForward?: number;
  size?: 'sm' | 'default';
  triggerClassName?: string;
  /** Enable multi-month selection. */
  multi?: boolean;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonth(m: string) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]}/${y}`;
}

function parseMulti(v: string): string[] {
  if (!v) return [];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

/** Returns true when the date (YYYY-MM-DD or YYYY-MM) matches the picker value. */
export function matchesMonthsValue(date: string, value: string): boolean {
  if (!value) return true;
  const ym = date.slice(0, 7);
  const set = new Set(parseMulti(value));
  if (set.size === 0) return true;
  return set.has(ym);
}

/** Returns the list of selected months from a picker value. Empty array = no filter. */
export function selectedMonths(value: string): string[] {
  return parseMulti(value);
}

/** Returns the latest selected month, or '' if none. */
export function latestSelectedMonth(value: string): string {
  const list = parseMulti(value);
  if (list.length === 0) return '';
  return list.slice().sort().pop()!;
}

export function SingleMonthPicker({
  value, onChange, availableMonths = [], placeholder = 'Selecionar mês',
  allowEmpty = false, emptyLabel = 'Todos', className,
  yearsBack = 3, yearsForward = 1, triggerClassName, multi = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const selected = useMemo(() => new Set(parseMulti(value)), [value]);
  const sortedSelected = useMemo(() => Array.from(selected).sort(), [selected]);

  const availableSet = useMemo(() => new Set(availableMonths), [availableMonths]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const list: number[] = [];
    for (let y = now + yearsForward; y >= now - yearsBack; y--) list.push(y);
    availableMonths.forEach(m => {
      const y = parseInt(m.slice(0, 4), 10);
      if (!list.includes(y)) list.push(y);
    });
    // Also include years from selected (e.g. older selections)
    sortedSelected.forEach(m => {
      const y = parseInt(m.slice(0, 4), 10);
      if (!list.includes(y)) list.push(y);
    });
    return list.sort((a, b) => b - a);
  }, [availableMonths, yearsBack, yearsForward, sortedSelected]);

  const label = useMemo(() => {
    if (selected.size === 0) return allowEmpty ? emptyLabel : placeholder;
    if (selected.size === 1) return formatMonth(sortedSelected[0]);
    // Detect contiguous range across calendar (not just available)
    const isContiguous = sortedSelected.every((m, i) => {
      if (i === 0) return true;
      const [py, pm] = sortedSelected[i - 1].split('-').map(Number);
      const [cy, cm] = m.split('-').map(Number);
      const expected = pm === 12 ? `${py + 1}-01` : `${py}-${String(pm + 1).padStart(2, '0')}`;
      return expected === m;
    });
    if (isContiguous) {
      return `${formatMonth(sortedSelected[0])} – ${formatMonth(sortedSelected[sortedSelected.length - 1])}`;
    }
    return `${selected.size} meses`;
  }, [selected, sortedSelected, allowEmpty, emptyLabel, placeholder]);

  const serialize = (set: Set<string>) => Array.from(set).sort().join(',');

  const pickMonth = (m: string, shift: boolean) => {
    if (!multi) {
      onChange(m);
      setOpen(false);
      return;
    }
    const next = new Set(selected);
    if (shift && lastClicked) {
      // Build a contiguous range across calendar months
      const expand = (a: string, b: string) => {
        const [ay, am] = a.split('-').map(Number);
        const [by, bm] = b.split('-').map(Number);
        const start = ay * 12 + (am - 1);
        const end = by * 12 + (bm - 1);
        const [lo, hi] = start < end ? [start, end] : [end, start];
        for (let i = lo; i <= hi; i++) {
          const y = Math.floor(i / 12);
          const mo = (i % 12) + 1;
          next.add(`${y}-${String(mo).padStart(2, '0')}`);
        }
      };
      expand(lastClicked, m);
      setLastClicked(m);
      onChange(serialize(next));
      return;
    }
    if (next.has(m)) next.delete(m); else next.add(m);
    setLastClicked(m);
    onChange(serialize(next));
  };

  const clearAll = () => { setLastClicked(null); onChange(''); };

  const lastN = (n: number) => {
    const now = new Date();
    const set = new Set<string>();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    setLastClicked(null);
    onChange(serialize(set));
  };

  const currentYear = () => {
    const y = new Date().getFullYear();
    const set = new Set<string>();
    for (let i = 1; i <= 12; i++) set.add(`${y}-${String(i).padStart(2, '0')}`);
    setLastClicked(null);
    onChange(serialize(set));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-2 text-xs font-medium min-w-[180px] justify-start', triggerClassName, className)}
        >
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="truncate">{label}</span>
          {multi && selected.size > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="ml-auto opacity-60 hover:opacity-100"
              aria-label="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        {multi && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border">
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={clearAll}>Limpar</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => lastN(3)}>Últimos 3</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => lastN(6)}>Últimos 6</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => lastN(12)}>Últimos 12</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={currentYear}>Ano atual</Button>
          </div>
        )}
        {!multi && allowEmpty && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-xs justify-start mb-2"
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {emptyLabel}
          </Button>
        )}
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {years.map(year => (
            <div key={year}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                {year}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MONTH_NAMES.map((mn, idx) => {
                  const mKey = `${year}-${String(idx + 1).padStart(2, '0')}`;
                  const isSelected = selected.has(mKey);
                  const hasData = availableSet.has(mKey);
                  return (
                    <button
                      key={mn}
                      onClick={(e) => pickMonth(mKey, e.shiftKey)}
                      className={cn(
                        'h-7 text-[11px] rounded border transition-colors relative',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-accent',
                        !isSelected && hasData && 'font-semibold'
                      )}
                    >
                      {mn}
                      {!isSelected && hasData && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {multi && (
          <div className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border">
            Dica: <kbd className="px-1 rounded bg-muted">Shift</kbd>+clique para selecionar intervalo
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
