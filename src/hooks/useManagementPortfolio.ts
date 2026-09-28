import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioRow {
  school_id: string;
  school_name: string;
  responsible_user_id: string | null;
  responsible_email: string | null;
  closing_due_day: number;
  data_updated_through: string | null;
  last_activity_at: string | null;
  reconciliation_percent: number | null;
  reconciliation_pending: number;
  closing_percent: number | null;
  checklist_pending: number;
  report_delivered: boolean;
  period_closed: boolean;
  waiting_for_client: boolean;
  review_complete: boolean;
  next_action: string | null;
}

export interface ResponsibleCandidate {
  school_id: string;
  user_id: string;
  email: string;
}

export interface ResponsibleDisplayName {
  user_id: string;
  display_name: string;
}

export function useManagementPortfolio(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['management-portfolio', month],
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_management_portfolio', { _month: month });
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        closing_due_day: Number(row.closing_due_day),
        reconciliation_percent: row.reconciliation_percent == null ? null : Number(row.reconciliation_percent),
        reconciliation_pending: Number(row.reconciliation_pending),
        closing_percent: row.closing_percent == null ? null : Number(row.closing_percent),
        checklist_pending: Number(row.checklist_pending),
      })) as PortfolioRow[];
    },
  });
}

export function useManagementResponsibleCandidates(enabled: boolean) {
  return useQuery({
    queryKey: ['management-responsible-candidates'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_management_responsible_candidates');
      if (error) throw error;
      return (data ?? []) as ResponsibleCandidate[];
    },
  });
}

export function useSetManagementResponsible(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ schoolId, userId }: { schoolId: string; userId: string | null }) => {
      const { error } = await supabase.rpc('set_management_responsible', {
        _school_id: schoolId,
        _user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['management-portfolio', month] }),
  });
}

export function useManagementResponsibleDisplayNames(enabled: boolean) {
  return useQuery({
    queryKey: ['management-responsible-display-names'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_management_responsible_display_names');
      if (error) throw error;
      return (data ?? []) as ResponsibleDisplayName[];
    },
  });
}

export function useSetManagementResponsibleDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, displayName }: { userId: string; displayName: string }) => {
      const { error } = await supabase.rpc('set_management_responsible_display_name', {
        _user_id: userId,
        _display_name: displayName,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['management-responsible-display-names'] }),
  });
}
// ─── Controle diário da conciliação (somente leitura) ───
export interface DailyStatusRow {
  school_id: string; ref_day: string; recon_required: number; reconciled: number; recon_pending: number;
  statement_received: boolean; reconciled_today: number; imports_today: number; last_activity: string | null;
}
export interface BacklogRow {
  transaction_id: string; school_id: string; data: string; descricao: string; valor: number; tipo: string; account_name: string | null; reason_name?: string | null; justification_note?: string | null;
}

/** Data de hoje no fuso de São Paulo (yyyy-mm-dd). */
export function todaySaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function useManagementDailyStatus(day: string, enabled = true) {
  return useQuery({
    queryKey: ['management-daily-status', day],
    enabled,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_management_daily_status', { _day: day });
      if (error) throw error;
      return ((data ?? []) as any[]).map(r => ({
        ...r, recon_required: Number(r.recon_required), reconciled: Number(r.reconciled), recon_pending: Number(r.recon_pending),
        reconciled_today: Number(r.reconciled_today), imports_today: Number(r.imports_today),
      })) as DailyStatusRow[];
    },
  });
}

export function useManagementBacklog(day: string, enabled = true) {
  return useQuery({
    queryKey: ['management-backlog', day],
    enabled,
    refetchInterval: 120_000,
    queryFn: async () => {
      const all: BacklogRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).rpc('get_management_reconciliation_backlog', { _day: day }).range(from, from + 999);
        if (error) throw error;
        const rows = (data ?? []) as any[];
        all.push(...rows.map(r => ({ ...r, valor: Number(r.valor) })));
        if (rows.length < 1000) break;
      }
      return all;
    },
  });
}
