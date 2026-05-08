import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Ctx {
  /** Mês compartilhado entre as abas no formato 'YYYY-MM', ou null se nenhuma aba selecionou ainda. */
  month: string | null;
  setMonth: (m: string | null) => void;
}

const SharedMonthContext = createContext<Ctx | null>(null);

export function SharedMonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string | null>(null);
  return (
    <SharedMonthContext.Provider value={{ month, setMonth }}>{children}</SharedMonthContext.Provider>
  );
}

export function useSharedMonth(): Ctx {
  const ctx = useContext(SharedMonthContext);
  // Fallback no-op para uso fora do provider (não quebra)
  if (!ctx) return { month: null, setMonth: () => {} };
  return ctx;
}

/**
 * Hook auxiliar: sincroniza um estado local de mês (YYYY-MM) com o mês compartilhado.
 * - Quando o mês compartilhado mudar e for diferente do local, chama setLocal.
 * - Retorna uma função `pushShared(m)` para publicar uma seleção do usuário no contexto.
 */
export function useMonthSync(localMonth: string | null | undefined, setLocal: (m: string) => void) {
  const { month: shared, setMonth: setShared } = useSharedMonth();

  useEffect(() => {
    if (shared && shared !== localMonth) {
      setLocal(shared);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  return (m: string) => {
    if (m && /^\d{4}-\d{2}$/.test(m)) setShared(m);
  };
}
