/**
 * Computa o snapshot de fechamento de um mês.
 *
 * Mesma lógica usada no Dashboard, mas isolada para ser chamada no momento
 * do fechamento e gravar valores finais (congelados) no banco.
 *
 * Prioridade de fonte (igual Dashboard):
 *   upload (financial_entries com origem='fluxo') > histórico (historical_monthly) > projeção
 */
import { supabase } from '@/integrations/supabase/client';
import type { FinancialEntry, TypeClassification } from '@/types/financial';
import {
  getCanonicalKey,
  getEffectiveClassification,
  getEffectiveSinal,
  getSaldoImpact,
  filterActiveEntries,
  normalizeTipo,
} from '@/lib/classificationUtils';
import type { SnapshotPorTipo } from '@/hooks/usePeriodSnapshots';

export interface ComputedSnapshot {
  month: string;
  receitas: number;
  despesas: number;
  resultado: number;
  operacoes_in: number;
  operacoes_out: number;
  saldo_movimento: number;
  saldo_inicial: number;
  saldo_final: number;
  por_tipo: SnapshotPorTipo[];
}

interface HistoricalRow { month: string; tipo_valor: string; valor: number; }

function mapEntryRow(r: any): FinancialEntry {
  return {
    id: r.id,
    school_id: r.school_id,
    data: r.data,
    descricao: r.descricao || '',
    valor: Number(r.valor) || 0,
    tipo: r.tipo,
    tipoOriginal: r.tipo_original ?? undefined,
    categoria: r.categoria || '',
    origem: r.origem,
    tipoRegistro: r.tipo_registro || 'realizado',
    editadoManualmente: !!r.editado_manualmente,
    origem_upload_id: r.origem_upload_id ?? undefined,
  } as FinancialEntry;
}

/** Resolve label/classificação/sinal para um tipo do histórico (sem entry real). */
function resolveHistTipo(tipoValor: string, classifications: TypeClassification[]) {
  const cfg = classifications.find(c => normalizeTipo(c.tipoValor) === normalizeTipo(tipoValor));
  if (cfg) {
    const cls = cfg.classificacao as SnapshotPorTipo['classificacao'];
    const rawSinal = cfg.operacaoSinal;
    const sinal: 'somar' | 'subtrair' =
      rawSinal === 'subtrair' ? 'subtrair'
      : rawSinal === 'somar' ? 'somar'
      : cls === 'despesa' ? 'subtrair' : 'somar';
    return { classificacao: cls, sinal, label: cfg.label || tipoValor };
  }
  // Sem config: heurística mínima — receita/entrada → somar; despesa/saida → subtrair
  const n = normalizeTipo(tipoValor);
  if (n === 'receita' || n === 'entrada') return { classificacao: 'receita' as const, sinal: 'somar' as const, label: tipoValor };
  if (n === 'despesa' || n === 'saida') return { classificacao: 'despesa' as const, sinal: 'subtrair' as const, label: tipoValor };
  // Tipo desconhecido — trata como operação somando (não impacta resultado)
  return { classificacao: 'operacao' as const, sinal: 'somar' as const, label: tipoValor };
}

/**
 * Calcula o snapshot completo do mês informado.
 * Considera entries + historical_monthly + meses anteriores para saldo inicial.
 */
export async function computeMonthSnapshot(
  schoolId: string,
  month: string,
  classifications: TypeClassification[]
): Promise<ComputedSnapshot> {
  // 1) Pega saldo inicial da escola
  const { data: schoolRow } = await supabase
    .from('schools')
    .select('saldo_inicial, saldo_inicial_data')
    .eq('id', schoolId)
    .maybeSingle();
  const saldoInicialBase = Number(schoolRow?.saldo_inicial) || 0;
  const baseDate = (schoolRow?.saldo_inicial_data as string | null) || null;

  // 2) Busca todas as entries (a partir da data base, se houver)
  const fromDate = baseDate || '0000-01-01';
  const { data: entriesRaw = [] } = await supabase
    .from('financial_entries')
    .select('*')
    .eq('school_id', schoolId)
    .gte('data', fromDate);

  const allEntries = (entriesRaw as any[]).map(mapEntryRow);
  const activeEntries = filterActiveEntries(allEntries, classifications);

  // 3) Busca histórico
  const { data: histRaw = [] } = await supabase
    .from('historical_monthly' as any)
    .select('month, tipo_valor, valor')
    .eq('school_id', schoolId);
  const historicalRows = (histRaw as any[]) as HistoricalRow[];

  // 4) Resolve fonte do mês
  const monthEntries = activeEntries.filter(e => e.data.startsWith(month));
  const monthHist = historicalRows.filter(r => r.month === month);
  const hasUpload = monthEntries.some(e => e.origem === 'fluxo');
  const hasHist = monthHist.length > 0;
  const source: 'upload' | 'historico' | 'projecao' | 'vazio' =
    hasUpload ? 'upload' : hasHist ? 'historico' : monthEntries.length > 0 ? 'projecao' : 'vazio';

  // 5) Agrega por tipo canônico
  type Agg = { tipo: string; label: string; classificacao: SnapshotPorTipo['classificacao']; sinal: 'somar' | 'subtrair'; valor: number };
  const aggMap: Record<string, Agg> = {};

  if (source === 'historico') {
    for (const r of monthHist) {
      const meta = resolveHistTipo(r.tipo_valor, classifications);
      const key = getCanonicalKey(r.tipo_valor);
      if (!aggMap[key]) aggMap[key] = { tipo: key, label: meta.label, classificacao: meta.classificacao, sinal: meta.sinal, valor: 0 };
      aggMap[key].valor += Number(r.valor) || 0;
    }
  } else if (source === 'upload' || source === 'projecao') {
    for (const e of monthEntries) {
      if (source === 'upload' && e.origem !== 'fluxo') continue;
      const tipoRaw = e.tipoOriginal || e.tipo;
      const cls = getEffectiveClassification(e, classifications);
      if (cls === 'ignorar') continue;
      const sinal = getEffectiveSinal(e, classifications);
      const key = getCanonicalKey(tipoRaw);
      if (!aggMap[key]) aggMap[key] = { tipo: key, label: tipoRaw, classificacao: cls, sinal, valor: 0 };
      aggMap[key].valor += e.valor;
    }
  }

  let receitas = 0, despesas = 0, opIn = 0, opOut = 0;
  let saldoMovimento = 0;
  for (const a of Object.values(aggMap)) {
    const impacto = a.sinal === 'somar' ? a.valor : -a.valor;
    saldoMovimento += impacto;
    if (a.classificacao === 'receita') receitas += a.valor;
    else if (a.classificacao === 'despesa') despesas += a.valor;
    else if (a.classificacao === 'operacao') {
      if (impacto >= 0) opIn += impacto;
      else opOut += Math.abs(impacto);
    }
  }

  // 6) Saldo inicial: acumula tudo antes do mês
  let saldoInicial = saldoInicialBase;
  const monthStart = `${month}-01`;
  const histMonthsSet = new Set(historicalRows.map(r => r.month));
  // Lançamentos anteriores (respeita prioridade upload > histórico)
  for (const e of activeEntries) {
    if (e.data >= monthStart) continue;
    const m = e.data.slice(0, 7);
    const monthHasUpload = activeEntries.some(x => x.data.startsWith(m) && x.origem === 'fluxo');
    if (!monthHasUpload && histMonthsSet.has(m)) continue;
    if (monthHasUpload && e.origem !== 'fluxo') continue;
    saldoInicial += getSaldoImpact(e, classifications);
  }
  // Histórico anterior (apenas meses sem upload)
  for (const r of historicalRows) {
    if (r.month >= month) continue;
    const monthHasUpload = activeEntries.some(x => x.data.startsWith(r.month) && x.origem === 'fluxo');
    if (monthHasUpload) continue;
    const meta = resolveHistTipo(r.tipo_valor, classifications);
    const v = Number(r.valor) || 0;
    saldoInicial += meta.sinal === 'somar' ? v : -v;
  }

  return {
    month,
    receitas,
    despesas,
    resultado: receitas - despesas,
    operacoes_in: opIn,
    operacoes_out: opOut,
    saldo_movimento: saldoMovimento,
    saldo_inicial: saldoInicial,
    saldo_final: saldoInicial + saldoMovimento,
    por_tipo: Object.values(aggMap).map(a => ({
      tipo: a.tipo,
      label: a.label,
      classificacao: a.classificacao,
      sinal: a.sinal,
      valor: a.valor,
    })),
  };
}
