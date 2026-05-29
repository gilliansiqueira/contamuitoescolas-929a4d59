import { useMemo } from 'react';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import {
  filterActiveEntries,
  calculateTotals,
} from '@/lib/classificationUtils';
import { motion } from 'framer-motion';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProjectedVsRealProps { schoolId: string; }

/**
 * Previsto x Realizado — SSOT financeira.
 *
 * Regras (alinhadas com Dashboard/CashFlow):
 *  - filterActiveEntries  → remove categorias marcadas como Ignorar.
 *  - useSchoolModel       → gate estrito: tipos fora do modelo não entram.
 *  - tipoRegistro         → separa Projetado (futuro) de Realizado (≤ hoje).
 *  - calculateTotals      → usa classificationUtils para somar receitas/despesas
 *                           respeitando classificação e sinal definidos pelo
 *                           usuário em type_classifications.
 */
export function ProjectedVsReal({ schoolId }: ProjectedVsRealProps) {
  const { data: entries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { hasModel, isInModel } = useSchoolModel(schoolId);

  const activeEntries = useMemo(() => {
    const noIgnored = filterActiveEntries(entries, classifications);
    return hasModel
      ? noIgnored.filter(e => isInModel(e.tipoOriginal || e.tipo))
      : noIgnored;
  }, [entries, classifications, hasModel, isInModel]);

  const byMonth = useMemo(() => {
    const months = new Set<string>();
    activeEntries.forEach(e => months.add(e.data.slice(0, 7)));

    return Array.from(months).sort().map(mes => {
      const monthEntries = activeEntries.filter(e => e.data.startsWith(mes));
      const projetado = monthEntries.filter(e => e.tipoRegistro === 'projetado');
      const realizado = monthEntries.filter(e => e.tipoRegistro === 'realizado');

      const pT = calculateTotals(projetado, classifications);
      const rT = calculateTotals(realizado, classifications);

      return {
        mes,
        projRec: pT.receitas,
        projDes: pT.despesas,
        realRec: rT.receitas,
        realDes: rT.despesas,
        diffRec: rT.receitas - pT.receitas,
        diffDes: rT.despesas - pT.despesas,
        accRec: pT.receitas > 0 ? (rT.receitas / pT.receitas) * 100 : 0,
        accDes: pT.despesas > 0 ? (rT.despesas / pT.despesas) * 100 : 0,
      };
    });
  }, [activeEntries, classifications]);

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
                <td className="px-3 py-2 text-right text-success">{formatCurrency(m.projRec)}</td>
                <td className="px-3 py-2 text-right text-success">{formatCurrency(m.realRec)}</td>
                <td className={`px-3 py-2 text-right ${m.diffRec >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(m.diffRec)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${m.accRec >= 90 ? 'bg-success/10 text-success' : m.accRec >= 70 ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                    {m.accRec.toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-destructive">{formatCurrency(m.projDes)}</td>
                <td className="px-3 py-2 text-right text-destructive">{formatCurrency(m.realDes)}</td>
                <td className={`px-3 py-2 text-right ${m.diffDes <= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(m.diffDes)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${m.accDes >= 90 ? 'bg-success/10 text-success' : m.accDes >= 70 ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
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
