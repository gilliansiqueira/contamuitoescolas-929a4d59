import { supabase } from '@/integrations/supabase/client';

export type ActivityKind = 'sino_aberto' | 'meudia_aberto' | 'aviso_clicado' | 'aviso_visto' | 'guia_lido' | 'popup_entendi';
const last = new Map<string, number>();

/** Registra uso da equipe (sininho, Meu Dia, avisos, guias). Evita repetir o mesmo evento em 5 min. */
export function logActivity(kind: ActivityKind, opts: { schoolId?: string | null; ref?: string | null } = {}) {
  const k = `${kind}|${opts.schoolId ?? ''}|${opts.ref ?? ''}`;
  const now = Date.now();
  if ((last.get(k) ?? 0) > now - 5 * 60_000) return;
  last.set(k, now);
  void (supabase as any).from('team_activity_events').insert({ kind, school_id: opts.schoolId ?? null, ref: opts.ref ?? null }).then(() => {});
}
