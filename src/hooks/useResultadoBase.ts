import { useQuery } from '@tanstack/react-query';
import { applyEntityFilterShared, scaleSharedRows } from '@/contexts/GlobalPeriodContext';
import { useEffect, useMemo, useState } from 'react';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { useHistoricalRows } from '@/hooks/useHistoricalRows';
import { useRealizedEntries } from '@/hooks/useRealizedEntries';
import { useEntityFilter } from '@/contexts/GlobalPeriodContext';
import { calculateTotals } from '@/lib/classificationUtils';
import { resolveLedgerRule } from '@/lib/ledgerEngine';
import { excluiSocios } from '@/lib/gestaoIndicadores';

export type ResultBasis = 'competencia' | 'caixa';
export interface MesResultado { receita: number; resultado: number; socios: number; estimado: boolean }

const key = (schoolId: string) => `result-basis:${schoolId}`;
const EVT = 'result-basis-change';

/** Preferência Competência/Caixa por empresa, sincronizada entre cartões. */
export function useResultBasis(schoolId: string): [ResultBasis, (b: ResultBasis) => void] {
  const read = () => (localStorage.getItem(key(schoolId)) as ResultBasis) || 'competencia';
  const [basis, setBasis] = useState<ResultBasis>(read);
  useEffect(() => {
    setBasis(read());
    const h = () => setBasis(read());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);
  const set = (b: ResultBasis) => { localStorage.setItem(key(schoolId), b); window.dispatchEvent(new Event(EVT)); };
  return [basis, set];
}

/** Resultado mensal por competência (Relatório Realizado) ou caixa (Fluxo de Caixa); histórico só nos meses sem lançamentos. */
export function useResultadoMensal(schoolId: string, basis: ResultBasis) {
  const entityId = useEntityFilter();
  const { data: entries = [], isLoading: l1 } = useEntries(schoolId);
  const { data: classifications = [], isLoading: l2 } = useTypeClassifications(schoolId);
  const { data: historical = [], isLoading: l3 } = useHistoricalRows(schoolId);
  const { data: realized = [], isLoading: l4 } = useRealizedEntries(schoolId, entityId);

  const { data: itensRec = [], isLoading: l5 } = useQuery({
    queryKey: ['resultado_itens_receita', schoolId, entityId || 'all'],
    enabled: !!schoolId,
    queryFn: async () => {
      const { fetchAllRows } = await import('@/lib/fetchAll');
      const rows = await fetchAllRows<any>('expense_detail_items', q =>
        applyEntityFilterShared(q.select('data,valor,entity_id').eq('school_id', schoolId).eq('tipo', 'receita'), entityId || 'all'));
      return scaleSharedRows(rows, entityId || 'all', schoolId);
    },
    staleTime: 15 * 60 * 1000,
  });

  const meses = useMemo(() => {
    const compute = (basis: ResultBasis): Map<string, MesResultado> => {
    const out = new Map<string, MesResultado>();
    if (basis === 'caixa') {
      const real = entries.filter(e => e.tipoRegistro === 'realizado');
      const byMonth = new Map<string, typeof real>();
      real.forEach(e => { const m = e.data.slice(0, 7); const l = byMonth.get(m); if (l) l.push(e); else byMonth.set(m, [e]); });
      byMonth.forEach((list, m) => {
        const t = calculateTotals(list, classifications);
        const socios = list.filter(e => e.tipo === 'saida' && excluiSocios(e.categoria || e.tipoOriginal || '', e.descricao)).reduce((s, e) => s + Math.abs(e.valor), 0);
        out.set(m, { receita: t.receitas, resultado: t.resultado, socios, estimado: false });
      });
    } else {
      (realized as any[]).forEach(e => {
        const m = String(e.data).slice(0, 7);
        const a = out.get(m) ?? { receita: 0, resultado: 0, socios: 0, estimado: false };
        const v = Math.abs(Number(e.valor) || 0);
        if (e.tipo === 'receita') { a.receita += v; a.resultado += v; }
        else if (e.tipo === 'despesa') { a.resultado -= v; if (excluiSocios(e.conta_nome, e.descricao)) a.socios += v; }
        out.set(m, a);
      });
    }
    if (basis === 'competencia') {
      // Mês com receita no Realizado: usa o Realizado. Senão: fechamento mensal (histórico). Senão: Centro de Custos + despesas do Realizado. Sem receita em lugar nenhum: mês fica fora.
      const hist = new Map<string, { receita: number; resultado: number }>();
      historical.forEach(row => {
        const rule = resolveLedgerRule(row.tipo_valor, classifications);
        if (!rule.entraNoResultado) return;
        const h = hist.get(row.month) ?? { receita: 0, resultado: 0 };
        const v = Number(row.valor);
        if (rule.operacaoSinal === 'somar') { h.receita += v; h.resultado += v; } else h.resultado -= v;
        hist.set(row.month, h);
      });
      const itens = new Map<string, number>();
      (itensRec as any[]).forEach(i => { const m = String(i.data).slice(0, 7); itens.set(m, (itens.get(m) ?? 0) + Math.abs(Number(i.valor) || 0)); });
      const months = new Set([...out.keys(), ...hist.keys(), ...itens.keys()]);
      const final = new Map<string, MesResultado>();
      months.forEach(m => {
        const r = out.get(m);
        if (r && r.receita > 0) { final.set(m, r); return; }
        const h = hist.get(m);
        if (h && h.receita > 0) { final.set(m, { receita: h.receita, resultado: h.resultado, socios: r?.socios ?? 0, estimado: true }); return; }
        const iv = itens.get(m) ?? 0;
        if (iv > 0) final.set(m, { receita: iv, resultado: iv + (r?.resultado ?? 0), socios: r?.socios ?? 0, estimado: true });
      });
      return final;
    }
    const withData = new Set(out.keys());
    if (entityId && entityId !== 'all') {
      // Sem caixa real separado por CNPJ antes dos lançamentos: usa a competência do CNPJ (estimado).
      compute('competencia').forEach((v, m) => { if (!withData.has(m)) out.set(m, { ...v, estimado: true }); });
      for (const [m, v] of out) if (v.receita <= 0) out.delete(m);
      return out;
    }
    historical.forEach(row => {
      if (withData.has(row.month)) return;
      const rule = resolveLedgerRule(row.tipo_valor, classifications);
      if (!rule.entraNoResultado) return;
      const a = out.get(row.month) ?? { receita: 0, resultado: 0, socios: 0, estimado: true };
      const v = Number(row.valor);
      if (rule.operacaoSinal === 'somar') { a.receita += v; a.resultado += v; } else a.resultado -= v;
      out.set(row.month, a);
    });
    return out;
    };
    return compute(basis);
  }, [basis, entityId, entries, classifications, historical, realized, itensRec]);

  return { meses, isLoading: l1 || l2 || l3 || l4 || l5 };
}
