import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TeamSituacao = 'regular' | 'atraso' | 'sem_marcacao' | 'incompleta' | 'falta' | 'hora_extra' | 'inconsistencia' | 'aguardando';

export interface TeamEmployee { external_id: string; matricula: string | null; nome: string; horario_previsto: string | null; ativo: boolean }
export interface TeamDaily { employee_external_id: string; dia: string; horario_previsto: string | null; primeira_marcacao: string | null; ultima_marcacao: string | null; horas_trabalhadas: string | null; horas_extras: string | null; situacao: TeamSituacao; ocorrencia: string | null; synced_at: string }
export interface TeamOccurrence { external_key: string; employee_external_id: string; dia: string; tipo: string; descricao: string | null; origem: string }
export interface TeamHourBank { employee_external_id: string; competencia: string; saldo: string | null; saldo_minutos: number | null }
export interface TeamSyncRun { id: string; status: 'running' | 'success' | 'error' | 'not_configured'; started_at: string; finished_at: string | null; message: string | null }

export interface TeamTimeData {
  employees: TeamEmployee[]; daily: TeamDaily[]; occurrences: TeamOccurrence[]; hourBank: TeamHourBank[];
  lastRun: TeamSyncRun | null; lastSuccess: TeamSyncRun | null;
}

// Tabelas team_time_* são protegidas por RLS (somente super_admin). Tipagem local para não depender do arquivo gerado.
const db = supabase as unknown as { from: (t: string) => any };

export function useTeamTime(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['team-time', month],
    enabled,
    staleTime: 60_000,
    refetchInterval: q => ((q.state.data as TeamTimeData | undefined)?.lastRun?.status === 'running' ? 5000 : false),
    queryFn: async (): Promise<TeamTimeData> => {
      const start = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      const [e, d, o, b, r, s] = await Promise.all([
        db.from('team_time_employees').select('external_id,matricula,nome,horario_previsto,ativo').eq('ativo', true).order('nome'),
        db.from('team_time_daily').select('*').gte('dia', start).lte('dia', end),
        db.from('team_time_occurrences').select('external_key,employee_external_id,dia,tipo,descricao,origem').gte('dia', start).lte('dia', end),
        db.from('team_time_hour_bank').select('employee_external_id,competencia,saldo,saldo_minutos').eq('competencia', month),
        db.from('team_time_sync_runs').select('id,status,started_at,finished_at,message').order('started_at', { ascending: false }).limit(1),
        db.from('team_time_sync_runs').select('id,status,started_at,finished_at,message').eq('status', 'success').order('started_at', { ascending: false }).limit(1),
      ]);
      const err = [e, d, o, b, r, s].find(x => x.error)?.error;
      if (err) throw err;
      return { employees: e.data ?? [], daily: d.data ?? [], occurrences: o.data ?? [], hourBank: b.data ?? [], lastRun: r.data?.[0] ?? null, lastSuccess: s.data?.[0] ?? null };
    },
  });
}

export function useTeamTimeSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pontofopag-sync', { body: {} });
      if (error) throw error;
      return data as { configured: boolean; status?: string; message?: string };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team-time'] }),
  });
}

/** Dados fictícios só para desenvolvimento/preview. Nunca são gravados no banco. */
export function isPreviewEnv() {
  if (import.meta.env.DEV) return true;
  const h = typeof window !== 'undefined' ? window.location.hostname : '';
  return h === 'localhost' || h.includes('id-preview--') || h.includes('lovableproject.com');
}

export function buildSampleData(today: string): TeamTimeData {
  const names = ['Ana Souza', 'Beatriz Lima', 'Carla Mendes', 'Daniela Rocha', 'Eduarda Alves', 'Fernanda Costa'];
  const sits: TeamSituacao[] = ['regular', 'atraso', 'sem_marcacao', 'incompleta', 'hora_extra', 'aguardando'];
  const employees = names.map((nome, i) => ({ external_id: `ex-${i}`, matricula: String(100 + i), nome, horario_previsto: '08:00 - 17:48', ativo: true }));
  const daily: TeamDaily[] = employees.map((e, i) => ({
    employee_external_id: e.external_id, dia: today, horario_previsto: e.horario_previsto,
    primeira_marcacao: sits[i] === 'sem_marcacao' ? null : sits[i] === 'atraso' ? '08:27' : '07:58',
    ultima_marcacao: ['regular', 'hora_extra'].includes(sits[i]) ? (sits[i] === 'hora_extra' ? '19:05' : '17:50') : null,
    horas_trabalhadas: sits[i] === 'sem_marcacao' ? null : sits[i] === 'hora_extra' ? '10:07' : '08:48',
    horas_extras: sits[i] === 'hora_extra' ? '01:19' : null, situacao: sits[i],
    ocorrencia: sits[i] === 'atraso' ? 'Entrada atrasada' : sits[i] === 'incompleta' ? 'Marcação incorreta' : sits[i] === 'hora_extra' ? 'Horas extras' : null,
    synced_at: new Date().toISOString(),
  }));
  const occurrences: TeamOccurrence[] = daily.filter(d => d.ocorrencia).map(d => ({ external_key: `${d.employee_external_id}-${d.dia}`, employee_external_id: d.employee_external_id, dia: d.dia, tipo: d.ocorrencia!, descricao: null, origem: 'ocorrencias' }));
  const hourBank = employees.map((e, i) => ({ employee_external_id: e.external_id, competencia: today.slice(0, 7), saldo: ['+02:10', '-00:45', '-08:48', '+00:00', '+05:30', '-12:15'][i], saldo_minutos: [130, -45, -528, 0, 330, -735][i] }));
  const run: TeamSyncRun = { id: 'sample', status: 'success', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), message: null };
  return { employees, daily, occurrences, hourBank, lastRun: run, lastSuccess: run };
}
