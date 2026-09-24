import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import type { BankAccount, BankTx, ReconStatus } from '@/lib/bankStatements/bankCashflowEngine';

export const BANK_PILOT_FEATURE = 'cashflow_bank_pilot';
const db = supabase as any;

export function useSchoolFeature(schoolId: string | undefined, key: string, enabled = true) {
  return useQuery({
    queryKey: ['schoolFeature', schoolId, key],
    enabled: !!schoolId && enabled,
    queryFn: async () => {
      const { data, error } = await db.from('school_features').select('enabled').eq('school_id', schoolId).eq('feature_key', key).maybeSingle();
      if (error) return false;
      return !!data?.enabled;
    },
  });
}

export function useBankAccounts(schoolId: string) {
  return useQuery({
    queryKey: ['bankAccounts', schoolId],
    queryFn: async () => {
      const { data, error } = await db.from('bank_accounts').select('*').eq('school_id', schoolId).order('sort_order').order('created_at');
      if (error) throw error;
      return (data ?? []) as BankAccount[];
    },
  });
}

export function useBankTransactions(schoolId: string) {
  return useQuery({
    queryKey: ['bankTransactions', schoolId],
    queryFn: async () =>
      fetchAllRows<BankTx>('bank_transactions', q => q.eq('school_id', schoolId),
        1000, 'id, account_id, import_id, data, descricao, valor, tipo, transfer_pair_id, recon_status, recon_by_email, recon_at, recon_note, created_at'),
  });
}

export interface BankImport {
  id: string; account_id: string; file_name: string; file_path: string | null; formato: string;
  periodo_inicio: string | null; periodo_fim: string | null; total_linhas: number; inseridas: number;
  duplicadas: number; total_entradas: number; total_saidas: number; created_at: string;
}

export function useBankImports(schoolId: string) {
  return useQuery({
    queryKey: ['bankImports', schoolId],
    queryFn: async () => {
      const { data, error } = await db.from('bank_statement_imports').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BankImport[];
    },
  });
}

export function useInvalidateBank(schoolId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['bankTransactions', schoolId] });
    qc.invalidateQueries({ queryKey: ['bankImports', schoolId] });
    qc.invalidateQueries({ queryKey: ['bankAccounts', schoolId] });
  };
}

/** Altera APENAS a situação de conciliação/observação. O histórico é gravado no banco. */
export function useSetReconStatus(schoolId: string) {
  const invalidate = useInvalidateBank(schoolId);
  return useMutation({
    mutationFn: async ({ ids, status, note }: { ids: string[]; status: ReconStatus; note?: string | null }) => {
      for (let i = 0; i < ids.length; i += 200) {
        const patch: Record<string, unknown> = { recon_status: status };
        if (note !== undefined) patch.recon_note = note;
        const { error } = await db.from('bank_transactions').update(patch).in('id', ids.slice(i, i + 200));
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useSetTransferPair(schoolId: string) {
  const invalidate = useInvalidateBank(schoolId);
  return useMutation({
    mutationFn: async ({ ids, pairId }: { ids: string[]; pairId: string | null }) => {
      const { error } = await db.from('bank_transactions').update({ transfer_pair_id: pairId }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export async function fetchReconHistory(txId: string) {
  const { data, error } = await db.from('bank_reconciliation_history').select('*').eq('transaction_id', txId).order('changed_at', { ascending: false });
  if (error) throw error;
  return data as { id: string; old_status: string | null; new_status: string; note: string | null; changed_by_email: string | null; changed_at: string }[];
}
