import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';

/**
 * Fonte única de filtro de período para o app inteiro.
 * `value` segue o formato do MonthSelector: 'all' ou 'YYYY-MM,YYYY-MM,...'
 * Persistido por escola em localStorage.
 */
interface Ctx {
  schoolId: string | null;
  /** Valor cru (compatível com MonthSelector): 'all' ou 'YYYY-MM,...'. */
  value: string;
  setValue: (v: string) => void;
  /** Meses selecionados ordenados (vazio se 'all'). */
  months: string[];
  /** Mês inicial da seleção (ou null se 'all'). */
  startMonth: string | null;
  /** Mês final da seleção (ou null se 'all'). */
  endMonth: string | null;
}

const GlobalPeriodContext = createContext<Ctx | null>(null);

function defaultValue(): string {
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months.join(',');
}

interface ProviderProps {
  schoolId: string;
  children: ReactNode;
}

export function GlobalPeriodProvider({ schoolId, children }: ProviderProps) {
  const storageKey = `global-period:${schoolId}`;

  const [value, setValueState] = useState<string>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw && typeof raw === 'string') return raw;
    } catch { /* ignore */ }
    return defaultValue();
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, value); } catch { /* ignore */ }
  }, [value, storageKey]);

  const setValue = useCallback((v: string) => setValueState(v || 'all'), []);

  const months = useMemo(() => {
    if (!value || value === 'all') return [];
    return value.split(',').map(s => s.trim()).filter(Boolean).sort();
  }, [value]);

  const startMonth = months[0] ?? null;
  const endMonth = months[months.length - 1] ?? null;

  return (
    <GlobalPeriodContext.Provider value={{ schoolId, value, setValue, months, startMonth, endMonth }}>
      {children}
    </GlobalPeriodContext.Provider>
  );
}

export function useGlobalPeriod(): Ctx {
  const ctx = useContext(GlobalPeriodContext);
  if (!ctx) {
    return {
      schoolId: null,
      value: 'all',
      setValue: () => {},
      months: [],
      startMonth: null,
      endMonth: null,
    };
  }
  return ctx;
}
