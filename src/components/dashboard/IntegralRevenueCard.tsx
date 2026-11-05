import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Scale } from 'lucide-react';
import { useIntegralRevenue } from '@/hooks/useAutoProfitability';
import { computeProfitability, integralClosing, type MonthTotals } from '@/lib/profitability';
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  schoolId: string;
  month: string; // YYYY-MM (um único mês selecionado)
  totals: MonthTotals;
  readOnly?: boolean;
}

const parseBR = (s: string) => {
  const t = s.replace(/[R$\s]/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
};
const fmtPct = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

/** Fechamento com a receita que entrou (SSOT) × com a receita integral informada pela equipe. */
export function IntegralRevenueCard({ schoolId, month, totals, readOnly }: Props) {
  const { values, save } = useIntegralRevenue(schoolId);
  const saved = values[month];
  const [text, setText] = useState('');
  useEffect(() => { setText(saved ? saved.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''); }, [saved, month]);

  const p = computeProfitability(totals, saved);
  const integral = saved ? integralClosing(totals, saved) : null;
  if (readOnly && !saved) return null;

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fechamentos e lucratividade</span>
        {!readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Receita integral do mês</span>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="sem antecipação" className="h-8 w-36 text-xs" />
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={save.isPending}
              onClick={() => save.mutate({ month, valor: parseBR(text) })}>Salvar</Button>
          </div>
        )}
      </div>
      <div className={`grid gap-3 ${integral ? 'sm:grid-cols-2' : ''}`}>
        <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
          <p className="text-xs font-semibold">Receita que entrou</p>
          <Row label="Receita" value={formatCurrency(totals.receitas)} />
          <Row label="Despesa" value={formatCurrency(totals.despesas)} />
          <Row label="Resultado" value={formatCurrency(totals.receitas - totals.despesas)} />
          <Row label="Lucratividade operacional" value={fmtPct(p.lucro_operacional)} strong />
          <Row label="Lucratividade total (com operações)" value={fmtPct(p.lucro_total)} strong />
        </div>
        {integral && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-1 text-sm">
            <p className="text-xs font-semibold">Receita integral</p>
            <Row label="Receita integral" value={formatCurrency(integral.receitas)} />
            <Row label="Despesa" value={formatCurrency(integral.despesas)} />
            <Row label="Resultado" value={formatCurrency(integral.resultado)} />
            <Row label="Lucratividade com receita integral" value={fmtPct(p.lucro_integral)} strong />
            <p className="text-[10px] text-muted-foreground">Diferença para a receita que entrou: {formatCurrency(integral.diferencaReceita)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
