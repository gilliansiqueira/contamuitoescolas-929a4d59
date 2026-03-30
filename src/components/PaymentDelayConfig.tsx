import { useState, useMemo } from 'react';
import { DEFAULT_PAYMENT_DELAYS, PaymentDelayRule } from '@/types/financial';
import { getPaymentDelayRules, savePaymentDelayRule, addAuditLog } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface PaymentDelayConfigProps {
  schoolId: string;
  onChanged: () => void;
}

export function PaymentDelayConfig({ schoolId, onChanged }: PaymentDelayConfigProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const savedRules = useMemo(() => getPaymentDelayRules(schoolId), [schoolId, refreshKey]);

  const rules = useMemo(() => {
    return DEFAULT_PAYMENT_DELAYS.map(d => {
      const saved = savedRules.find(r => r.formaCobranca === d.forma);
      return {
        forma: d.forma,
        prazo: saved?.prazo ?? d.prazo,
        id: saved?.id || crypto.randomUUID(),
      };
    });
  }, [savedRules]);

  const [edits, setEdits] = useState<Record<string, number>>({});

  const handleSave = (forma: string, id: string) => {
    const prazo = edits[forma] ?? rules.find(r => r.forma === forma)?.prazo ?? 0;
    if (prazo < 0) { toast.error('Prazo não pode ser negativo'); return; }
    savePaymentDelayRule({ id, school_id: schoolId, formaCobranca: forma, prazo });
    addAuditLog({ id: crypto.randomUUID(), school_id: schoolId, timestamp: new Date().toISOString(), action: 'config', description: `Prazo de ${forma} alterado para ${prazo} dias` });
    setRefreshKey(k => k + 1);
    setEdits(prev => { const n = { ...prev }; delete n[forma]; return n; });
    onChanged();
    toast.success(`Prazo de "${forma}" salvo`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground text-sm">Prazos por Forma de Cobrança</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Defina o prazo (em dias) para cada forma de cobrança. Para Sponte, recebimentos de cartão de crédito serão
        lançados como entrada prevista N dias após a data de vencimento, ajustados para dia útil.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Forma de Cobrança</th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground">Prazo (dias)</th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground">Ação</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => {
            const currentPrazo = edits[r.forma] ?? r.prazo;
            const isDirty = edits[r.forma] !== undefined;
            return (
              <tr key={r.forma} className="border-t border-border/30">
                <td className="px-3 py-2.5 font-medium text-foreground">{r.forma}</td>
                <td className="px-3 py-2.5 text-center">
                  <Input
                    type="number"
                    min={0}
                    value={currentPrazo}
                    onChange={e => setEdits(prev => ({ ...prev, [r.forma]: parseInt(e.target.value) || 0 }))}
                    className="w-20 h-8 text-sm text-center mx-auto"
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Button size="sm" variant={isDirty ? 'default' : 'outline'} disabled={!isDirty} onClick={() => handleSave(r.forma, r.id)}>
                    <Save className="w-3 h-3 mr-1" />
                    Salvar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
}
