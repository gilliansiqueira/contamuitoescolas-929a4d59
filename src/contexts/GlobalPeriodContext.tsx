import { supabase } from '@/integrations/supabase/client';
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
  /** CNPJ selecionado: 'all' | 'none' | id (só empresas com mais de um CNPJ). */
  entityId: string;
  setEntityId: (v: string) => void;
  entities: { id: string; nome: string; cnpj: string }[];
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

  const entKey = `global-entity:${schoolId}`;
  const [entityId, setEntityIdState] = useState<string>(() => { try { return localStorage.getItem(entKey) || 'all'; } catch { return 'all'; } });
  const setEntityId = useCallback((v: string) => { setEntityIdState(v); setCurrentEntity(v); try { localStorage.setItem(entKey, v); } catch { /* ignore */ } }, [entKey]);
  const [entities, setEntities] = useState<Ctx['entities']>([]);
  useEffect(() => {
    if (!schoolId) return;
    supabase.from('company_entities' as any).select('id,nome,cnpj').eq('school_id', schoolId).order('sort_order')
      .then(({ data }) => {
        const list = (data as any[]) || [];
        setEntities(list);
        if (list.length < 2 || (entityId !== 'all' && entityId !== 'none' && !list.some(e => e.id === entityId))) setEntityId('all');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);
  setCurrentEntity(entityId);

  return (
    <GlobalPeriodContext.Provider value={{ schoolId, value: effectiveValue, setValue, months, startMonth, endMonth, entityId, setEntityId, entities }}>
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
      entityId: 'all',
      setEntityId: () => {},
      entities: [],
    };
  }
  return ctx;
}

let currentEntity = 'all';
function setCurrentEntity(v: string) { currentEntity = v; }
/** CNPJ selecionado atualmente (para hooks de dados). */
export function getCurrentEntity() { return currentEntity; }
/** Aplica o filtro de CNPJ numa query do banco. */
export function applyEntityFilter<T>(q: T, entityId: string): T {
  if (entityId === 'none') return (q as any).is('entity_id', null);
  if (entityId && entityId !== 'all') return (q as any).eq('entity_id', entityId);
  return q;
}
/** Hook curto: CNPJ selecionado. */
export function useEntityFilter() { return useGlobalPeriod().entityId; }

/** Visão de um CNPJ: lançamentos dele + compartilhados (sem CNPJ), rateados por entity_allocation_rates em scaleSharedRows. 'all' não altera nada. */
export function applyEntityFilterShared<T>(q: T, entityId: string): T {
  if (entityId && entityId !== 'all' && entityId !== 'none') return (q as any).or(`entity_id.eq.${entityId},entity_id.is.null`);
  return applyEntityFilter(q, entityId);
}
export async function scaleSharedRows<R extends { entity_id?: string | null; data?: string; valor?: any }>(rows: R[], entityId: string, schoolId: string): Promise<R[]> {
  if (!entityId || entityId === 'all' || entityId === 'none') return rows;
  const { data } = await supabase.from('entity_allocation_rates' as any).select('month,pct').eq('school_id', schoolId).eq('entity_id', entityId);
  const rates = new Map<string, number>(((data as any[]) || []).map(r => [r.month, Number(r.pct)]));
  const out: R[] = [];
  for (const r of rows) {
    if (r.entity_id) { out.push(r); continue; }
    const pct = rates.get(String(r.data || '').slice(0, 7));
    if (pct === undefined || pct <= 0) continue;
    out.push({ ...r, valor: Math.round(Number(r.valor) * pct * 100) / 100 });
  }
  return out;
}
