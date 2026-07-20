import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';

/**
 * Contexto global de período (mês inicial + mês final) que serve como
 * FONTE ÚNICA de filtro para todas as abas do app. Persistido por escola
 * em localStorage.
 *
 * `range` é serializado como string compatível com o MonthSelector:
 *   - 'all'  → todos os meses
 *   - 'YYYY-MM,YYYY-MM,...' → lista de meses no intervalo (inclusivo)
 */
interface Ctx {
  schoolId: string | null;
  startMonth: string | null;   // 'YYYY-MM' ou null (=> 'all')
  endMonth: string | null;     // 'YYYY-MM' ou null (=> 'all')
  months: string[];            // lista expandida
  range: string;               // 'all' ou 'YYYY-MM,YYYY-MM,...'
  setRange: (start: string | null, end: string | null) => void;
}

const GlobalPeriodContext = createContext<Ctx | null>(null);

function expand(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
  const [ys, ms] = start.split('-').map(Number);
  const [ye, me] = end.split('-').map(Number);
  const out: string[] = [];
  let y = ys, m = ms;
  while (y < ye || (y === ye && m <= me)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function defaultRange(): [string, string] {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  return [start, end];
}

interface ProviderProps {
  schoolId: string;
  children: ReactNode;
}

export function GlobalPeriodProvider({ schoolId, children }: ProviderProps) {
  const storageKey = `global-period:${schoolId}`;

  const [state, setState] = useState<{ start: string | null; end: string | null }>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.start === 'string' && typeof p?.end === 'string') {
          return { start: p.start, end: p.end };
        }
        if (p?.start === null && p?.end === null) return { start: null, end: null };
      }
    } catch { /* ignore */ }
    const [s, e] = defaultRange();
    return { start: s, end: e };
  });

  // Persist per school
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, storageKey]);

  const setRange = useCallback((start: string | null, end: string | null) => {
    if (start && end && start > end) [start, end] = [end, start];
    setState({ start, end });
  }, []);

  const months = useMemo(() => expand(state.start, state.end), [state.start, state.end]);
  const range = useMemo(() => (months.length ? months.join(',') : 'all'), [months]);

  return (
    <GlobalPeriodContext.Provider value={{
      schoolId,
      startMonth: state.start,
      endMonth: state.end,
      months,
      range,
      setRange,
    }}>
      {children}
    </GlobalPeriodContext.Provider>
  );
}

export function useGlobalPeriod(): Ctx {
  const ctx = useContext(GlobalPeriodContext);
  if (!ctx) {
    return {
      schoolId: null,
      startMonth: null,
      endMonth: null,
      months: [],
      range: 'all',
      setRange: () => {},
    };
  }
  return ctx;
}
