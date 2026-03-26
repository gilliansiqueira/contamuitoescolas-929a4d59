import { useMemo } from 'react';
import { getEntries } from '@/lib/storage';
import { motion } from 'framer-motion';

interface ProjectedVsRealProps {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProjectedVsReal({ schoolId }: ProjectedVsRealProps) {
  const entries = useMemo(() => getEntries(schoolId), [schoolId]);

  const projected = entries.filter(e => e.origem !== 'fluxo');
  const realized = entries.filter(e => e.origem === 'fluxo');

  const byMonth = useMemo(() => {
    const months = new Set<string>();
    [...projected, ...realized].forEach(e => months.add(e.data.slice(0, 7)));

    return Array.from(months).sort().map(mes => {
      const projRec = projected.filter(e => e.data.startsWith(mes) && e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
      const projDes = projected.filter(e => e.data.startsWith(mes) && e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);
      const realRec = realized.filter(e => e.data.startsWith(mes) && e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
      const realDes = realized.filter(e => e.data.startsWith(mes) && e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);

      const diffRec = realRec - projRec;
      const diffDes = realDes - projDes;
      const accRec = projRec > 0 ? ((realRec / projRec) * 100) : 0;
      const accDes = projDes > 0 ? ((realDes / projDes) * 100) : 0;

      return { mes, projRec, projDes, realRec, realDes, diffRec, diffDes, accRec, accDes };
    });
  }, [projected, realized]);

  if (byMonth.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Importe dados projetados e o fluxo realizado para comparação.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-display font-semibold">Projetado vs Realizado</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mês</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rec. Proj.</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rec. Real</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Diff</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acurácia</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Desp. Proj.</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Desp. Real</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Diff</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acurácia</th>
            </tr>
          </thead>
          <tbody>
            {byMonth.map(m => (
              <tr key={m.mes} className="border-t border-border/30">
                <td className="px-3 py-2 font-medium">{m.mes}</td>
                <td className="px-3 py-2 text-right text-primary">{formatCurrency(m.projRec)}</td>
                <td className="px-3 py-2 text-right text-primary">{formatCurrency(m.realRec)}</td>
                <td className={`px-3 py-2 text-right ${m.diffRec >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(m.diffRec)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    m.accRec >= 90 ? 'bg-primary/10 text-primary' :
                    m.accRec >= 70 ? 'bg-secondary/10 text-secondary' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {m.accRec.toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-destructive">{formatCurrency(m.projDes)}</td>
                <td className="px-3 py-2 text-right text-destructive">{formatCurrency(m.realDes)}</td>
                <td className={`px-3 py-2 text-right ${m.diffDes <= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(m.diffDes)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    m.accDes >= 90 ? 'bg-primary/10 text-primary' :
                    m.accDes >= 70 ? 'bg-secondary/10 text-secondary' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {m.accDes.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
