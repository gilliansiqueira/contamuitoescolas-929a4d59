/** Faixa de recência do último acesso do cliente (só acompanhamento). */
export type AccessTone = 'recent' | 'warn' | 'stale' | 'never';

export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** Até 7 dias: verde; 8–30: laranja; mais de 30: vermelho; nunca: vermelho. */
export function accessTone(days: number | null): AccessTone {
  if (days === null) return 'never';
  if (days <= 7) return 'recent';
  if (days <= 30) return 'warn';
  return 'stale';
}

/** Último acesso = o mais recente entre login e abertura diária registrada. */
export function lastAccess(signIn: string | null, seen: string | null): string | null {
  if (!signIn) return seen;
  if (!seen) return signIn;
  return signIn > seen ? signIn : seen;
}
