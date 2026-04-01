import { useMemo } from 'react';
import { FinancialEntry, TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { useSchool, useEntriesFromBaseDate, useTypeClassifications, usePaymentDelayRules } from '@/hooks/useFinancialData';
import { Target, CalendarCheck, ArrowDown, ArrowUp } from 'lucide-react';
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

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function findCls(tipoKey: string, classifications: TypeClassification[]) {
  return classifications.find(c => normalize(c.tipoValor) === normalize(tipoKey));
}

function isIgnored(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return false;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  if (FIXED_RESULT_TYPES.includes(normalize(tipoKey))) return false;
  if (['entrada', 'saida'].includes(normalize(tipoKey))) return false;
  const cls = findCls(tipoKey, classifications);
  return cls?.classificacao === 'ignorar';
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

  // Totals based strictly on tipo field (single source of truth)
  const totalEntradas = useMemo(() =>
    entries.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0),
    [entries]
  );
  const totalSaidas = useMemo(() =>
    entries.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0),
    [entries]
  );
  const resultado = totalEntradas - totalSaidas;

  const saldoFinal = useMemo(() => {
    let saldo = saldoInicial;
    activeEntries
      .filter(e => matchesMonthFilter(e.data, selectedMonth))
      .forEach(e => {
        if (e.tipo === 'entrada') saldo += e.valor;
        else saldo -= e.valor;
      });
    return saldo;
  }, [activeEntries, selectedMonth, saldoInicial]);

  // Breakdown by tipo_registro
  const realizadoEntradas = useMemo(() =>
    entries.filter(e => e.tipoRegistro === 'realizado' && e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0),
    [entries]
  );
  const realizadoSaidas = useMemo(() =>
    entries.filter(e => e.tipoRegistro === 'realizado' && e.tipo === 'saida').reduce((s, e) => s + e.valor, 0),
    [entries]
  );
  const projetadoEntradas = useMemo(() =>
    entries.filter(e => e.tipoRegistro === 'projetado' && e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0),
    [entries]
  );
  const projetadoSaidas = useMemo(() =>
    entries.filter(e => e.tipoRegistro === 'projetado' && e.tipo === 'saida').reduce((s, e) => s + e.valor, 0),
    [entries]
  );

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> Resultado do Período
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Entradas</span>
            </div>
            <p className="text-2xl font-display font-bold text-primary">{formatCurrency(totalEntradas)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDown className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Saídas</span>
            </div>
            <p className="text-2xl font-display font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado</span>
            </div>
            <p className={`text-2xl font-display font-bold ${resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(resultado)}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Final</span>
            </div>
            <p className={`text-2xl font-display font-bold ${saldoFinal >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(saldoFinal)}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Realizado vs Projetado breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">✔ Realizado</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Entradas</span>
              <p className="text-lg font-display font-bold text-primary">{formatCurrency(realizadoEntradas)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Saídas</span>
              <p className="text-lg font-display font-bold text-destructive">{formatCurrency(realizadoSaidas)}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase">Resultado Realizado</span>
            <p className={`text-lg font-display font-bold ${realizadoEntradas - realizadoSaidas >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(realizadoEntradas - realizadoSaidas)}
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">📊 Projetado</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Entradas</span>
              <p className="text-lg font-display font-bold text-primary">{formatCurrency(projetadoEntradas)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Saídas</span>
              <p className="text-lg font-display font-bold text-destructive">{formatCurrency(projetadoSaidas)}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase">Resultado Projetado</span>
            <p className={`text-lg font-display font-bold ${projetadoEntradas - projetadoSaidas >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(projetadoEntradas - projetadoSaidas)}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
