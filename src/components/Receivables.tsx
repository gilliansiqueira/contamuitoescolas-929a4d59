import { useMemo } from 'react';
import { getEntries } from '@/lib/storage';
import { FinancialEntry } from '@/types/financial';
import { CreditCard, Smartphone, Landmark, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReceivablesProps {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function categorize(entry: FinancialEntry): string {
  const cat = entry.categoria.toLowerCase();
  const desc = entry.descricao.toLowerCase();
  if (cat.includes('cartao') || cat.includes('cartão') || desc.includes('cartão') || desc.includes('cartao') || entry.origem === 'cartao') return 'cartao';
  if (cat.includes('pix') || desc.includes('pix')) return 'pix';
  if (cat.includes('boleto') || desc.includes('boleto') || cat.includes('mensalidade')) return 'boleto';
  if (cat.includes('cheque') || entry.origem === 'cheque') return 'cheque';
  return 'outros';
}

const typeConfig: Record<string, { label: string; icon: typeof CreditCard }> = {
  cartao: { label: 'Cartão', icon: CreditCard },
  pix: { label: 'PIX', icon: Smartphone },
  boleto: { label: 'Boleto', icon: Landmark },
  cheque: { label: 'Cheque', icon: DollarSign },
  outros: { label: 'Outros', icon: DollarSign },
};

export function Receivables({ schoolId }: ReceivablesProps) {
  const entries = useMemo(() => getEntries(schoolId), [schoolId]);
  const entradas = entries.filter(e => e.tipo === 'entrada');

  const grouped = useMemo(() => {
    const map: Record<string, FinancialEntry[]> = {};
    entradas.forEach(e => {
      const t = categorize(e);
      if (!map[t]) map[t] = [];
      map[t].push(e);
    });
    // Sort each group by date
    Object.values(map).forEach(arr => arr.sort((a, b) => a.data.localeCompare(b.data)));
    return map;
  }, [entradas]);

  if (entradas.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Nenhum recebível encontrado. Importe dados para visualizar.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([tipo, items], gi) => {
        const config = typeConfig[tipo] || typeConfig.outros;
        const total = items.reduce((s, e) => s + e.valor, 0);
        const Icon = config.icon;

        return (
          <motion.div
            key={tipo}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.08 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-foreground">{config.label}</h3>
                  <p className="text-xs text-muted-foreground">{items.length} recebível(is)</p>
                </div>
              </div>
              <p className="text-lg font-display font-bold text-primary">{formatCurrency(total)}</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(e => (
                    <tr key={e.id} className="border-t border-border/30 hover:bg-surface/50">
                      <td className="px-4 py-2 font-medium">{formatDate(e.data)}</td>
                      <td className="px-4 py-2 max-w-[250px] truncate text-muted-foreground">{e.descricao}</td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">{formatCurrency(e.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
