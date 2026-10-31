export type CentroModo = 'realizado' | 'previsto' | 'ambos';

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^deserto do\s+/, '').trim();

/** Liga o centro gravado no recebimento previsto ao grupo do Centro de Custos pelo nome. */
export function matchGrupo<G extends { id: string; name: string }>(centro: string | null | undefined, groups: G[]): G | undefined {
  const c = norm(centro || '');
  const fallback = groups.find(g => norm(g.name) === 'a classificar');
  if (!c) return fallback;
  return groups.find(g => norm(g.name) === c) || fallback;
}

/** Previsto + Realizado: meses com realizado usam o realizado; os demais usam o previsto (sem dupla contagem). */
export function combinarItens<T extends { data: string }>(realizado: T[], previsto: T[], modo: CentroModo): T[] {
  if (modo === 'realizado') return realizado;
  if (modo === 'previsto') return previsto;
  const mesesReal = new Set(realizado.map(i => i.data?.slice(0, 7)));
  return [...realizado, ...previsto.filter(i => !mesesReal.has(i.data?.slice(0, 7)))];
}
