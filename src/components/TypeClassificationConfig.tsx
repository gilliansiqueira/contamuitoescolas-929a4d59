import { useState } from 'react';
import { TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { useFluxoTipos, useTypeClassifications, useSaveTypeClassification } from '@/hooks/useFinancialData';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';
import { Settings2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface TypeClassificationConfigProps {
  schoolId: string;
  onChanged: () => void;
}

type ClassificacaoType = 'receita' | 'despesa' | 'operacao' | 'ignorar';

export function TypeClassificationConfig({ schoolId, onChanged }: TypeClassificationConfigProps) {
  const { data: allTipos = [] } = useFluxoTipos(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const saveMut = useSaveTypeClassification();

  const getClassification = (tipo: string): TypeClassification => {
    const existing = classifications.find(c => c.tipoValor === tipo);
    if (existing) return existing;
    const isFixed = FIXED_RESULT_TYPES.includes(tipo.toLowerCase());
    const isEntradaSaida = ['entrada', 'saida'].includes(tipo.toLowerCase());
    return {
      id: crypto.randomUUID(),
      school_id: schoolId,
      tipoValor: tipo,
      entraNoResultado: isFixed || isEntradaSaida,
      impactaCaixa: true,
      classificacao: isFixed || isEntradaSaida ? (tipo.toLowerCase() === 'despesa' || tipo.toLowerCase() === 'saida' ? 'despesa' : 'receita') : 'operacao',
      label: tipo,
    };
  };

  const handleClassificacaoChange = async (tipo: string, classificacao: ClassificacaoType) => {
    const isFixed = FIXED_RESULT_TYPES.includes(tipo.toLowerCase());
    if (isFixed) {
      toast.error(`"${tipo}" é fixo e não pode ser alterado`);
      return;
    }
    const current = getClassification(tipo);
    const updated: TypeClassification = {
      ...current,
      classificacao,
      entraNoResultado: classificacao === 'receita' || classificacao === 'despesa',
      impactaCaixa: classificacao !== 'ignorar',
    };
    try {
      await saveMut.mutateAsync(updated);
      onChanged();
      toast.success(`Classificação de "${tipo}" atualizada`);
    } catch {
      toast.error('Erro ao salvar classificação');
    }
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
            <strong> "receita"</strong> e <strong>"despesa"</strong> são fixos.
            Demais tipos podem ser: <strong>Receita</strong>, <strong>Despesa</strong>, <strong>Operação</strong> ou <strong>Ignorar</strong>.
            Tipos marcados como "Ignorar" não aparecem em nenhum cálculo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Classificação</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Efeito</th>
              </tr>
            </thead>
            <tbody>
              {allTipos.map(tipo => {
                const cls = getClassification(tipo);
                const isFixed = FIXED_RESULT_TYPES.includes(tipo.toLowerCase());

                const effectLabel = {
                  receita: '📊 Entra no resultado como receita',
                  despesa: '📊 Entra no resultado como despesa',
                  operacao: '🔁 Impacta caixa, não entra no resultado',
                  ignorar: '⚪ Ignorado completamente',
                }[cls.classificacao];

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
                      <select
                        value={cls.classificacao}
                        onChange={e => handleClassificacaoChange(tipo, e.target.value as ClassificacaoType)}
                        disabled={isFixed}
                        className="h-8 text-xs border rounded px-2 bg-background disabled:opacity-50"
                      >
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                        <option value="operacao">Operação</option>
                        <option value="ignorar">Ignorar</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {effectLabel}
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
