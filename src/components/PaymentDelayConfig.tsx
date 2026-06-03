import { useState, useMemo } from 'react';
import { DEFAULT_PAYMENT_DELAYS, PaymentDelayRule } from '@/types/financial';
import { usePaymentDelayRules, useSavePaymentDelayRule, useAddAuditLog, useEntries } from '@/hooks/useFinancialData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { normalizeTipo } from '@/lib/ledgerEngine';

interface PaymentDelayConfigProps {
  schoolId: string;
  onChanged: () => void;
}

export function PaymentDelayConfig({ schoolId, onChanged }: PaymentDelayConfigProps) {
  const { data: savedRules = [], isLoading } = usePaymentDelayRules(schoolId);
  const { data: entries = [] } = useEntries(schoolId);
  const saveRule = useSavePaymentDelayRule();
  const addAuditLog = useAddAuditLog();
  const [edits, setEdits] = useState<Record<string, number>>({});

  const rules = useMemo(() => {
    // Coleta formas de cobrança reais a partir dos uploads Sponte da escola.
    const sponteFormasMap = new Map<string, string>(); // normalizada → label original
    for (const e of entries) {
      if (e.origem !== 'sponte') continue;
      const forma = (e.categoria || '').trim();
      if (!forma) continue;
      const k = normalizeTipo(forma);
      if (!sponteFormasMap.has(k)) sponteFormasMap.set(k, forma);
    }

    // Une defaults + formas vindas do Sponte + regras já salvas (sem duplicar).
    const byKey = new Map<string, { forma: string; prazo: number; id: string }>();
    const addForma = (forma: string, defaultPrazo: number) => {
      const k = normalizeTipo(forma);
      if (byKey.has(k)) return;
      const saved = savedRules.find(r => normalizeTipo(r.formaCobranca) === k);
      byKey.set(k, {
        forma: saved?.formaCobranca || forma,
        prazo: saved?.prazo ?? defaultPrazo,
        id: saved?.id || crypto.randomUUID(),
      });
    };

    DEFAULT_PAYMENT_DELAYS.forEach(d => addForma(d.forma, d.prazo));
    sponteFormasMap.forEach(label => addForma(label, 0));
    savedRules.forEach(r => addForma(r.formaCobranca, r.prazo));

    return Array.from(byKey.values()).sort((a, b) => a.forma.localeCompare(b.forma, 'pt-BR'));
  }, [savedRules, entries]);

  const handleSave = async (forma: string, id: string) => {
    const prazo = edits[forma] ?? rules.find(r => r.forma === forma)?.prazo ?? 0;
    if (prazo < 0) { toast.error('Prazo não pode ser negativo'); return; }
    try {
      await saveRule.mutateAsync({ id, school_id: schoolId, formaCobranca: forma, prazo });
      await addAuditLog.mutateAsync({
        school_id: schoolId,
        action: 'config',
        description: `Prazo de ${forma} alterado para ${prazo} dias`,
      });
      setEdits(prev => { const n = { ...prev }; delete n[forma]; return n; });
      onChanged();
      toast.success(`Prazo de "${forma}" salvo`);
    } catch {
      toast.error('Erro ao salvar prazo');
    }
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
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : (
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
                    <Button
                      size="sm"
                      variant={isDirty ? 'default' : 'outline'}
                      disabled={!isDirty || saveRule.isPending}
                      onClick={() => handleSave(r.forma, r.id)}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </motion.div>
  );
}
