import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioRow {
  school_id: string;
  school_name: string;
  responsible_user_id: string | null;
  responsible_email: string | null;
  closing_due_day: number;
  data_updated_through: string | null;
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