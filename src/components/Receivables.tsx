import { useMemo } from 'react';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { getEffectiveClassification } from '@/lib/classificationUtils';
import { useTypeClassifications } from '@/hooks/useFinancialData';
import { ProjectedEntry } from '@/lib/projectionEngine';
import { categorizeReceivable, RECEIVABLE_CONFIG, RECEIVABLE_ORDER, ReceivableCategoryKey } from '@/lib/receivableCategorization';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';

interface ReceivablesProps { schoolId: string; selectedMonth: string; }
function formatCurrency(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(d: string) { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }

export function Receivables({ schoolId, selectedMonth }: ReceivablesProps) {
  const { entries: allEntries } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  // Usa dataProjetada (prazo aplicado) para filtro de período — consistente com Dashboard/Fluxo
  const entries = useMemo(() =>
    allEntries.filter(e => matchesMonthFilter(e.dataProjetada, selectedMonth)),
    [allEntries, selectedMonth]
  );

  // Só receitas — exclui operação e ignorar (essas já saíram no SSOT)
  const recebiveis = useMemo(() =>
    entries.filter(e => getEffectiveClassification(e, classifications) === 'receita'),
    [entries, classifications]
  );

  const grouped = useMemo(() => {
    const map: Record<string, ProjectedEntry[]> = {};
    recebiveis.forEach(e => {
      const t = categorizeReceivable(e);
      if (!map[t]) map[t] = [];
      map[t].push(e);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.dataProjetada.localeCompare(b.dataProjetada)));
    return map;
  }, [recebiveis]);

  const totalGeral = useMemo(() => recebiveis.reduce((s, e) => s + e.valor, 0), [recebiveis]);
  const totalRealizado = useMemo(() =>
    recebiveis.filter(e => e.tipoRegistro === 'realizado').reduce((s, e) => s + e.valor, 0),
    [recebiveis]
  );
  const totalProjetado = useMemo(() =>
    recebiveis.filter(e => e.tipoRegistro === 'projetado').reduce((s, e) => s + e.valor, 0),
    [recebiveis]
  );

  if (recebiveis.length === 0) return (
    <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
      Nenhum recebível encontrado no período.
    </div>
  );

  const sortedEntries = RECEIVABLE_ORDER
    .filter(k => grouped[k])
    .map(k => [k, grouped[k]] as [ReceivableCategoryKey, ProjectedEntry[]]);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Resumo de Recebíveis</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Total</span>
            <p className="text-lg font-display font-bold text-success">{formatCurrency(totalGeral)}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Realizado</span>
            <p className="text-lg font-display font-bold text-blue-600">{formatCurrency(totalRealizado)}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Projetado</span>
            <p className="text-lg font-display font-bold text-amber-600">{formatCurrency(totalProjetado)}</p>
          </div>
        </div>
      </motion.div>

      {sortedEntries.map(([tipo, items], gi) => {
        const config = RECEIVABLE_CONFIG[tipo];
        const total = items.reduce((s, e) => s + e.valor, 0);
        const realized = items.filter(e => e.tipoRegistro === 'realizado').reduce((s, e) => s + e.valor, 0);
        const projected = items.filter(e => e.tipoRegistro === 'projetado').reduce((s, e) => s + e.valor, 0);
        const Icon = config.icon;
        return (
          <motion.div key={tipo} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.08 }} className="glass-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-foreground">{config.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {items.length} recebível(is) • Realizado: {formatCurrency(realized)} • Projetado: {formatCurrency(projected)}
                  </p>
                </div>
              </div>
              <p className="text-lg font-display font-bold text-success">{formatCurrency(total)}</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs"><thead><tr className="bg-surface">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Valor</th>
              </tr></thead>
              <tbody>{items.map(e => (
                <tr key={e.id} className="border-t border-border/30 hover:bg-surface/50">
                  <td className="px-4 py-2 font-medium">{formatDate(e.dataProjetada)}</td>
                  <td className="px-4 py-2 max-w-[250px] truncate text-muted-foreground">{e.descricao}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      e.tipoRegistro === 'realizado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {e.tipoRegistro === 'realizado' ? 'Real.' : 'Proj.'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-success">{formatCurrency(e.valor)}</td>
                </tr>
              ))}</tbody></table>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
