import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, Wallet, Percent } from 'lucide-react';

interface Props {
  schoolId: string;
  /** "all" | "YYYY-MM" | "YYYY-MM,YYYY-MM,..." */
  selectedMonth: string;
  /** Filtra por nome do banco/investimento. Se omitido, agrega todos. */
  bankName?: string;
}

interface Row {
  id: string;
  month: string;
  nome: string;
  aplicacao: number;
  resgate: number;
  rendimentos: number;
  encargos: number;
  rendimento_provisionado: number;
  saldo_inicial: number;
  saldo_final: number;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return formatCurrency(v);
}

export function InvestimentoCard({ schoolId, selectedMonth, bankName }: Props) {
  const { data: allRows = [] } = useQuery({
    queryKey: ['investment_entries_card', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_entries' as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    enabled: !!schoolId,
  });

  const rows = useMemo(
    () => (bankName ? allRows.filter(r => r.nome === bankName) : allRows),
    [allRows, bankName]
  );

  const selectedMonths = useMemo(() => {
    if (selectedMonth === 'all') return null;
    return new Set(selectedMonth.split(',').map(s => s.trim()).filter(Boolean));
  }, [selectedMonth]);

  const filtered = useMemo(() => {
    if (!selectedMonths) return rows;
    return rows.filter(r => selectedMonths.has(r.month));
  }, [rows, selectedMonths]);

  const monthly = useMemo(() => {
    const map = new Map<string, {
      month: string; aplicacao: number; resgate: number; rendimentos: number;
      encargos: number; rendimento_provisionado: number; saldo_final: number;
    }>();
    for (const r of filtered) {
      const cur = map.get(r.month) ?? {
        month: r.month, aplicacao: 0, resgate: 0, rendimentos: 0,
        encargos: 0, rendimento_provisionado: 0, saldo_final: 0,
      };
      cur.aplicacao += Number(r.aplicacao) || 0;
      cur.resgate += Number(r.resgate) || 0;
      cur.rendimentos += Number(r.rendimentos) || 0;
      cur.encargos += Number(r.encargos) || 0;
      cur.rendimento_provisionado += Number(r.rendimento_provisionado) || 0;
      cur.saldo_final += Number(r.saldo_final) || 0;
      map.set(r.month, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const totals = useMemo(() => {
    const t = { investido: 0, resgatado: 0, rendimento: 0, encargos: 0, provisionado: 0, acumulado: 0 };
    for (const m of monthly) {
      t.investido += m.aplicacao;
      t.resgatado += m.resgate;
      t.rendimento += m.rendimentos;
      t.encargos += m.encargos;
      t.provisionado += m.rendimento_provisionado;
    }
    t.acumulado = monthly.length ? monthly[monthly.length - 1].saldo_final : 0;
    return t;
  }, [monthly]);

  const rendimentoLiquido = totals.rendimento + totals.provisionado - totals.encargos;
  const rentabilidade = totals.investido > 0 ? (rendimentoLiquido / totals.investido) * 100 : 0;
  const positivo = rendimentoLiquido >= 0;

  const allMonthly = useMemo(() => {
    const map = new Map<string, { month: string; saldo: number; aplicacao: number; rendimento: number }>();
    for (const r of rows) {
      const cur = map.get(r.month) ?? { month: r.month, saldo: 0, aplicacao: 0, rendimento: 0 };
      cur.saldo += Number(r.saldo_final) || 0;
      cur.aplicacao += Number(r.aplicacao) || 0;
      cur.rendimento += (Number(r.rendimentos) || 0) + (Number(r.rendimento_provisionado) || 0) - (Number(r.encargos) || 0);
      map.set(r.month, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  const chartData = useMemo(() => allMonthly.map(m => ({
    month: m.month,
    label: m.month.split('-').reverse().slice(0, 2).join('/'),
    saldo: m.saldo,
    aplicacao: m.aplicacao,
    rendimento: m.rendimento,
  })), [allMonthly]);

  const hasData = chartData.length > 0;
  const title = bankName || 'Investimentos';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6 shadow-lg"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <PiggyBank className="w-4 h-4" /> {title}
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
            {formatCurrency(totals.acumulado)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Valor total acumulado · {monthly.length} {monthly.length === 1 ? 'mês' : 'meses'}
          </div>
        </div>

        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
          positivo ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                   : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
        }`}>
          {positivo ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {rentabilidade.toFixed(2)}%
          <span className="text-xs font-normal opacity-70">rentab.</span>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={<ArrowUpRight className="w-3.5 h-3.5" />} label="Total Investido" value={formatShort(totals.investido)} tone="primary" />
        <Metric icon={<Wallet className="w-3.5 h-3.5" />} label="Rendimento" value={formatShort(rendimentoLiquido)} tone={positivo ? 'positive' : 'negative'} />
        <Metric icon={<Percent className="w-3.5 h-3.5" />} label="Rentabilidade" value={`${rentabilidade.toFixed(2)}%`} tone={positivo ? 'positive' : 'negative'} />
        <Metric icon={<PiggyBank className="w-3.5 h-3.5" />} label="Acumulado" value={formatShort(totals.acumulado)} tone="muted" />
      </div>

      <div className="relative mt-6 h-48">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`invSaldoGrad-${(bankName || 'all').replace(/\s+/g,'_')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.25} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => formatShort(Number(v))}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: any, k: string) => [formatCurrency(Number(v)), k === 'saldo' ? 'Saldo' : k === 'aplicacao' ? 'Aplicação' : 'Rendimento']}
                labelFormatter={(l) => `Mês ${l}`}
              />
              <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={`url(#invSaldoGrad-${(bankName || 'all').replace(/\s+/g,'_')})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Sem dados de investimento no período selecionado.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Metric({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string;
  tone: 'primary' | 'positive' | 'negative' | 'muted';
}) {
  const toneClasses = {
    primary: 'text-primary',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-rose-600 dark:text-rose-400',
    muted: 'text-foreground',
  }[tone];
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${toneClasses}`}>{value}</div>
    </div>
  );
}
