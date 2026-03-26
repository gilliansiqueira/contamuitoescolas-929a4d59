import { useMemo } from 'react';
import { FinancialEntry, CashFlowDay } from '@/types/financial';
import { getEntries, getClosings } from '@/lib/storage';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface DashboardProps {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Dashboard({ schoolId }: DashboardProps) {
  const entries = useMemo(() => getEntries(schoolId), [schoolId]);
  const closings = useMemo(() => getClosings(schoolId), [schoolId]);

  const totalReceitas = entries.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const totalDespesas = entries.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);
  const resultado = totalReceitas - totalDespesas;

  const cashFlow = useMemo(() => {
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    entries.forEach(e => {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    });
    const sorted = Object.keys(byDate).sort();
    let saldo = 0;
    return sorted.map(data => {
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data: data.slice(5), entradas, saidas, saldo };
    });
  }, [entries]);

  const realizado = closings.reduce((s, c) => s + c.resultado, 0);

  const cards = [
    { label: 'Receitas Projetadas', value: totalReceitas, icon: TrendingUp, color: 'primary' as const },
    { label: 'Despesas Projetadas', value: totalDespesas, icon: TrendingDown, color: 'destructive' as const },
    { label: 'Resultado', value: resultado, icon: DollarSign, color: resultado >= 0 ? 'primary' as const : 'destructive' as const },
    { label: 'Realizado', value: realizado, icon: Target, color: 'secondary' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card rounded-xl p-5 ${
              card.color === 'primary' ? 'glow-green' :
              card.color === 'secondary' ? 'glow-orange' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon className={`w-5 h-5 ${
                card.color === 'primary' ? 'text-primary' :
                card.color === 'secondary' ? 'text-secondary' :
                'text-destructive'
              }`} />
            </div>
            <p className={`text-2xl font-display font-bold ${
              card.color === 'primary' ? 'text-primary' :
              card.color === 'secondary' ? 'text-secondary' :
              'text-destructive'
            }`}>
              {formatCurrency(card.value)}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-xl p-6"
      >
        <h3 className="text-lg font-display font-semibold mb-4">Evolução do Saldo</h3>
        {cashFlow.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cashFlow}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 63%, 49%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 63%, 49%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 18%, 20%)" />
              <XAxis dataKey="data" tick={{ fontSize: 12, fill: 'hsl(215, 15%, 55%)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(215, 15%, 55%)' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(222, 22%, 12%)',
                  border: '1px solid hsl(222, 18%, 20%)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="saldo"
                stroke="hsl(145, 63%, 49%)"
                fill="url(#greenGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Importe dados para visualizar o gráfico
          </div>
        )}
      </motion.div>
    </div>
  );
}
