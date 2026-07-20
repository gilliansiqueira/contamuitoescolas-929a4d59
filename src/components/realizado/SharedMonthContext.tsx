import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useGlobalPeriod } from '@/contexts/GlobalPeriodContext';

interface Ctx {
  /** Mês compartilhado (single) 'YYYY-MM' ou null. */
  month: string | null;
  setMonth: (m: string | null) => void;
  /** Range compartilhado (multi): 'all' ou 'YYYY-MM,YYYY-MM,...'. */
  range: string | null;
  setRange: (r: string | null) => void;
}

const SharedMonthContext = createContext<Ctx | null>(null);

export function SharedMonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string | null>(null);
  const [range, setRange] = useState<string | null>(null);
  return (
    <SharedMonthContext.Provider value={{ month, setMonth, range, setRange }}>
      <GlobalBridge />
      {children}
    </SharedMonthContext.Provider>
  );
}

/**
 * Bridge: quando o GlobalPeriodProvider está acima, sincroniza automaticamente
 * o mês/range compartilhado com o filtro global. Sub-tabs continuam usando
 * `useMonthSync` / `useRangeSync` para reagir sem alterações.
 */
function GlobalBridge() {
  const global = useGlobalPeriod();
  const ctx = useContext(SharedMonthContext);
  useEffect(() => {
    if (!ctx) return;
    if (global.endMonth) ctx.setMonth(global.endMonth);
    ctx.setRange(global.value || 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [global.value, global.endMonth]);
  return null;
}

export function useSharedMonth(): Ctx {
  const ctx = useContext(SharedMonthContext);
  if (!ctx) return { month: null, setMonth: () => {}, range: null, setRange: () => {} };
  return ctx;
}

/**
 * Sincroniza um mês local (single) com o mês compartilhado.
 * Retorna pushShared(m) para publicar uma seleção local.
 */
export function useMonthSync(localMonth: string | null | undefined, setLocal: (m: string) => void) {
  const { month: shared, setMonth: setShared } = useSharedMonth();

  useEffect(() => {
    if (shared && shared !== localMonth) setLocal(shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  return (m: string) => {
    if (m && /^\d{4}-\d{2}$/.test(m)) setShared(m);
  };
}

/**
 * Sincroniza um range local ('all' ou comma-sep) com o range compartilhado.
 * Retorna pushShared(r) para publicar uma seleção local.
 */
export function useRangeSync(localRange: string | null | undefined, setLocal: (r: string) => void) {
  const { range: shared, setRange: setShared } = useSharedMonth();

  useEffect(() => {
    if (shared && shared !== localRange) setLocal(shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  return (r: string) => {
    if (typeof r === 'string') setShared(r);
  };
}
