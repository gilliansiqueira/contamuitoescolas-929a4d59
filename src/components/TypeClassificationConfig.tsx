import { useState, useMemo } from 'react';
import { TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { getFluxoTipos, getTypeClassifications, saveTypeClassification } from '@/lib/storage';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';
import { Settings2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface TypeClassificationConfigProps {
  schoolId: string;
  onChanged: () => void;
}

export function TypeClassificationConfig({ schoolId, onChanged }: TypeClassificationConfigProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const allTipos = useMemo(() => getFluxoTipos(schoolId), [schoolId, refreshKey]);
  const classifications = useMemo(() => getTypeClassifications(schoolId), [schoolId, refreshKey]);

  const getClassification = (tipo: string): TypeClassification => {
    const existing = classifications.find(c => c.tipoValor === tipo);
    if (existing) return existing;
    // Defaults: receita/despesa/entrada/saida always in resultado
    const isFixed = FIXED_RESULT_TYPES.includes(tipo.toLowerCase());
    const isEntradaSaida = ['entrada', 'saida'].includes(tipo.toLowerCase());
    return {
      id: crypto.randomUUID(),
      school_id: schoolId,
      tipoValor: tipo,
      entraNoResultado: isFixed || isEntradaSaida,
      impactaCaixa: true,
      label: tipo,
    };
  };

  const handleToggle = (tipo: string, field: 'entraNoResultado' | 'impactaCaixa', value: boolean) => {
    const isFixed = FIXED_RESULT_TYPES.includes(tipo.toLowerCase());
    if (isFixed && field === 'entraNoResultado') {
      toast.error(`"${tipo}" é fixo e sempre entra no resultado`);
      return;
    }
    const current = getClassification(tipo);
    const updated = { ...current, [field]: value };
    saveTypeClassification(updated);
    setRefreshKey(k => k + 1);
    onChanged();
    toast.success(`Classificação de "${tipo}" atualizada`);
  };

  if (allTipos.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        <Settings2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
        Nenhum tipo encontrado. Importe dados de "Fluxo de Caixa Realizado" para configurar.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">Classificação de Tipos</h3>
        </div>
        <div className="flex items-start gap-2 mb-4 bg-muted/30 rounded-lg p-3">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Configure como cada tipo do fluxo de caixa realizado é tratado.
            <strong> "receita"</strong> e <strong>"despesa"</strong> são fixos e sempre entram no resultado.
            Demais tipos podem ser configurados livremente.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Entra no Resultado</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Impacta Caixa</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Classificação</th>
              </tr>
            </thead>
            <tbody>
              {allTipos.map(tipo => {
                const cls = getClassification(tipo);
                const isFixed = FIXED_RESULT_TYPES.includes(tipo.toLowerCase());
                const classification = cls.entraNoResultado
                  ? (cls.impactaCaixa ? '📊 Resultado + Caixa' : '📊 Resultado')
                  : (cls.impactaCaixa ? '🔁 Operação (só caixa)' : '⚪ Sem impacto');

                return (
                  <tr key={tipo} className="border-t border-border/30">
                    <td className="px-3 py-2.5">
                      <span className={`font-medium ${isFixed ? 'text-primary' : 'text-foreground'}`}>
                        {tipo}
                      </span>
                      {isFixed && (
                        <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                          Fixo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Switch
                        checked={cls.entraNoResultado}
                        onCheckedChange={(v) => handleToggle(tipo, 'entraNoResultado', v)}
                        disabled={isFixed}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Switch
                        checked={cls.impactaCaixa}
                        onCheckedChange={(v) => handleToggle(tipo, 'impactaCaixa', v)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {classification}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
