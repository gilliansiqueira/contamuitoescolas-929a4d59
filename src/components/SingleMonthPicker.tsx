import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Selected month in 'YYYY-MM' format. Empty string means "no selection" (use placeholder). */
  value: string;
  onChange: (m: string) => void;
  /** Months available with data (for highlighting). All months in current ± yearsRange years are clickable regardless. */
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
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonth(m: string) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]}/${y}`;
}

export function SingleMonthPicker({
  value, onChange, availableMonths = [], placeholder = 'Selecionar mês',
  allowEmpty = false, emptyLabel = 'Todos', className,
  yearsBack = 3, yearsForward = 1, triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  const availableSet = useMemo(() => new Set(availableMonths), [availableMonths]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const list: number[] = [];
    for (let y = now + yearsForward; y >= now - yearsBack; y--) list.push(y);
    // Include any year from available beyond range
    availableMonths.forEach(m => {
      const y = parseInt(m.slice(0, 4), 10);
      if (!list.includes(y)) list.push(y);
    });
    return list.sort((a, b) => b - a);
  }, [availableMonths, yearsBack, yearsForward]);

  const label = value ? formatMonth(value) : (allowEmpty ? emptyLabel : placeholder);

  const pickMonth = (m: string) => {
    onChange(m);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-2 text-xs font-medium min-w-[160px] justify-start', triggerClassName, className)}
        >
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-3" align="start">
        {allowEmpty && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-xs justify-start mb-2"
            onClick={() => pickMonth('')}
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
                  const isSelected = value === mKey;
                  const hasData = availableSet.has(mKey);
                  return (
                    <button
                      key={mn}
                      onClick={() => pickMonth(mKey)}
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
      </PopoverContent>
    </Popover>
  );
}
