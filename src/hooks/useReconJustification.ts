import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/** Pendências com data a partir daqui precisam de motivo (a mesma data está na função close_recon_day do servidor). */
export const JUSTIFICATION_START = '2026-10-01';

export interface JustificationReason { id: string; nome: string; ativo: boolean; sort_order: number }

export const needsJustification = (t: { data: string; recon_status: string; is_forecast?: boolean; justification_reason_id?: string | null }) =>
  t.recon_status === 'pendente' && !t.is_forecast && t.data >= JUSTIFICATION_START && !t.justification_reason_id;

export function useJustificationReasons() {
  return useQuery({
    queryKey: ['reconJustificationReasons'],
    queryFn: async () => {
      const { data, error } = await db.from('recon_justification_reasons').select('*').order('sort_order').order('nome');
      if (error) throw error;
      return (data ?? []) as JustificationReason[];
    },
  });
}

export function useManageReasons() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['reconJustificationReasons'] });
  return {
    add: useMutation({
      mutationFn: async (nome: string) => {
        const { data: last } = await db.from('recon_justification_reasons').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const { error } = await db.from('recon_justification_reasons').insert({ nome, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
        if (error) throw new Error(String(error.message).includes('duplicate') ? 'Esse motivo já existe' : error.message);
      }, onSuccess: done,
    }),
    toggle: useMutation({
      mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
        const { error } = await db.from('recon_justification_reasons').update({ ativo }).eq('id', id);
        if (error) throw error;
      }, onSuccess: done,
    }),
    /** Apaga se nunca foi usado; se já foi usado, só desativa (preserva o histórico). */
    remove: useMutation({
      mutationFn: async (id: string): Promise<'apagado' | 'desativado'> => {
        const { count } = await db.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('justification_reason_id', id);
        if ((count ?? 0) > 0) {
          const { error } = await db.from('recon_justification_reasons').update({ ativo: false }).eq('id', id);
          if (error) throw error;
          return 'desativado';
        }
        const { error } = await db.from('recon_justification_reasons').delete().eq('id', id);
        if (error) throw error;
        return 'apagado';
      }, onSuccess: done,
    }),
  };
}

export function useSetJustification(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, reasonId, note }: { ids: string[]; reasonId: string | null; note: string | null }) => {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await db.from('bank_transactions')
          .update({ justification_reason_id: reasonId, justification_note: note?.trim() ? note.trim().slice(0, 200) : null })
          .in('id', ids.slice(i, i + 200)).eq('school_id', schoolId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bankTxs', schoolId] }),
  });
}

export interface MissingJustification { transaction_id: string; account_name: string | null; data: string; descricao: string; valor: number; tipo: string }

export function useCloseReconDay(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (day: string): Promise<MissingJustification[]> => {
      const { data, error } = await db.rpc('close_recon_day', { _school_id: schoolId, _day: day });
      if (error) throw error;
      const rows = (data ?? []) as (MissingJustification & { ok: boolean })[];
      return rows.filter(r => !r.ok);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconDayClosures', schoolId] }),
  });
}

export function useReconDayClosures(schoolId: string) {
  return useQuery({
    queryKey: ['reconDayClosures', schoolId],
    queryFn: async () => {
      const { data, error } = await db.from('bank_recon_day_closures').select('dia, closed_by_email, closed_at').eq('school_id', schoolId).order('dia', { ascending: false }).limit(60);
      if (error) throw error;
      return (data ?? []) as { dia: string; closed_by_email: string | null; closed_at: string }[];
    },
  });
}
