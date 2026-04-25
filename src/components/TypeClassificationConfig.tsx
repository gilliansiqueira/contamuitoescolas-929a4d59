import { TypeClassification } from '@/types/financial';
import { useFluxoTipos, useTypeClassifications, useSaveTypeClassification } from '@/hooks/useFinancialData';
import { motion } from 'framer-motion';
import { Settings2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeTipo, defaultSinalFor, type OperacaoSinal } from '@/lib/classificationUtils';

interface TypeClassificationConfigProps {
  schoolId: string;
  onChanged: () => void;
}

type ClassificacaoType = 'receita' | 'despesa' | 'operacao' | 'ignorar';

const normalize = normalizeTipo;

export function TypeClassificationConfig({ schoolId, onChanged }: TypeClassificationConfigProps) {
  const { data: allTipos = [] } = useFluxoTipos(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const saveMut = useSaveTypeClassification();

  const getClassification = (tipo: string): TypeClassification => {
    const existing = classifications.find(c => normalize(c.tipoValor) === normalize(tipo));
    if (existing) {
      // Resolve sinal legado 'auto' para o default da classificação na exibição.
      const sinal: OperacaoSinal =
        existing.operacaoSinal === 'subtrair' ? 'subtrair' :
        existing.operacaoSinal === 'somar' ? 'somar' :
        defaultSinalFor(existing.classificacao as ClassificacaoType);
      return { ...existing, operacaoSinal: sinal };
    }
    // Default para tipo não configurado: operação + somar.
    // O usuário decide explicitamente — sem heurística por nome.
    return {
      id: crypto.randomUUID(),
      school_id: schoolId,
      tipoValor: normalize(tipo),
      entraNoResultado: false,
      impactaCaixa: true,
      classificacao: 'operacao',
      operacaoSinal: 'somar',
      label: tipo,
    };
  };

  const handleClassificacaoChange = async (tipo: string, classificacao: ClassificacaoType) => {
    const current = getClassification(tipo);
    const updated: TypeClassification = {
      ...current,
      tipoValor: normalize(tipo),
      classificacao,
      entraNoResultado: classificacao === 'receita' || classificacao === 'despesa',
      impactaCaixa: classificacao !== 'ignorar',
      // Sugestão automática por classificação. Usuário pode alterar depois para Operação.
      operacaoSinal: classificacao === 'ignorar' ? 'somar' : defaultSinalFor(classificacao),
    };
    try {
      await saveMut.mutateAsync(updated);
      onChanged();
      toast.success(`Classificação de "${tipo}" atualizada`);
    } catch {
      toast.error('Erro ao salvar classificação');
    }
  };

  const handleSinalChange = async (tipo: string, sinal: OperacaoSinal) => {
    const current = getClassification(tipo);
    if (current.classificacao === 'ignorar') return;
    const updated: TypeClassification = { ...current, operacaoSinal: sinal };
    try {
      await saveMut.mutateAsync(updated);
      onChanged();
      toast.success(`Sinal de "${tipo}" definido como ${sinal === 'somar' ? 'Somar (+)' : 'Subtrair (−)'}`);
    } catch {
      toast.error('Erro ao salvar sinal');
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
            Para cada tipo, escolha a <strong>Classificação</strong> e o <strong>Sinal no caixa</strong>.
            <br />
            • <strong>Receita</strong>/<strong>Despesa</strong>: entram no resultado e impactam o saldo conforme o sinal.
            <br />
            • <strong>Operação</strong>: NÃO entra no resultado, mas impacta o saldo conforme o sinal.
            <br />
            • <strong>Ignorar</strong>: não entra em cálculos, gráficos nem saldo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Classificação</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Sinal no caixa</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Efeito</th>
              </tr>
            </thead>
            <tbody>
              {allTipos.map(tipo => {
                const cls = getClassification(tipo);
                const isIgnorar = cls.classificacao === 'ignorar';
                const sinalLabel = cls.operacaoSinal === 'somar' ? 'Somar (+)' : 'Subtrair (−)';

                const effectLabel = {
                  receita: `📊 Entra no resultado como receita · saldo: ${sinalLabel}`,
                  despesa: `📊 Entra no resultado como despesa · saldo: ${sinalLabel}`,
                  operacao: `🔁 Não entra no resultado · saldo: ${sinalLabel}`,
                  ignorar: '⚪ Ignorado completamente',
                }[cls.classificacao];

                return (
                  <tr key={tipo} className="border-t border-border/30">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground">{tipo}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={cls.classificacao}
                        onChange={e => handleClassificacaoChange(tipo, e.target.value as ClassificacaoType)}
                        className="h-8 text-xs border rounded px-2 bg-background"
                      >
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                        <option value="operacao">Operação</option>
                        <option value="ignorar">Ignorar</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isIgnorar ? (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      ) : (
                        <select
                          value={cls.operacaoSinal === 'subtrair' ? 'subtrair' : 'somar'}
                          onChange={e => handleSinalChange(tipo, e.target.value as OperacaoSinal)}
                          className="h-8 text-xs border rounded px-2 bg-background"
                          title="Define como esse tipo afeta o saldo final"
                        >
                          <option value="somar">Somar (+)</option>
                          <option value="subtrair">Subtrair (−)</option>
                        </select>
                      )}
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
