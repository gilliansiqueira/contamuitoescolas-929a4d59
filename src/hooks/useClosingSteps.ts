import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClosingStepTemplate {
  id: string;
  step_key: string;
  label: string;
  sort_order: number;
  active: boolean;
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
        .select('id, step_key, label, sort_order, active')
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
      queryClient.invalidateQueries({ queryKey: ['management-portfolio', month] });
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
      queryClient.invalidateQueries({ queryKey: ['management-portfolio', month] });
    },
  });
}
