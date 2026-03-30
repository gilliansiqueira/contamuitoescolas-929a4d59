import { useMemo } from 'react';
import { FinancialEntry, TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { getEntriesFromBaseDate, getSaldoInicial, getTypeClassifications, getPaymentDelayRules } from '@/lib/storage';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Landmark, Smartphone, AlertTriangle, Wallet, Target, CalendarCheck, ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { addDaysAndAdjust } from '@/lib/dateUtils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Legend,
} from 'recharts';

interface DashboardProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function categorizePaymentType(entry: FinancialEntry): string {
  const cat = entry.categoria.toLowerCase();
  const desc = entry.descricao.toLowerCase();
  if (cat.includes('cartao') || cat.includes('cartão') || desc.includes('cartão') || desc.includes('cartao') || entry.origem === 'cartao') return 'cartao';
  if (cat.includes('pix') || desc.includes('pix')) return 'pix';
  if (cat.includes('boleto') || desc.includes('boleto') || cat.includes('cobrança bancária') || cat.includes('cobranca bancaria') || cat.includes('mensalidade')) return 'boleto';
  if (cat.includes('cheque') || entry.origem === 'cheque') return 'cheque';
  return 'outros';
}

const paymentTypeLabels: Record<string, string> = {
  cartao: 'Cartão',
  pix: 'PIX',
  boleto: 'Boleto',
  cheque: 'Cheque',
  outros: 'Outros',
};

/** Check if a fluxo entry's tipo counts towards resultado based on type classifications */
function entraNoResultado(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return false;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  if (FIXED_RESULT_TYPES.includes(tipoKey.toLowerCase())) return true;
  if (['entrada', 'saida'].includes(tipoKey.toLowerCase())) return true;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.entraNoResultado ?? false;
}

function impactaCaixa(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return true;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.impactaCaixa ?? true;
}

/** Apply payment delays to sponte entries */
function applyDelays(entries: FinancialEntry[], schoolId: string): FinancialEntry[] {
  const rules = getPaymentDelayRules(schoolId);
  return entries.map(e => {
    if (e.origem !== 'sponte' || e.tipo !== 'entrada') return e;
    const forma = e.categoria || '';
    const rule = rules.find(r => forma.toLowerCase().includes(r.formaCobranca.toLowerCase()));
    if (!rule || rule.prazo === 0) return e;
    return { ...e, data: addDaysAndAdjust(e.data, rule.prazo) };
  });
}

export function Dashboard({ schoolId, selectedMonth }: DashboardProps) {
  const rawEntries = useMemo(() => getEntriesFromBaseDate(schoolId), [schoolId]);
  const allEntries = useMemo(() => applyDelays(rawEntries, schoolId), [rawEntries, schoolId]);
  const saldoInicial = useMemo(() => getSaldoInicial(schoolId), [schoolId]);
  const classifications = useMemo(() => getTypeClassifications(schoolId), [schoolId]);

  const entries = useMemo(() =>
    allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth)),
    [allEntries, selectedMonth]
  );

  // Classify
  const realized = useMemo(() => entries.filter(e => e.origem === 'fluxo'), [entries]);
  const projected = useMemo(() => entries.filter(e => e.origem !== 'fluxo'), [entries]);

  // RESULTADO (only realized entries that enter resultado)
  const receitaReal = useMemo(() =>
    realized.filter(e => e.tipo === 'entrada' && entraNoResultado(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const despesaReal = useMemo(() =>
    realized.filter(e => e.tipo === 'saida' && entraNoResultado(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const resultadoReal = receitaReal - despesaReal;

  // OPERAÇÕES DETALHADAS (fluxo entries that DON'T enter resultado but DO impact caixa)
  const operacoesDetalhadas = useMemo(() => {
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

  // PROJEÇÃO
  const receitaProjetada = projected.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const despesaProjetada = projected.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);

  // Entradas por tipo de pagamento
  const entradasPorTipo = useMemo(() => {
    const byType: Record<string, number> = {};
    entries.filter(e => e.tipo === 'entrada').forEach(e => {
      const t = categorizePaymentType(e);
      byType[t] = (byType[t] || 0) + e.valor;
    });
    return Object.entries(byType).map(([tipo, valor]) => ({ tipo, label: paymentTypeLabels[tipo] || tipo, valor }));
  }, [entries]);

  // SALDO FINAL DO PERÍODO & Cash flow chart
  const cashFlow = useMemo(() => {
    const relevant = allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth) && impactaCaixa(e, classifications));
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    relevant.forEach(e => {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    });
    // Include all entries before period for starting balance
    let saldo = saldoInicial;
    const periodDates = Object.keys(byDate).sort();
    if (periodDates.length > 0) {
      allEntries.filter(e => e.data < periodDates[0] && impactaCaixa(e, classifications)).forEach(e => {
        if (e.tipo === 'entrada') saldo += e.valor;
        else saldo -= e.valor;
      });
    }
    return periodDates.map(data => {
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data: data.slice(5), entradas, saidas, saldo };
    });
  }, [allEntries, selectedMonth, saldoInicial, classifications]);

  const saldoFinalPeriodo = cashFlow.length > 0 ? cashFlow[cashFlow.length - 1].saldo : saldoInicial;

  // Alerts
  const negativeDays = cashFlow.filter(d => d.saldo < 0);
  const firstNegativeDay = negativeDays.length > 0 ? negativeDays[0] : null;
  const firstRecoveryDay = (() => {
    if (!firstNegativeDay) return null;
    const idx = cashFlow.indexOf(firstNegativeDay);
    for (let i = idx + 1; i < cashFlow.length; i++) {
      if (cashFlow[i].saldo >= 0) return cashFlow[i];
    }
    return null;
  })();

  const totalEntradas = entries.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const totalSaidas = entries.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);
  const despesasSuperamEntradas = totalSaidas > totalEntradas;

  // Projeção 7 dias
  const projecao7d = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const d7 = new Date();
    d7.setDate(d7.getDate() + 7);
    const in7days = d7.toISOString().slice(0, 10);
    let saldo = saldoInicial;
    allEntries.filter(e => e.data <= in7days && impactaCaixa(e, classifications)).sort((a, b) => a.data.localeCompare(b.data)).forEach(e => {
      if (e.tipo === 'entrada') saldo += e.valor;
      else saldo -= e.valor;
    });
    return saldo;
  }, [allEntries, saldoInicial, classifications]);

  // Monthly bar chart
  const monthlyChart = useMemo(() => {
    const byMonth: Record<string, { receitas: number; despesas: number }> = {};
    entries.forEach(e => {
      const m = e.data.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { receitas: 0, despesas: 0 };
      if (e.tipo === 'entrada') byMonth[m].receitas += e.valor;
      else byMonth[m].despesas += e.valor;
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }));
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* ALERTAS AUTOMÁTICOS */}
      {(firstNegativeDay || despesasSuperamEntradas) && (
        <div className="space-y-3">
          {firstNegativeDay && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-xl p-4 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-display font-semibold text-sm text-destructive">💥 Saldo Negativo Detectado</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saldo ficará negativo em <span className="font-bold text-foreground">{firstNegativeDay.data}</span> ({formatCurrency(firstNegativeDay.saldo)}).
                    {firstRecoveryDay && <> Recuperação em <span className="font-bold text-foreground">{firstRecoveryDay.data}</span>.</>}
                    {!firstRecoveryDay && <> Sem previsão de recuperação no período.</>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold">{negativeDays.length}</span> dia(s) com saldo negativo.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
          {despesasSuperamEntradas && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}
              className="glass-card rounded-xl p-4 border-orange-400/30 bg-orange-50">
              <div className="flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-display font-semibold text-sm text-orange-600">📉 Despesas Superiores às Entradas</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    No período selecionado, as saídas ({formatCurrency(totalSaidas)}) superam as entradas ({formatCurrency(totalEntradas)}).
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* RESUMO SUPERIOR - KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saldo Final do Período</span>
          </div>
          <p className={`text-2xl font-display font-bold ${saldoFinalPeriodo >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(saldoFinalPeriodo)}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUp className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Entradas</span>
          </div>
          <p className="text-2xl font-display font-bold text-primary">{formatCurrency(totalEntradas)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown className="w-4 h-4 text-destructive" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Saídas</span>
          </div>
          <p className="text-2xl font-display font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projeção 7 dias</span>
          </div>
          <p className={`text-2xl font-display font-bold ${projecao7d >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(projecao7d)}
          </p>
        </motion.div>
      </div>

      {/* Saldo Inicial */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-4 flex items-center gap-3">
        <Wallet className="w-5 h-5 text-primary" />
        <span className="text-sm text-muted-foreground">Saldo Inicial:</span>
        <span className="text-sm font-bold text-primary">{formatCurrency(saldoInicial)}</span>
        {saldoInicial === 0 && (
          <span className="text-xs text-secondary ml-2">(Configure em Config → Saldo Inicial)</span>
        )}
      </motion.div>

      {/* BLOCO: RESULTADO (FECHAMENTO) */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> Resultado (Realizado)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Receita Real', value: receitaReal, color: 'primary' as const },
            { label: 'Despesa Real', value: despesaReal, color: 'destructive' as const },
            { label: 'Resultado', value: resultadoReal, color: (resultadoReal >= 0 ? 'primary' : 'destructive') as 'primary' | 'destructive' },
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Realizado</span>
              </div>
              <p className={`text-2xl font-display font-bold ${card.color === 'primary' ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(card.value)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* BLOCO: OPERAÇÕES DETALHADAS POR TIPO */}
      {operacoesDetalhadas.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Operações por Tipo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {operacoesDetalhadas.map((op, i) => (
              <motion.div key={op.tipo} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}
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

      {/* BLOCO: PROJEÇÃO */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Projeção
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Receitas Projetadas', value: receitaProjetada, color: 'primary' as const },
            { label: 'Despesas Projetadas', value: despesaProjetada, color: 'destructive' as const },
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }}
              className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded font-semibold">Projetado</span>
              </div>
              <p className={`text-2xl font-display font-bold ${card.color === 'primary' ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(card.value)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Entradas por tipo */}
      {entradasPorTipo.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-card rounded-xl p-6">
          <h3 className="text-base font-display font-semibold mb-4 text-foreground">Recebíveis por Tipo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {entradasPorTipo.map(t => (
              <div key={t.tipo} className="bg-surface rounded-lg p-4 text-center">
                <div className="flex justify-center mb-2">
                  {t.tipo === 'cartao' && <CreditCard className="w-5 h-5 text-primary" />}
                  {t.tipo === 'pix' && <Smartphone className="w-5 h-5 text-primary" />}
                  {t.tipo === 'boleto' && <Landmark className="w-5 h-5 text-primary" />}
                  {(t.tipo === 'cheque' || t.tipo === 'outros') && <DollarSign className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground font-medium">{t.label}</p>
                <p className="text-lg font-display font-bold text-primary mt-1">{formatCurrency(t.valor)}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Balance projection chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card rounded-xl p-6">
        <h3 className="text-base font-display font-semibold mb-4 text-foreground">Projeção de Saldo</h3>
        {cashFlow.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cashFlow}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(174, 55%, 40%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(174, 55%, 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 88%)" />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 45%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(210, 10%, 45%)' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(210, 15%, 88%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 25%, 15%)' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <ReferenceLine y={0} stroke="hsl(0, 72%, 50%)" strokeDasharray="4 4" strokeWidth={1.5} />
              <Area type="monotone" dataKey="saldo" stroke="hsl(174, 55%, 40%)" fill="url(#greenGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Importe dados para visualizar o gráfico
          </div>
        )}
      </motion.div>

      {/* Monthly bar chart */}
      {monthlyChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-6">
          <h3 className="text-base font-display font-semibold mb-4 text-foreground">Receitas vs Despesas por Mês</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 88%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 45%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(210, 10%, 45%)' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(210, 15%, 88%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 25%, 15%)' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(174, 55%, 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 72%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
