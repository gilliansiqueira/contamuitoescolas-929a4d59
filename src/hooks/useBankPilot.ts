import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { autoTransferPairs, DEFAULT_AUTO_INVEST_PATTERNS, type BankAccount, type BankTx, type ReconStatus, type MovementKind, type BankSplit, type SplitCategoria } from '@/lib/bankStatements/bankCashflowEngine';

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
          1000, 'id, account_id, import_id, data, descricao, descricao_editada, valor, tipo, transfer_pair_id, recon_status, recon_by_email, recon_at, recon_note, created_at, movement_kind, model_item_id'),
        fetchAllRows<BankSplit & { transaction_id: string }>('bank_transaction_splits', q => q.eq('school_id', schoolId),
          1000, 'id, transaction_id, valor, categoria, descricao, note, sort_order, model_item_id'),
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
    qc.invalidateQueries({ queryKey: ['bankCashflow', schoolId] });
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

/** Busca linhas sem par da escola e pareia automaticamente as transferências marcadas com a outra ponta. */
export async function autoPairTransfers(schoolId: string): Promise<number> {
  // Limpa pares órfãos: quando a outra ponta foi apagada (reimportação do extrato),
  // o grupo fica com uma única linha e impede o pareamento com a ponta nova.
  const paired = await fetchAllRows<any>('bank_transactions', q => q.eq('school_id', schoolId).not('transfer_pair_id', 'is', null),
    1000, 'id, transfer_pair_id');
  const groupSize = new Map<string, number>();
  for (const r of paired) groupSize.set(r.transfer_pair_id, (groupSize.get(r.transfer_pair_id) ?? 0) + 1);
  const dangling = paired.filter(r => (groupSize.get(r.transfer_pair_id) ?? 0) < 2).map(r => r.id as string);
  for (let i = 0; i < dangling.length; i += 200) {
    const { error } = await db.from('bank_transactions').update({ transfer_pair_id: null }).in('id', dangling.slice(i, i + 200));
    if (error) throw error;
  }
  const rows = await fetchAllRows<any>('bank_transactions', q => q.eq('school_id', schoolId).is('transfer_pair_id', null),
    1000, 'id, account_id, data, valor, tipo, transfer_pair_id, movement_kind');
  const pairs = autoTransferPairs(rows);
  for (const [a, b] of pairs) {
    const pid = crypto.randomUUID();
    const { error } = await db.from('bank_transactions').update({ movement_kind: 'transferencia', transfer_pair_id: pid }).in('id', [a.id, b.id]);
    if (error) throw error;
  }
  return pairs.length;
}

// ─── Integração Fluxo de Caixa → Dashboard / Fluxo Diário ───
export interface ModelItem { id: string; name: string; tipo: string; impacta_caixa: boolean; entra_no_resultado: boolean }
export function useSchoolModelItems(schoolId: string) {
  return useQuery({
    queryKey: ['schoolModelItems', schoolId],
    queryFn: async (): Promise<ModelItem[]> => {
      const { data: school } = await db.from('schools').select('financial_model_template_id').eq('id', schoolId).maybeSingle();
      if (!school?.financial_model_template_id) return [];
      const { data, error } = await db.from('financial_model_template_items')
        .select('id, name, tipo, impacta_caixa, entra_no_resultado, sort_order').eq('template_id', school.financial_model_template_id).order('sort_order');
      if (error) throw error;
      return (data ?? []).map((i: any) => ({ ...i, name: String(i.name).trim() }));
    },
    enabled: !!schoolId,
  });
}

export function useSetModelItem(schoolId: string) {
  const inv = useInvalidateBank(schoolId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, itemId }: { ids: string[]; itemId: string | null }) => {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await db.from('bank_transactions').update({ model_item_id: itemId }).in('id', ids.slice(i, i + 200));
        if (error) throw error;
      }
    },
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ['bankCashflow', schoolId] }); },
  });
}

export function useSetSplitModelItem(schoolId: string) {
  const inv = useInvalidateBank(schoolId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ splitId, itemId }: { splitId: string; itemId: string | null }) => {
      const { error } = await db.rpc('set_bank_split_model_item', { _split_id: splitId, _item_id: itemId });
      if (error) throw error;
    },
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ['bankCashflow', schoolId] }); },
  });
}

export interface DataSourceConfig {
  school_id: string; status: 'rascunho' | 'em_conferencia' | 'ativo' | 'pausado';
  dashboard_source: string; daily_flow_source: string; start_month: string;
  opening_balance?: number | null;
  synced_through: string | null; last_synced_at: string | null; last_error: string | null;
}
export function useDataSource(schoolId: string) {
  return useQuery({
    queryKey: ['bankCashflow', schoolId, 'source'],
    queryFn: async (): Promise<DataSourceConfig | null> => {
      const { data, error } = await db.from('school_data_sources').select('*').eq('school_id', schoolId).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!schoolId,
  });
}

/** Aprovar/ativar ou pausar a fonte automática. Reversível: nenhuma linha é alterada. */
export function useSetDataSourceStatus(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: 'ativo' | 'pausado' | 'em_conferencia' | { status: 'ativo'; openingBalance: number }) => {
      const status = typeof arg === 'string' ? arg : arg.status;
      const patch: Record<string, unknown> = { status };
      if (typeof arg !== 'string') patch.opening_balance = Math.round(arg.openingBalance * 100) / 100;
      const { error } = await db.from('school_data_sources').update(patch).eq('school_id', schoolId);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await db.from('audit_log').insert({
        school_id: schoolId, action: 'fonte_fluxo_caixa',
        description: `Fonte do Dashboard/Fluxo Diário: ${status === 'ativo' ? 'ativada (Fluxo de Caixa)' : status === 'pausado' ? 'pausada (volta para a planilha)' : 'em conferência'} por ${u.user?.email ?? 'desconhecido'}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bankCashflow', schoolId] });
      qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export interface CashflowEntry {
  id: string; bank_transaction_id: string; bank_split_id: string | null; account_id: string; data: string;
  descricao: string; valor: number; tipo: 'entrada' | 'saida'; model_item_id: string | null; tipo_nome: string; recon_status: string;
}
export function useCashflowEntries(schoolId: string, enabled = true) {
  return useQuery({
    queryKey: ['bankCashflow', schoolId, 'entries'],
    queryFn: () => fetchAllRows<CashflowEntry>('bank_cashflow_entries', q => q.eq('school_id', schoolId).order('data'),
      1000, 'id, bank_transaction_id, bank_split_id, account_id, data, descricao, valor, tipo, model_item_id, tipo_nome, recon_status'),
    enabled: !!schoolId && enabled,
  });
}

export function useResyncCashflow(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc('sync_bank_cashflow_school', { _school_id: schoolId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bankCashflow', schoolId] }),
  });
}

export function useSheetFluxoEntries(schoolId: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['bankCashflow', schoolId, 'sheet', from, to],
    queryFn: () => fetchAllRows<{ id: string; data: string; descricao: string; valor: number; tipo: string; tipo_original: string | null; source_kind: string }>(
      'financial_entries', q => q.eq('school_id', schoolId).eq('origem', 'fluxo').gte('data', from).lte('data', to).order('data'),
      1000, 'id, data, descricao, valor, tipo, tipo_original, source_kind'),
    enabled: !!schoolId && enabled,
  });
}
