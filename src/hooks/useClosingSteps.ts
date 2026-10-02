import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClosingStepTemplate {
  id: string;
  step_key: string;
  label: string;
  sort_order: number;
  active: boolean;
  check_kind?: string;
  group_key?: string | null;
}

export interface SchoolStepOverride {
  id: string;
  school_id: string;
  template_id: string | null;
  step_key: string;
  label: string | null;
  disabled: boolean;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  school_id: string;
  month: string;
  step_key: string;
  label: string;
  source: string;
  status: 'open' | 'completed' | 'not_applicable';
  completed_by: string | null;
  completed_at: string | null;
  note: string | null;
}

export function useClosingStepTemplates(enabled: boolean) {
  return useQuery({
    queryKey: ['closing-step-templates'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closing_step_templates')
        .select('id, step_key, label, sort_order, active, check_kind, group_key')
        .order('sort_order')
        .order('label');
      if (error) throw error;
      return (data ?? []) as ClosingStepTemplate[];
    },
  });
}

export function useSaveClosingStepTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: { id?: string; step_key: string; label: string; sort_order: number; active: boolean }) => {
      if (template.id) {
        const { error } = await supabase
          .from('closing_step_templates')
          .update({ label: template.label, sort_order: template.sort_order, active: template.active })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('closing_step_templates')
          .insert({ step_key: template.step_key, label: template.label, sort_order: template.sort_order, active: template.active });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['closing-step-templates'] }),
  });
}

export function useSchoolStepOverrides(schoolId: string | null) {
  return useQuery({
    queryKey: ['school-step-overrides', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_closing_step_overrides')
        .select('id, school_id, template_id, step_key, label, disabled, sort_order')
        .eq('school_id', schoolId!)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as SchoolStepOverride[];
    },
  });
}

export function useSaveSchoolStepOverride(schoolId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (override: { template_id: string | null; step_key: string; label: string | null; disabled: boolean; sort_order: number }) => {
      if (!schoolId) throw new Error('Empresa não selecionada.');
      const { error } = await supabase
        .from('school_closing_step_overrides')
        .upsert({
          school_id: schoolId,
          template_id: override.template_id,
          step_key: override.step_key,
          label: override.label,
          disabled: override.disabled,
          sort_order: override.sort_order,
        }, { onConflict: 'school_id,step_key' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school-step-overrides', schoolId] }),
  });
}

export function useDeleteSchoolStepOverride(schoolId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (overrideId: string) => {
      const { error } = await supabase.from('school_closing_step_overrides').delete().eq('id', overrideId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school-step-overrides', schoolId] }),
  });
}

export function useMonthlyChecklist(schoolId: string | null, month: string) {
  return useQuery({
    queryKey: ['monthly-checklist', schoolId, month],
    enabled: !!schoolId && /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_closing_checklist')
        .select('id, school_id, month, step_key, label, source, status, completed_by, completed_at, note')
        .eq('school_id', schoolId!)
        .eq('month', month)
        .order('label');
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });
}

/** Snapshot de etapas do mês para os cards da carteira; a página de dados evita o limite de 1.000 linhas. */
export function useMonthlyChecklistSummary(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['monthly-checklist-summary', month],
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const bySchool = new Map<string, Pick<ChecklistItem, 'step_key' | 'status'>[]>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('monthly_closing_checklist')
          .select('school_id, step_key, status').eq('month', month).order('id').range(from, from + 999);
        if (error) throw error;
        for (const item of data ?? []) bySchool.set(item.school_id, [...(bySchool.get(item.school_id) ?? []), { step_key: item.step_key, status: item.status as ChecklistItem['status'] }]);
        if (!data || data.length < 1000) break;
      }
      return bySchool;
    },
  });
}

export function useEnsureMonthlyChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ schoolId, month }: { schoolId: string; month: string }) => {
      const { data, error } = await supabase.rpc('ensure_monthly_checklist', { _school_id: schoolId, _month: month });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (_inserted, { schoolId, month }) => {
      queryClient.invalidateQueries({ queryKey: ['monthly-checklist', schoolId, month] });
      queryClient.invalidateQueries({ queryKey: ['monthly-checklist-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['management-portfolio', month] });
      queryClient.invalidateQueries({ queryKey: ['management-portfolio'] });
    },
  });
}

export function useSetChecklistStatus(schoolId: string | null, month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'completed' | 'not_applicable' }) => {
      const { error } = await supabase
        .from('monthly_closing_checklist')
        .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-checklist', schoolId, month] });
      queryClient.invalidateQueries({ queryKey: ['monthly-checklist-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['management-portfolio', month] });
      queryClient.invalidateQueries({ queryKey: ['management-portfolio'] });
    },
  });
}

// ---------- Tarefas do dia ----------
export interface DailyTask {
  id: string;
  school_id: string;
  day: string;
  task_key: string;
  label: string;
  sort_order: number;
  check_kind: string;
  status: 'open' | 'completed' | 'not_applicable' | 'done_with_pending';
  source: string;
  completed_at: string | null;
}

/** Gera (idempotente) e resume as tarefas do dia de várias empresas. */
export function useDailyTasksSummary(schoolIds: string[], day: string) {
  const key = [...schoolIds].sort().join(',');
  return useQuery({
    queryKey: ['daily-tasks-summary', key, day],
    enabled: schoolIds.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day),
    staleTime: 60_000,
    queryFn: async () => {
      await Promise.all(schoolIds.map(id => supabase.rpc('ensure_daily_tasks', { _school_id: id, _day: day })));
      const { data, error } = await supabase
        .from('daily_task_checklist')
        .select('school_id, status')
        .eq('day', day)
        .in('school_id', schoolIds);
      if (error) throw error;
      const map = new Map<string, { done: number; total: number }>();
      (data ?? []).forEach(row => {
        const cur = map.get(row.school_id) ?? { done: 0, total: 0 };
        cur.total += 1;
        if (row.status !== 'open') cur.done += 1;
        map.set(row.school_id, cur);
      });
      return map;
    },
  });
}

export function useDailyTasks(schoolId: string | null, day: string) {
  return useQuery({
    queryKey: ['daily-tasks', schoolId, day],
    enabled: !!schoolId,
    queryFn: async () => {
      await supabase.rpc('ensure_daily_tasks', { _school_id: schoolId!, _day: day });
      const { data, error } = await supabase
        .from('daily_task_checklist')
        .select('id, school_id, day, task_key, label, sort_order, check_kind, status, source, completed_at')
        .eq('school_id', schoolId!)
        .eq('day', day)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as DailyTask[];
    },
  });
}

export function useSetDailyTaskStatus(schoolId: string | null, day: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DailyTask['status'] }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('daily_task_checklist')
        .update({ status, source: 'manual', completed_by: status === 'open' ? null : auth.user?.id ?? null, completed_at: status === 'open' ? null : new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', schoolId, day] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks-summary'] });
    },
  });
}
