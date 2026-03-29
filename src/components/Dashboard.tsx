import { useMemo } from 'react';
import { FinancialEntry, TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { getEntriesFromBaseDate, getSaldoInicial, getTypeClassifications } from '@/lib/storage';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Landmark, Smartphone, AlertTriangle, Wallet, Target, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
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
  if (entry.origem !== 'fluxo') return false; // only fluxo entries go to resultado
  const tipoKey = entry.tipoOriginal || entry.tipo;
  // Fixed types always count
  if (FIXED_RESULT_TYPES.includes(tipoKey.toLowerCase())) return true;
  if (['entrada', 'saida'].includes(tipoKey.toLowerCase())) return true;
  // Check classification
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.entraNoResultado ?? false;
}

function impactaCaixa(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return true; // non-fluxo always impacts cash
  const tipoKey = entry.tipoOriginal || entry.tipo;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.impactaCaixa ?? true;
}

export function Dashboard({ schoolId, selectedMonth }: DashboardProps) {
  const allEntries = useMemo(() => getEntriesFromBaseDate(schoolId), [schoolId]);
  const saldoInicial = useMemo(() => getSaldoInicial(schoolId), [schoolId]);
  const classifications = useMemo(() => getTypeClassifications(schoolId), [schoolId]);

  // Filter by selected month(s)
  const entries = useMemo(() =>
    allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth)),
    [allEntries, selectedMonth]
  );

  // Classify
  const realized = useMemo(() => entries.filter(e => e.origem === 'fluxo'), [entries]);
  const projected = useMemo(() => entries.filter(e => e.origem !== 'fluxo'), [entries]);

  // BLOCO: RESULTADO (only realized entries that enter resultado)
  const receitaReal = useMemo(() =>
    realized.filter(e => e.tipo === 'entrada' && entraNoResultado(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const despesaReal = useMemo(() =>
    realized.filter(e => e.tipo === 'saida' && entraNoResultado(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const resultadoReal = receitaReal - despesaReal;

  // BLOCO: OPERAÇÕES (fluxo entries that DON'T enter resultado but DO impact caixa)
  const operacoesEntradas = useMemo(() =>
    realized.filter(e => e.tipo === 'entrada' && !entraNoResultado(e, classifications) && impactaCaixa(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );
  const operacoesSaidas = useMemo(() =>
    realized.filter(e => e.tipo === 'saida' && !entraNoResultado(e, classifications) && impactaCaixa(e, classifications)).reduce((s, e) => s + e.valor, 0),
    [realized, classifications]
  );

  // BLOCO: PROJEÇÃO
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

  // Cash flow chart (only entries that impact caixa)
  const cashFlow = useMemo(() => {
    const relevant = allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth) && impactaCaixa(e, classifications));
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    relevant.forEach(e => {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    });
    const sorted = Object.keys(byDate).sort();
    let saldo = saldoInicial;
    return sorted.map(data => {
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data: data.slice(5), entradas, saidas, saldo };
    });
  }, [allEntries, selectedMonth, saldoInicial, classifications]);

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
      {/* Saldo Inicial indicator */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-4 flex items-center gap-3">
        <Wallet className="w-5 h-5 text-primary" />
        <span className="text-sm text-muted-foreground">Saldo Inicial:</span>
        <span className="text-sm font-bold text-primary">{formatCurrency(saldoInicial)}</span>
        {saldoInicial === 0 && (
          <span className="text-xs text-secondary ml-2">(Configure em Config → Saldo Inicial)</span>
        )}
      </motion.div>

      {/* BLOCO: RESULTADO (FECHAMENTO) - apenas realizado */}
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

      {/* BLOCO: OPERAÇÕES (não entram no resultado) */}
      {(operacoesEntradas > 0 || operacoesSaidas > 0) && (
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Operações (Não entram no resultado)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass-card rounded-xl p-5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entradas Operacionais</span>
              <p className="text-xl font-display font-bold text-muted-foreground mt-1">{formatCurrency(operacoesEntradas)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card rounded-xl p-5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saídas Operacionais</span>
              <p className="text-xl font-display font-bold text-muted-foreground mt-1">{formatCurrency(operacoesSaidas)}</p>
            </motion.div>
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

      {/* Risk alert */}
      {negativeDays.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-5 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <h4 className="font-display font-semibold text-sm text-destructive">Risco de Caixa Detectado</h4>
              <p className="text-xs text-muted-foreground mt-1">
                O saldo ficará negativo em <span className="font-semibold text-foreground">{firstNegativeDay!.data}</span> ({formatCurrency(firstNegativeDay!.saldo)}).
                {firstRecoveryDay && <> Recuperação em <span className="font-semibold text-foreground">{firstRecoveryDay.data}</span>.</>}
                {!firstRecoveryDay && <> Sem previsão de recuperação no período.</>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">{negativeDays.length}</span> dia(s) com saldo negativo projetado.
              </p>
            </div>
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
