import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import type { RenewalColumn, RenewalRow, RenewalSettings, TemplateStructure } from '@/lib/renewal/types';

const db = supabase as any;

export interface RenewalSheet {
  id: string; school_id: string; period: string; template_id: string | null; status: string;
  responsible_user_id: string | null; columns: RenewalColumn[]; params: Record<string, any>;
  current_version: number; sent_version: number | null; dirty: boolean; updated_at: string; created_at: string;
}
export interface RenewalTemplate { id: string; school_id: string; version: number; name: string; approved: boolean; structure: TemplateStructure; source_file: string | null; created_at: string }

export function useRenewalSources() {
  return useQuery({ queryKey: ['renewal_sources'], queryFn: async () => {
    const { data, error } = await db.from('renewal_sources').select('*').order('created_at');
    if (error) throw error; return data as any[];
  } });
}

export function useRenewalSettings(schoolId: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['renewal_settings', schoolId], queryFn: async () => {
    const { data, error } = await db.from('renewal_settings').select('*').eq('school_id', schoolId).maybeSingle();
    if (error) throw error;
    return (data ?? { include_material: false, module_categories: ['Parcela Regular', 'Parcela Especial'], separate_modalities: ['Personal', 'VIP', 'Semi', 'ON'] }) as RenewalSettings;
  } });
  const save = useMutation({ mutationFn: async (s: RenewalSettings) => {
    const { error } = await db.from('renewal_settings').upsert({ school_id: schoolId, ...s, updated_at: new Date().toISOString() });
    if (error) throw error;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['renewal_settings', schoolId] }) });
  return { ...q, save };
}

export function useRenewalTemplates(schoolId: string) {
  return useQuery({ queryKey: ['renewal_templates', schoolId], queryFn: async () => {
    const { data, error } = await db.from('renewal_templates').select('*').eq('school_id', schoolId).order('version', { ascending: false });
    if (error) throw error; return data as RenewalTemplate[];
  } });
}

export function useAllRenewalSheets() {
  return useQuery({ queryKey: ['renewal_sheets_all'], queryFn: async () => {
    const { data, error } = await db.from('renewal_sheets').select('*, schools(nome)').order('updated_at', { ascending: false });
    if (error) throw error; return data as (RenewalSheet & { schools: { nome: string } })[];
  } });
}

export function useRenewalSheets(schoolId: string) {
  return useQuery({ queryKey: ['renewal_sheets', schoolId], queryFn: async () => {
    const { data, error } = await db.from('renewal_sheets').select('*').eq('school_id', schoolId).order('period', { ascending: false });
    if (error) throw error; return data as RenewalSheet[];
  } });
}

export function useRenewalRows(sheetId: string | undefined) {
  return useQuery({ queryKey: ['renewal_rows', sheetId], enabled: !!sheetId, queryFn: ({ signal }) =>
    fetchAllRows<RenewalRow & { id: string }>('renewal_rows' as any, q => q.eq('sheet_id', sheetId).order('sort_order'), 1000, '*', signal) });
}

export function useSheetChildren<T = any>(table: string, sheetId: string | undefined, order = 'created_at') {
  return useQuery({ queryKey: [table, sheetId], enabled: !!sheetId, queryFn: async () => {
    const { data, error } = await db.from(table).select('*').eq('sheet_id', sheetId).order(order, { ascending: false });
    if (error) throw error; return data as T[];
  } });
}

export function useInvalidateRenewal() {
  const qc = useQueryClient();
  return (schoolId: string, sheetId?: string) => {
    qc.invalidateQueries({ queryKey: ['renewal_sheets', schoolId] });
    qc.invalidateQueries({ queryKey: ['renewal_sheets_all'] });
    qc.invalidateQueries({ queryKey: ['renewal_templates', schoolId] });
    if (sheetId) for (const t of ['renewal_rows', 'renewal_issues', 'renewal_imports', 'renewal_versions', 'renewal_deliveries', 'renewal_change_requests']) qc.invalidateQueries({ queryKey: [t, sheetId] });
  };
}

export const renewalDb = db;
