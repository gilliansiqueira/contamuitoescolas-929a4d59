/** Horário corrigido pela super_admin: recalcula extras/atrasos a partir das batidas (regras puras). */
import type { TeamDaily } from '@/hooks/useTeamTime';

const RE = /^\d{1,2}:\d{2}$/;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
/** Tolerância diária (CLT art. 58 §1º): até 10 min não geram extra nem atraso. */
export const TOLERANCIA_MIN = 10;

export function pairsMinutes(times: string[]): number | null {
  const t = times.filter(x => RE.test(x));
  if (t.length < 2 || t.length % 2) return null;
  let s = 0;
  for (let i = 0; i < t.length; i += 2) s += toMin(t[i + 1]) - toMin(t[i]);
  return s;
}

export function parseSchedule(s?: string | null): string[] | null {
  const t = (s ?? '').trim().split(/\s+/).filter(x => RE.test(x));
  return pairsMinutes(t) ? t : null;
}

export function applyScheduleOverride(d: TeamDaily, override?: string | null): TeamDaily {
  const sched = parseSchedule(override);
  if (!sched) return d;
  const base = { ...d, horario_previsto: sched.join(' ') };
  const marc = d.marcacoes ?? [];
  if (!marc.length) return base; // sem batida: falta/feriado/atestado seguem as regras atuais
  const semFaltas = (d.ocorrencia ?? '').replace(/Faltas\s+\d+:\d{2}(\s*\([^)]*\))?/i, '').trim() || null;
  const worked = pairsMinutes(marc);
  if (worked == null) return { ...base, horas_extras: null, ocorrencia: semFaltas };
  const diff = worked - pairsMinutes(sched)!;
  if (diff > TOLERANCIA_MIN) return { ...base, horas_extras: hhmm(diff), ocorrencia: semFaltas, situacao: d.situacao === 'incompleta' ? d.situacao : 'hora_extra' };
  if (diff < -TOLERANCIA_MIN) return { ...base, horas_extras: null, ocorrencia: `Faltas ${hhmm(-diff)} (horário corrigido)` };
  return { ...base, horas_extras: null, ocorrencia: semFaltas, situacao: d.situacao === 'incompleta' ? d.situacao : 'regular' };
}
