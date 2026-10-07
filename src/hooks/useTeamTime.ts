import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TeamSituacao = 'regular' | 'atraso' | 'sem_marcacao' | 'incompleta' | 'falta' | 'hora_extra' | 'inconsistencia' | 'aguardando' | 'em_andamento';

export interface TeamEmployee { external_id: string; matricula: string | null; nome: string; horario_previsto: string | null; ativo: boolean; oculto?: boolean; user_id?: string | null }
export interface TeamJustification { id: string; employee_external_id: string; dia: string; motivo: string; status: 'pendente' | 'aceita' | 'recusada'; created_at: string }
export interface TeamDaily { employee_external_id: string; dia: string; horario_previsto: string | null; primeira_marcacao: string | null; ultima_marcacao: string | null; marcacoes?: string[]; horas_trabalhadas: string | null; horas_extras: string | null; situacao: TeamSituacao; ocorrencia: string | null; synced_at: string }
export interface TeamOccurrence { external_key: string; employee_external_id: string; dia: string; tipo: string; descricao: string | null; origem: string }
export interface TeamHourBank { employee_external_id: string; competencia: string; saldo: string | null; saldo_minutos: number | null }
export interface TeamSyncRun { id: string; status: 'running' | 'success' | 'error' | 'not_configured'; started_at: string; finished_at: string | null; message: string | null }

export interface TeamTimeData {
  employees: TeamEmployee[]; hidden?: TeamEmployee[]; daily: TeamDaily[]; occurrences: TeamOccurrence[]; hourBank: TeamHourBank[];
  lastRun: TeamSyncRun | null; lastSuccess: TeamSyncRun | null;
}

// Tabelas team_time_* são protegidas por RLS (somente super_admin). Tipagem local para não depender do arquivo gerado.
const db = supabase as unknown as { from: (t: string) => any };

/** `monthTo` opcional: quando informado, busca o intervalo fechado entre os dois meses. */
export function useTeamTime(month: string, enabled: boolean, monthTo?: string) {
  const endMonth = monthTo && monthTo >= month ? monthTo : month;
  return useQuery({
    queryKey: ['team-time', month, endMonth],
    enabled,
    staleTime: 60_000,
    refetchInterval: q => ((q.state.data as TeamTimeData | undefined)?.lastRun?.status === 'running' ? 5000 : false),
    queryFn: async (): Promise<TeamTimeData> => {
      const start = `${month}-01`;
      const [y, m] = endMonth.split('-').map(Number);
      const end = `${endMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      const meses: string[] = [];
      for (let [yy, mm] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))]; `${yy}-${String(mm).padStart(2, '0')}` <= endMonth; mm++) {
        if (mm > 12) { yy++; mm = 0; }
        meses.push(`${yy}-${String(mm).padStart(2, '0')}`);
      }
      const [e, d, o, b, r, s] = await Promise.all([
        db.from('team_time_employees').select('external_id,matricula,nome,horario_previsto,ativo,oculto,user_id').eq('ativo', true).order('nome'),
        db.from('team_time_daily').select('*').gte('dia', start).lte('dia', end),
        db.from('team_time_occurrences').select('external_key,employee_external_id,dia,tipo,descricao,origem').gte('dia', start).lte('dia', end),
        db.from('team_time_hour_bank').select('employee_external_id,competencia,saldo,saldo_minutos').in('competencia', meses),
        db.from('team_time_sync_runs').select('id,status,started_at,finished_at,message').order('started_at', { ascending: false }).limit(1),
        db.from('team_time_sync_runs').select('id,status,started_at,finished_at,message').eq('status', 'success').order('started_at', { ascending: false }).limit(1),
      ]);
      const err = [e, d, o, b, r, s].find(x => x.error)?.error;
      if (err) throw err;
      const all: TeamEmployee[] = e.data ?? [];
      const vis = new Set(all.filter(x => !x.oculto).map(x => x.external_id));
      const keep = (x: { employee_external_id: string }) => vis.has(x.employee_external_id);
      return { employees: all.filter(x => !x.oculto), hidden: all.filter(x => x.oculto), daily: (d.data ?? []).filter(keep), occurrences: (o.data ?? []).filter(keep), hourBank: (b.data ?? []).filter(keep), lastRun: r.data?.[0] ?? null, lastSuccess: s.data?.[0] ?? null };
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

export function useSetEmployeeHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { external_id: string; hidden: boolean }) => {
      const { data, error } = await supabase.functions.invoke('pontofopag-sync', { body: { action: 'set_employee_hidden', ...p } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
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
  const employees = names.map((nome, i) => ({ external_id: `ex-${i}`, matricula: String(100 + i), nome, horario_previsto: '08:00 13:00 14:00 17:48', ativo: true }));
  const daily: TeamDaily[] = employees.map((e, i) => {
    const sit = sits[i];
    const marc: string[] = { regular: ['07:58', '13:00', '14:00', '17:50'], atraso: ['08:27', '13:00', '14:00', '17:50'], sem_marcacao: [], incompleta: ['07:58', '13:00', '17:50'], hora_extra: ['07:58', '13:00', '14:00', '19:05'], aguardando: ['07:58', '17:50'] }[sit] ?? [];
    return {
      employee_external_id: e.external_id, dia: today, horario_previsto: e.horario_previsto, marcacoes: marc,
      primeira_marcacao: marc[0] ?? null,
      ultima_marcacao: marc.length > 1 ? marc[marc.length - 1] : null,
      horas_trabalhadas: sit === 'sem_marcacao' ? null : sit === 'hora_extra' ? '10:07' : '08:48',
      horas_extras: sit === 'hora_extra' ? '01:19' : null, situacao: sit,
      ocorrencia: sit === 'atraso' ? 'Entrada atrasada' : sit === 'incompleta' ? 'Marcação incorreta' : sit === 'hora_extra' ? 'Horas extras' : null,
      synced_at: new Date().toISOString(),
    };
  });
  const occurrences: TeamOccurrence[] = daily.filter(d => d.ocorrencia).map(d => ({ external_key: `${d.employee_external_id}-${d.dia}`, employee_external_id: d.employee_external_id, dia: d.dia, tipo: d.ocorrencia!, descricao: null, origem: 'ocorrencias' }));
  const hourBank = employees.map((e, i) => ({ employee_external_id: e.external_id, competencia: today.slice(0, 7), saldo: ['+02:10', '-00:45', '-08:48', '+00:00', '+05:30', '-12:15'][i], saldo_minutos: [130, -45, -528, 0, 330, -735][i] }));
  const run: TeamSyncRun = { id: 'sample', status: 'success', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), message: null };
  return { employees, daily, occurrences, hourBank, lastRun: run, lastSuccess: run };
}

/** Grava o Relatório de Cartão Ponto já conferido (sem CPF/PIS) pela função do servidor. */
export function useTeamTimeImportReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { arquivo: string; periodoInicio: string; periodoFim: string; funcionarios: unknown[] }) => {
      const { data, error } = await supabase.functions.invoke('pontofopag-sync', { body: { action: 'import_report', ...payload } });
      if (error) throw error;
      if (data?.status !== 'success') throw new Error(data?.message ?? data?.error ?? 'Erro ao gravar');
      return data as { counts: { funcionarios: number; dias: number; ocorrencias: number } };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team-time'] }),
  });
}

/** Vincula (ou desvincula) o login de uma pessoa ao cadastro do ponto. Só super_admin, via Edge Function. */
export function useLinkEmployeeUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { external_id: string; user_id: string | null }) => {
      const { data, error } = await supabase.functions.invoke('pontofopag-sync', { body: { action: 'link_user', ...p } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team-time'] }),
  });
}

/** Ponto da própria pessoa logada (RLS libera apenas o vínculo dela). */
export function useMyTeamTime(month: string, userId: string | undefined) {
  return useQuery({
    queryKey: ['team-time-mine', month, userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: emp } = await db.from('team_time_employees').select('external_id,matricula,nome,horario_previsto,ativo,oculto,user_id').eq('user_id', userId).maybeSingle();
      if (!emp || emp.oculto) return null;
      const start = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      const [d, j] = await Promise.all([
        db.from('team_time_daily').select('*').eq('employee_external_id', emp.external_id).gte('dia', start).lte('dia', end),
        db.from('team_time_justifications').select('id,employee_external_id,dia,motivo,status,created_at').eq('employee_external_id', emp.external_id).gte('dia', start).lte('dia', end),
      ]);
      const err = [d, j].find(x => x.error)?.error;
      if (err) throw err;
      return { employee: emp as TeamEmployee, daily: (d.data ?? []) as TeamDaily[], justifications: (j.data ?? []) as TeamJustification[] };
    },
  });
}

export function useTeamJustifications(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['team-time-just', month],
    enabled,
    queryFn: async (): Promise<TeamJustification[]> => {
      const [y, m] = month.split('-').map(Number);
      const { data, error } = await db.from('team_time_justifications').select('id,employee_external_id,dia,motivo,status,created_at')
        .gte('dia', `${month}-01`).lte('dia', `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`).order('dia', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveJustification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id?: string; employee_external_id: string; dia: string; motivo: string }) => {
      const r = p.id
        ? await db.from('team_time_justifications').update({ motivo: p.motivo }).eq('id', p.id)
        : await db.from('team_time_justifications').insert({ employee_external_id: p.employee_external_id, dia: p.dia, motivo: p.motivo });
      if (r.error) throw r.error;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['team-time-mine'] }); qc.invalidateQueries({ queryKey: ['team-time-just'] }); },
  });
}

export function useReviewJustification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; status: 'aceita' | 'recusada' | 'pendente'; reviewer: string }) => {
      const { error } = await db.from('team_time_justifications').update({ status: p.status, revisado_por: p.status === 'pendente' ? null : p.reviewer, revisado_em: p.status === 'pendente' ? null : new Date().toISOString() }).eq('id', p.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team-time-just'] }),
  });
}
