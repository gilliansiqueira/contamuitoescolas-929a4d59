import { useMemo } from 'react';
import { FinancialEntry, TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { useSchool, useEntriesFromBaseDate, useTypeClassifications, usePaymentDelayRules } from '@/hooks/useFinancialData';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Target, CalendarCheck, ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { addDaysAndAdjust } from '@/lib/dateUtils';

interface DashboardProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function entraNoResultado(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return false;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  if (FIXED_RESULT_TYPES.includes(tipoKey.toLowerCase())) return true;
  if (['entrada', 'saida'].includes(tipoKey.toLowerCase())) return true;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.entraNoResultado ?? false;
}

function isIgnored(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return false;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  if (FIXED_RESULT_TYPES.includes(tipoKey.toLowerCase())) return false;
  if (['entrada', 'saida'].includes(tipoKey.toLowerCase())) return false;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.classificacao === 'ignorar';
}

function impactaCaixa(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (isIgnored(entry, classifications)) return false;
  if (entry.origem !== 'fluxo') return true;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.impactaCaixa ?? true;
}

function applyDelays(entries: FinancialEntry[], rules: { formaCobranca: string; prazo: number }[]): FinancialEntry[] {
  return entries.map(e => {
    if (e.origem !== 'sponte' || e.tipo !== 'entrada') return e;
    const forma = e.categoria || '';
    const rule = rules.find(r => forma.toLowerCase().includes(r.formaCobranca.toLowerCase()));
    if (!rule || rule.prazo === 0) return e;
    return { ...e, data: addDaysAndAdjust(e.data, rule.prazo) };
  });
}

export function Dashboard({ schoolId, selectedMonth }: DashboardProps) {
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const baseDate = school?.saldoInicialData;
  const { data: rawEntries = [] } = useEntriesFromBaseDate(schoolId, baseDate);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { data: delayRules = [] } = usePaymentDelayRules(schoolId);

  const allEntries = useMemo(() => applyDelays(rawEntries, delayRules), [rawEntries, delayRules]);

  const activeEntries = useMemo(() =>
    allEntries.filter(e => !isIgnored(e, classifications)),
    [allEntries, classifications]
  );

  const entries = useMemo(() =>
    activeEntries.filter(e => matchesMonthFilter(e.data, selectedMonth)),
    [activeEntries, selectedMonth]
  );

  const realized = useMemo(() => entries.filter(e => e.origem === 'fluxo'), [entries]);

  // Receitas e despesas (só o que entra no resultado)
  const receitaReal = useMemo(() =>
    realized.filter(e => e.tipo === 'entrada' && entraNoResultado(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const despesaReal = useMemo(() =>
    realized.filter(e => e.tipo === 'saida' && entraNoResultado(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const resultado = receitaReal - despesaReal;

  // Operações (não entram no resultado mas impactam caixa) — ex: resgates, transferências classificadas como operação
  const operacoes = useMemo(() => {
    const ops = realized.filter(e => !entraNoResultado(e, classifications) && impactaCaixa(e, classifications));
    const byTipo: Record<string, { entradas: number; saidas: number }> = {};
    ops.forEach(e => {
      const key = e.tipoOriginal || e.tipo;
      if (!byTipo[key]) byTipo[key] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byTipo[key].entradas += e.valor;
      else byTipo[key].saidas += e.valor;
    });
    return Object.entries(byTipo).map(([tipo, vals]) => ({ tipo, ...vals }));
  }, [realized, classifications]);

  // Saldo final
  const saldoFinal = useMemo(() => {
    let saldo = saldoInicial;
    activeEntries
      .filter(e => matchesMonthFilter(e.data, selectedMonth) && impactaCaixa(e, classifications))
      .forEach(e => {
        if (e.tipo === 'entrada') saldo += e.valor;
        else saldo -= e.valor;
      });
    return saldo;
  }, [activeEntries, selectedMonth, saldoInicial, classifications]);

  return (
    <div className="space-y-6">

      {/* Resultado Realizado — 4 cards */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> Resultado (Realizado)
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita Real</span>
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-primary">{formatCurrency(receitaReal)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesa Real</span>
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-destructive">{formatCurrency(despesaReal)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado</span>
              </div>
            </div>
            <p className={`text-2xl font-display font-bold ${resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(resultado)}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Final</span>
              </div>
            </div>
            <p className={`text-2xl font-display font-bold ${saldoFinal >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(saldoFinal)}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Operações */}
      {operacoes.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Operações
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {operacoes.map((op, i) => (
              <motion.div key={op.tipo} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="glass-card rounded-xl p-4">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{op.tipo}</span>
                <div className="flex items-center justify-between mt-2 gap-4">
                  {op.entradas > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground">Entradas</span>
                      <p className="text-sm font-bold text-primary">{formatCurrency(op.entradas)}</p>
                    </div>
                  )}
                  {op.saidas > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground">Saídas</span>
                      <p className="text-sm font-bold text-destructive">{formatCurrency(op.saidas)}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
