import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KpiIcon, KpiDefinition, KpiThreshold, KpiValue, KpiDefinitionWithThresholds } from './types';
import { useMemo } from 'react';

export function useKpiIcons(schoolId: string) {
  return useQuery({
    queryKey: ['kpi_icons', schoolId],
    queryFn: async () => {
      // Busca ícones da escola E ícones globais (school_id IS NULL OR is_global = true)
      const { data, error } = await supabase
        .from('kpi_icons')
        .select('*')
        .or(`school_id.eq.${schoolId},is_global.eq.true`)
        .order('name');
      if (error) throw error;
      return (data ?? []) as KpiIcon[];
    },
  });
}

export function useKpiDefinitions(schoolId: string) {
  const iconsQuery = useKpiIcons(schoolId);

  const defsQuery = useQuery({
    queryKey: ['kpi_definitions', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order');
      if (error) throw error;
      return data as KpiDefinition[];
    },
  });

  const thresholdsQuery = useQuery({
    queryKey: ['kpi_thresholds', schoolId],
    queryFn: async () => {
      if (!defsQuery.data?.length) return [];
      const ids = defsQuery.data.map(d => d.id);
      const { data, error } = await supabase
        .from('kpi_thresholds')
        .select('*')
        .in('kpi_definition_id', ids)
        .order('sort_order');
      if (error) throw error;
      return data as KpiThreshold[];
    },
    enabled: !!defsQuery.data?.length,
  });

  const definitions: KpiDefinitionWithThresholds[] = useMemo(() => {
    if (!defsQuery.data) return [];
    const icons = iconsQuery.data ?? [];
    const thresholds = thresholdsQuery.data ?? [];
    return defsQuery.data.map(d => ({
      ...d,
      value_type: d.value_type as KpiDefinition['value_type'],
      direction: d.direction as KpiDefinition['direction'],
      thresholds: thresholds.filter(t => t.kpi_definition_id === d.id),
      icon: icons.find(i => i.id === d.icon_id),
    }));
  }, [defsQuery.data, iconsQuery.data, thresholdsQuery.data]);

  return {
    definitions,
    isLoading: defsQuery.isLoading || iconsQuery.isLoading,
    icons: iconsQuery.data ?? [],
  };
}

export function useKpiValues(schoolId: string) {
  return useQuery({
    queryKey: ['kpi_values', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_values')
        .select('*')
        .eq('school_id', schoolId)
        .order('month');
      if (error) throw error;
      return data as KpiValue[];
    },
  });
}

export function useKpiMutations(schoolId: string) {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['kpi_definitions', schoolId] });
    qc.invalidateQueries({ queryKey: ['kpi_thresholds', schoolId] });
    qc.invalidateQueries({ queryKey: ['kpi_values', schoolId] });
    qc.invalidateQueries({ queryKey: ['kpi_icons', schoolId] });
  };

  const saveDefinition = useMutation({
    mutationFn: async (def: Partial<KpiDefinition> & { id?: string }) => {
      if (def.id) {
        const { error } = await supabase.from('kpi_definitions').update(def).eq('id', def.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kpi_definitions').insert({ ...def, school_id: schoolId } as any);
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
  });

  const deleteDefinition = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kpi_definitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const saveThresholds = useMutation({
    mutationFn: async ({ kpiId, thresholds }: { kpiId: string; thresholds: Omit<KpiThreshold, 'id' | 'kpi_definition_id' | 'created_at'>[] }) => {
      await supabase.from('kpi_thresholds').delete().eq('kpi_definition_id', kpiId);
      if (thresholds.length) {
        const rows = thresholds.map((t, i) => ({ ...t, kpi_definition_id: kpiId, sort_order: i }));
        const { error } = await supabase.from('kpi_thresholds').insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
  });

  const saveValue = useMutation({
    mutationFn: async (val: { kpi_definition_id: string; month: string; value: number }) => {
      const { error } = await supabase
        .from('kpi_values')
        .upsert({ ...val, school_id: schoolId }, { onConflict: 'school_id,kpi_definition_id,month' });
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const saveIcon = useMutation({
    mutationFn: async (icon: { name: string; file_url: string; id?: string; is_global?: boolean }) => {
      if (icon.id) {
        const { error } = await supabase.from('kpi_icons').update(icon).eq('id', icon.id);
        if (error) throw error;
      } else {
        // Se é global, school_id = null; senão usa schoolId atual
        const payload: any = {
          name: icon.name,
          file_url: icon.file_url,
          is_global: !!icon.is_global,
          school_id: icon.is_global ? null : schoolId,
        };
        const { error } = await supabase.from('kpi_icons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
  });

  const deleteIcon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kpi_icons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  return { saveDefinition, deleteDefinition, saveThresholds, saveValue, saveIcon, deleteIcon };
}
