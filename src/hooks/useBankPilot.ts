import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { DEFAULT_AUTO_INVEST_PATTERNS, type BankAccount, type BankTx, type ReconStatus, type MovementKind, type BankSplit, type SplitCategoria } from '@/lib/bankStatements/bankCashflowEngine';

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
    queryFn: async () => {
      const [txs, splits] = await Promise.all([
        fetchAllRows<BankTx>('bank_transactions', q => q.eq('school_id', schoolId),
          1000, 'id, account_id, import_id, data, descricao, descricao_editada, valor, tipo, transfer_pair_id, recon_status, recon_by_email, recon_at, recon_note, created_at, movement_kind'),
        fetchAllRows<BankSplit & { transaction_id: string }>('bank_transaction_splits', q => q.eq('school_id', schoolId),
          1000, 'id, transaction_id, valor, categoria, descricao, note, sort_order'),
      ]);
      const byTx = new Map<string, BankSplit[]>();
      for (const s of splits) { const l = byTx.get(s.transaction_id) ?? []; l.push(s); byTx.set(s.transaction_id, l); }
      for (const l of byTx.values()) l.sort((a, b) => a.sort_order - b.sort_order);
      return txs.map(t => ({ ...t, splits: byTx.get(t.id) }));
    },
  });
}

export interface BankImport {
  id: string; account_id: string; file_name: string; file_path: string | null; formato: string;
  periodo_inicio: string | null; periodo_fim: string | null; total_linhas: number; inseridas: number;
  duplicadas: number; total_entradas: number; total_saidas: number; created_at: string;
  saldo_final_informado?: number | null; saldo_aplicado_informado?: number | null;
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
    qc.invalidateQueries({ queryKey: ['autoInvestPatterns', schoolId] });
    qc.invalidateQueries({ queryKey: ['ownTransferNames', schoolId] });
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

/** Padrões de descrição de aplicação automática: padrão do sistema + os cadastrados na empresa. */
export function useAutoInvestPatterns(schoolId: string) {
  return useQuery({
    queryKey: ['autoInvestPatterns', schoolId],
    queryFn: async () => {
      const { data } = await db.from('bank_auto_invest_patterns').select('id, padrao').eq('school_id', schoolId).order('padrao');
      const custom = (data ?? []) as { id: string; padrao: string }[];
      return { custom, all: [...DEFAULT_AUTO_INVEST_PATTERNS, ...custom.map(c => c.padrao)] };
    },
  });
}

export function useSetMovementKind(schoolId: string) {
  const invalidate = useInvalidateBank(schoolId);
  return useMutation({
    mutationFn: async ({ ids, kind }: { ids: string[]; kind: MovementKind }) => {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await db.from('bank_transactions').update({ movement_kind: kind }).in('id', ids.slice(i, i + 200));
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

/** Só altera a descrição exibida/observação; valor, data e descrição original seguem protegidos no banco. */
export function useUpdateTxText(schoolId: string) {
  const invalidate = useInvalidateBank(schoolId);
  return useMutation({
    mutationFn: async ({ id, descricao_editada, recon_note }: { id: string; descricao_editada?: string | null; recon_note?: string | null }) => {
      const patch: Record<string, unknown> = {};
      if (descricao_editada !== undefined) patch.descricao_editada = descricao_editada?.trim() || null;
      if (recon_note !== undefined) patch.recon_note = recon_note?.trim() || null;
      const { error } = await db.from('bank_transactions').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Divide (ou desfaz, com lista vazia) um lançamento. Soma validada no banco; valor/saldo do extrato não mudam. */
export function useSetSplits(schoolId: string) {
  const invalidate = useInvalidateBank(schoolId);
  return useMutation({
    mutationFn: async ({ txId, parts }: { txId: string; parts: { valor: number; categoria: SplitCategoria; descricao?: string; note?: string }[] }) => {
      const { error } = await db.rpc('set_bank_tx_splits', { _tx_id: txId, _parts: parts });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useOwnTransferNames(schoolId: string) {
  return useQuery({
    queryKey: ['ownTransferNames', schoolId],
    queryFn: async () => {
      const { data } = await db.from('bank_own_transfer_names').select('id, padrao').eq('school_id', schoolId).order('padrao');
      return (data ?? []) as { id: string; padrao: string }[];
    },
  });
}
