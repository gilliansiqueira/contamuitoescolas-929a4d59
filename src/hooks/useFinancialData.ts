import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FinancialEntry, School, TypeClassification, PaymentDelayRule, ExclusionRule, UploadRecord, AuditLogEntry } from '@/types/financial';

// ─── Schools ────────────────────────────────────────
export function useSchools() {
  return useQuery({
    queryKey: ['schools'],
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await supabase.from('schools').select('*').order('created_at');
      if (error) throw error;
      return (data ?? []).map(s => ({
        id: s.id,
        nome: s.nome,
        createdAt: s.created_at,
        saldoInicial: Number(s.saldo_inicial) || 0,
        saldoInicialData: s.saldo_inicial_data ?? undefined,
      }));
    },
  });
}

export function useSchool(schoolId: string) {
  return useQuery({
    queryKey: ['schools', schoolId],
    queryFn: async (): Promise<School | null> => {
      const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        nome: data.nome,
        createdAt: data.created_at,
        saldoInicial: Number(data.saldo_inicial) || 0,
        saldoInicialData: data.saldo_inicial_data ?? undefined,
      };
    },
    enabled: !!schoolId,
  });
}

export function useAddSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (school: { nome: string }) => {
      const { data, error } = await supabase.from('schools').insert({ nome: school.nome }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schools'] }),
  });
}

export function useDeleteSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schools').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schools'] }),
  });
}

export function useUpdateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; saldo_inicial?: number; saldo_inicial_data?: string | null }) => {
      const { error } = await supabase.from('schools').update({
        saldo_inicial: params.saldo_inicial,
        saldo_inicial_data: params.saldo_inicial_data,
      }).eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      qc.invalidateQueries({ queryKey: ['schools', params.id] });
    },
  });
}

// ─── Financial Entries ──────────────────────────────
function mapEntry(e: any): FinancialEntry {
  return {
    id: e.id,
    data: e.data,
    descricao: e.descricao,
    valor: Number(e.valor),
    tipo: e.tipo as 'entrada' | 'saida',
    categoria: e.categoria,
    origem: e.origem as FinancialEntry['origem'],
    school_id: e.school_id,
    origem_upload_id: e.origem_upload_id ?? undefined,
    tipoOriginal: e.tipo_original ?? undefined,
    tipoRegistro: (e.tipo_registro as 'realizado' | 'projetado') || 'realizado',
    editadoManualmente: e.editado_manualmente ?? false,
  };
}

export function useEntries(schoolId: string) {
  return useQuery({
    queryKey: ['entries', schoolId],
    queryFn: async (): Promise<FinancialEntry[]> => {
      const { data, error } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('school_id', schoolId)
        .order('data');
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
    enabled: !!schoolId,
  });
}

export function useEntriesFromBaseDate(schoolId: string, baseDate?: string) {
  return useQuery({
    queryKey: ['entries', schoolId, 'fromBase', baseDate],
    queryFn: async (): Promise<FinancialEntry[]> => {
      // If baseDate is set, filter strictly from it. Empty result = empty result
      // (no silent fallback to all-time data — avoids mixing periods).
      if (baseDate) {
        const { data, error } = await supabase
          .from('financial_entries')
          .select('*')
          .eq('school_id', schoolId)
          .gte('data', baseDate)
          .order('data');
        if (error) throw error;
        return (data ?? []).map(mapEntry);
      }
      // No baseDate configured — load all entries
      const { data, error } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('school_id', schoolId)
        .order('data');
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
    enabled: !!schoolId,
  });
}

export function useAddEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: FinancialEntry[]) => {
      const rows = entries.map(e => ({
        id: e.id,
        school_id: e.school_id,
        data: e.data,
        descricao: e.descricao,
        valor: e.valor,
        tipo: e.tipo,
        categoria: e.categoria,
        origem: e.origem,
        origem_upload_id: e.origem_upload_id || null,
        tipo_original: e.tipoOriginal || null,
        tipo_registro: e.tipoRegistro || 'realizado',
        editado_manualmente: e.editadoManualmente || false,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase.from('financial_entries').insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<FinancialEntry> }) => {
      const dbUpdates: any = {};
      if (params.updates.data !== undefined) dbUpdates.data = params.updates.data;
      if (params.updates.descricao !== undefined) dbUpdates.descricao = params.updates.descricao;
      if (params.updates.valor !== undefined) dbUpdates.valor = params.updates.valor;
      if (params.updates.tipo !== undefined) dbUpdates.tipo = params.updates.tipo;
      if (params.updates.categoria !== undefined) dbUpdates.categoria = params.updates.categoria;
      if (params.updates.editadoManualmente !== undefined) dbUpdates.editado_manualmente = params.updates.editadoManualmente;
      if (params.updates.tipoRegistro !== undefined) dbUpdates.tipo_registro = params.updates.tipoRegistro;
      const { error } = await supabase.from('financial_entries').update(dbUpdates).eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  });
}

// ─── Uploads ────────────────────────────────────────
export function useUploads(schoolId: string) {
  return useQuery({
    queryKey: ['uploads', schoolId],
    queryFn: async (): Promise<UploadRecord[]> => {
      const { data, error } = await supabase
        .from('upload_records')
        .select('*')
        .eq('school_id', schoolId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(u => ({
        id: u.id,
        school_id: u.school_id,
        fileName: u.file_name,
        tipo: u.tipo,
        uploadedAt: u.uploaded_at,
        recordCount: u.record_count,
      }));
    },
    enabled: !!schoolId,
  });
}

export function useAddUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (upload: UploadRecord) => {
      const { error } = await supabase.from('upload_records').insert({
        id: upload.id,
        school_id: upload.school_id,
        file_name: upload.fileName,
        tipo: upload.tipo,
        uploaded_at: upload.uploadedAt,
        record_count: upload.recordCount,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uploads'] }),
  });
}

export function useDeleteUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uploadId: string) => {
      const { error: e1 } = await supabase.from('financial_entries').delete().eq('origem_upload_id', uploadId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('upload_records').delete().eq('id', uploadId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uploads'] });
      qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

// ─── Type Classifications ───────────────────────────
export function useTypeClassifications(schoolId: string) {
  return useQuery({
    queryKey: ['typeClassifications', schoolId],
    queryFn: async (): Promise<TypeClassification[]> => {
      const { data, error } = await supabase
        .from('type_classifications')
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.id,
        school_id: t.school_id,
        tipoValor: t.tipo_valor,
        entraNoResultado: t.entra_no_resultado,
        impactaCaixa: t.impacta_caixa,
        classificacao: t.classificacao as TypeClassification['classificacao'],
        operacaoSinal: (t.operacao_sinal as TypeClassification['operacaoSinal']) || 'auto',
        label: t.label,
      }));
    },
    enabled: !!schoolId,
  });
}

export function useSaveTypeClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tc: TypeClassification) => {
      const { error } = await supabase.from('type_classifications').upsert({
        id: tc.id,
        school_id: tc.school_id,
        tipo_valor: tc.tipoValor,
        entra_no_resultado: tc.entraNoResultado,
        impacta_caixa: tc.impactaCaixa,
        classificacao: tc.classificacao,
        operacao_sinal: tc.operacaoSinal || 'auto',
        label: tc.label,
      } as any, { onConflict: 'school_id,tipo_valor' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['typeClassifications'] }),
  });
}

// ─── Payment Delay Rules ────────────────────────────
export function usePaymentDelayRules(schoolId: string) {
  return useQuery({
    queryKey: ['paymentDelayRules', schoolId],
    queryFn: async (): Promise<PaymentDelayRule[]> => {
      const { data, error } = await supabase
        .from('payment_delay_rules')
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []).map(r => ({
        id: r.id,
        school_id: r.school_id,
        formaCobranca: r.forma_cobranca,
        prazo: r.prazo,
      }));
    },
    enabled: !!schoolId,
  });
}

export function useSavePaymentDelayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: PaymentDelayRule) => {
      const { error } = await supabase.from('payment_delay_rules').upsert({
        id: rule.id,
        school_id: rule.school_id,
        forma_cobranca: rule.formaCobranca,
        prazo: rule.prazo,
      }, { onConflict: 'school_id,forma_cobranca' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentDelayRules'] }),
  });
}

// ─── Exclusion Rules ────────────────────────────────
export function useExclusionRules(schoolId: string) {
  return useQuery({
    queryKey: ['exclusionRules', schoolId],
    queryFn: async (): Promise<ExclusionRule[]> => {
      const { data, error } = await supabase
        .from('exclusion_rules')
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []).map(r => ({
        id: r.id,
        school_id: r.school_id,
        tipo: r.tipo as 'receita' | 'despesa',
        campo: r.campo as 'descricao' | 'categoria',
        operador: r.operador as 'contem' | 'igual',
        valor: r.valor,
        acao: r.acao as 'ignorar' | 'recategorizar',
        novaCategoria: r.nova_categoria ?? undefined,
      }));
    },
    enabled: !!schoolId,
  });
}

export function useAddExclusionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: ExclusionRule) => {
      const { error } = await supabase.from('exclusion_rules').insert({
        id: rule.id,
        school_id: rule.school_id,
        tipo: rule.tipo,
        campo: rule.campo,
        operador: rule.operador,
        valor: rule.valor,
        acao: rule.acao,
        nova_categoria: rule.novaCategoria || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exclusionRules'] }),
  });
}

export function useDeleteExclusionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exclusion_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exclusionRules'] }),
  });
}

// ─── Audit Log ──────────────────────────────────────
export function useAuditLog(schoolId: string) {
  return useQuery({
    queryKey: ['auditLog', schoolId],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(a => ({
        id: a.id,
        school_id: a.school_id,
        timestamp: a.created_at,
        action: a.action as AuditLogEntry['action'],
        description: a.description,
      }));
    },
    enabled: !!schoolId,
  });
}

export function useAddAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { school_id: string; action: string; description: string }) => {
      const { error } = await supabase.from('audit_log').insert({
        school_id: entry.school_id,
        action: entry.action,
        description: entry.description,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auditLog'] }),
  });
}

// ─── Fluxo Tipos (derived from entries + histórico financeiro) ──────
export function useFluxoTipos(schoolId: string) {
  return useQuery({
    queryKey: ['fluxoTipos', schoolId],
    queryFn: async (): Promise<string[]> => {
      const [entriesRes, histRes] = await Promise.all([
        supabase
          .from('financial_entries')
          .select('tipo, tipo_original')
          .eq('school_id', schoolId)
          .eq('origem', 'fluxo'),
        supabase
          .from('historical_monthly' as any)
          .select('tipo_valor')
          .eq('school_id', schoolId),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (histRes.error) throw histRes.error;
      const set = new Set<string>();
      (entriesRes.data ?? []).forEach(e => {
        if (e.tipo_original) set.add(e.tipo_original.toLowerCase().trim());
        set.add(e.tipo.toLowerCase().trim());
      });
      (histRes.data ?? []).forEach((r: any) => {
        if (r.tipo_valor) set.add(String(r.tipo_valor).toLowerCase().trim());
      });
      return Array.from(set).sort();
    },
    enabled: !!schoolId,
  });
}

// ─── Available months (derived from entries + histórico financeiro) ────────
export function useAvailableMonths(schoolId: string) {
  return useQuery({
    queryKey: ['availableMonths', schoolId],
    queryFn: async (): Promise<string[]> => {
      const [entriesRes, histRes] = await Promise.all([
        supabase.from('financial_entries').select('data').eq('school_id', schoolId),
        supabase.from('historical_monthly' as any).select('month').eq('school_id', schoolId),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (histRes.error) throw histRes.error;
      const set = new Set<string>();
      (entriesRes.data ?? []).forEach((e: any) => set.add(e.data.slice(0, 7)));
      (histRes.data ?? []).forEach((r: any) => { if (r.month) set.add(r.month); });
      return Array.from(set).sort();
    },
    enabled: !!schoolId,
  });
}
