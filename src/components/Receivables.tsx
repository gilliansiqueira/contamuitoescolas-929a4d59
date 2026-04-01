import { useMemo } from 'react';
import { useEntriesFromBaseDate, useSchool, useTypeClassifications } from '@/hooks/useFinancialData';
import { FinancialEntry } from '@/types/financial';
import { CreditCard, Smartphone, Landmark, DollarSign, Ban } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { getEffectiveClassification } from '@/lib/classificationUtils';

interface ReceivablesProps { schoolId: string; selectedMonth: string; }
function formatCurrency(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(d: string) { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }

/**
 * Categorize receivable by payment method.
 * Uses origem + categoria + descricao to determine the payment channel.
 * Returns a specific category — NEVER "outros".
 */
function categorizeReceivable(entry: FinancialEntry): string {
  const cat = entry.categoria.toLowerCase();
  const desc = entry.descricao.toLowerCase();

  // Cartão via Maquininha (origem = cartao)
  if (entry.origem === 'cartao') return 'cartao_maquininha';

  // Cartão via Sponte (origem = sponte + categoria mentions cartão)
  if (entry.origem === 'sponte' && (cat.includes('cartao') || cat.includes('cartão') || cat.includes('credito') || cat.includes('crédito'))) return 'cartao_sponte';

  // Cheque
  if (entry.origem === 'cheque' || cat.includes('cheque')) return 'cheque';

  // PIX / Transferência
  if (cat.includes('pix') || desc.includes('pix') || cat.includes('transferencia') || cat.includes('transferência')) return 'pix';

  // Boleto / Cobrança
  if (cat.includes('boleto') || cat.includes('cobranca') || cat.includes('cobrança') || cat.includes('mensalidade') || cat.includes('bancaria') || cat.includes('bancária')) return 'boleto';

  // Cartão genérico
  if (cat.includes('cartao') || cat.includes('cartão') || desc.includes('cartão')) return 'cartao_maquininha';

  // For Sponte entries without specific category, default to boleto
  if (entry.origem === 'sponte') return 'boleto';

  // Unclassified — show as the actual category name so nothing goes to "outros"
  return 'sem_categoria';
}

const typeConfig: Record<string, { label: string; icon: typeof CreditCard }> = {
  cartao_maquininha: { label: 'Cartão (Maquininha)', icon: CreditCard },
  cartao_sponte: { label: 'Cartão (Sponte)', icon: CreditCard },
  pix: { label: 'PIX / Transferência', icon: Smartphone },
  boleto: { label: 'Boleto / Cobrança', icon: Landmark },
  cheque: { label: 'Cheque', icon: DollarSign },
  sem_categoria: { label: 'Sem Categoria Definida', icon: Ban },
};

export function Receivables({ schoolId, selectedMonth }: ReceivablesProps) {
  const { data: school } = useSchool(schoolId);
  const { data: allEntries = [] } = useEntriesFromBaseDate(schoolId, school?.saldoInicialData);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  const entries = useMemo(() =>
    allEntries.filter(e => matchesMonthFilter(e.data, selectedMonth)),
    [allEntries, selectedMonth]
  );

  // Only include entries classified as 'receita' — exclude operacao and ignorar
  const recebiveis = useMemo(() =>
    entries.filter(e => {
      if (e.tipoRegistro !== 'projetado') return false;
      const cls = getEffectiveClassification(e, classifications);
      return cls === 'receita';
    }),
    [entries, classifications]
  );

  const grouped = useMemo(() => {
    const map: Record<string, FinancialEntry[]> = {};
    recebiveis.forEach(e => {
      const t = categorizeReceivable(e);
      if (!map[t]) map[t] = [];
      map[t].push(e);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.data.localeCompare(b.data)));
    return map;
  }, [recebiveis]);

  const totalGeral = useMemo(() => recebiveis.reduce((s, e) => s + e.valor, 0), [recebiveis]);

  // Split by realized vs projected
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

  // Fixed order
  const orderedKeys = ['cartao_maquininha', 'cartao_sponte', 'pix', 'boleto', 'cheque', 'sem_categoria'];
  const sortedEntries = orderedKeys
    .filter(k => grouped[k])
    .map(k => [k, grouped[k]] as [string, FinancialEntry[]]);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Resumo de Recebíveis</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Total</span>
            <p className="text-lg font-display font-bold text-primary">{formatCurrency(totalGeral)}</p>
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

      {/* By category */}
      {sortedEntries.map(([tipo, items], gi) => {
        const config = typeConfig[tipo] || typeConfig.sem_categoria;
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
              <p className="text-lg font-display font-bold text-primary">{formatCurrency(total)}</p>
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
                  <td className="px-4 py-2 font-medium">{formatDate(e.data)}</td>
                  <td className="px-4 py-2 max-w-[250px] truncate text-muted-foreground">{e.descricao}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      e.tipoRegistro === 'realizado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {e.tipoRegistro === 'realizado' ? 'Real.' : 'Proj.'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-primary">{formatCurrency(e.valor)}</td>
                </tr>
              ))}</tbody></table>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
