import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useAvailableMonths } from '@/hooks/useFinancialData';

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

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface ProviderProps {
  schoolId: string;
  children: ReactNode;
}

export function GlobalPeriodProvider({ schoolId, children }: ProviderProps) {
  const storageKey = `global-period:${schoolId}`;

  // null = ainda não definido (aguardando meses disponíveis da escola).
  const [value, setValueState] = useState<string | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw && typeof raw === 'string') return raw;
    } catch { /* ignore */ }
    return null;
  });

  // Ao trocar de escola, recarrega a seleção salva (ou volta a "não definido").
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    } catch { /* ignore */ }
    setValueState(saved && typeof saved === 'string' ? saved : null);
  }, [storageKey]);

  const { data: availableMonths } = useAvailableMonths(schoolId);

  // Primeira abertura da escola: abre no último mês com lançamentos.
  useEffect(() => {
    if (value !== null) return;
    if (!availableMonths) return;
    const last = availableMonths.length > 0
      ? availableMonths[availableMonths.length - 1]
      : currentMonth();
    setValueState(last);
  }, [availableMonths, value]);

  useEffect(() => {
    if (value === null) return;
    try { localStorage.setItem(storageKey, value); } catch { /* ignore */ }
  }, [value, storageKey]);

  const setValue = useCallback((v: string) => setValueState(v || 'all'), []);

  const effectiveValue = value ?? 'all';

  const months = useMemo(() => {
    if (!effectiveValue || effectiveValue === 'all') return [];
    return effectiveValue.split(',').map(s => s.trim()).filter(Boolean).sort();
  }, [effectiveValue]);

  const startMonth = months[0] ?? null;
  const endMonth = months[months.length - 1] ?? null;

  return (
    <GlobalPeriodContext.Provider value={{ schoolId, value: effectiveValue, setValue, months, startMonth, endMonth }}>
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
