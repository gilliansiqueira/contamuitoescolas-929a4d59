import { useState } from 'react';
import { TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { useFluxoTipos, useTypeClassifications, useSaveTypeClassification } from '@/hooks/useFinancialData';
import { motion } from 'framer-motion';
import { Settings2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeTipo } from '@/lib/classificationUtils';

interface TypeClassificationConfigProps {
  schoolId: string;
  onChanged: () => void;
}

type ClassificacaoType = 'receita' | 'despesa' | 'operacao' | 'ignorar';

// Usa a função canônica do sistema (lowercase + trim + remove acentos).
const normalize = normalizeTipo;

export function TypeClassificationConfig({ schoolId, onChanged }: TypeClassificationConfigProps) {
  const { data: allTipos = [] } = useFluxoTipos(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const saveMut = useSaveTypeClassification();

  const getClassification = (tipo: string): TypeClassification => {
    const existing = classifications.find(c => normalize(c.tipoValor) === normalize(tipo));
    if (existing) return existing;
    const isFixed = FIXED_RESULT_TYPES.includes(normalize(tipo));
    const isEntradaSaida = ['entrada', 'saida'].includes(normalize(tipo));
    return {
      id: crypto.randomUUID(),
      school_id: schoolId,
      tipoValor: normalize(tipo),
      entraNoResultado: isFixed || isEntradaSaida,
      impactaCaixa: true,
      classificacao: isFixed || isEntradaSaida
        ? (normalize(tipo) === 'despesa' || normalize(tipo) === 'saida' ? 'despesa' : 'receita')
        : 'operacao',
      operacaoSinal: 'auto',
      label: tipo,
    };
  };

  const handleClassificacaoChange = async (tipo: string, classificacao: ClassificacaoType) => {
    const isFixed = FIXED_RESULT_TYPES.includes(normalize(tipo));
    if (isFixed) {
      toast.error(`"${tipo}" é fixo e não pode ser alterado`);
      return;
    }
    const current = getClassification(tipo);
    const updated: TypeClassification = {
      ...current,
      tipoValor: normalize(tipo),
      classificacao,
      entraNoResultado: classificacao === 'receita' || classificacao === 'despesa',
      impactaCaixa: classificacao !== 'ignorar',
      operacaoSinal: classificacao === 'operacao' ? (current.operacaoSinal || 'auto') : 'auto',
    };
    try {
      await saveMut.mutateAsync(updated);
      onChanged();
      toast.success(`Classificação de "${tipo}" atualizada`);
    } catch {
      toast.error('Erro ao salvar classificação');
    }
  };

  const handleSinalChange = async (tipo: string, sinal: 'auto' | 'somar' | 'subtrair') => {
    const current = getClassification(tipo);
    if (current.classificacao !== 'operacao') return;
    const updated: TypeClassification = { ...current, operacaoSinal: sinal };
    try {
      await saveMut.mutateAsync(updated);
      onChanged();
      toast.success(`Sinal de "${tipo}" definido como ${sinal}`);
    } catch {
      toast.error('Erro ao salvar sinal da operação');
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
            Demais tipos podem ser: <strong>Receita</strong>, <strong>Despesa</strong>, <strong>Operação</strong> ou <strong>Ignorar</strong>.
            Quando for <strong>Operação</strong>, escolha o <strong>Sinal no caixa</strong>:
            <em> Auto</em> (segue entrada/saída do lançamento), <em>Somar</em> (sempre entra) ou <em>Subtrair</em> (sempre sai).
            Tipos marcados como "Ignorar" não aparecem em nenhum cálculo.
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
                const isFixed = FIXED_RESULT_TYPES.includes(normalize(tipo));
                const isOperacao = cls.classificacao === 'operacao';

                const sinalLabel =
                  cls.operacaoSinal === 'somar' ? ' (somando)' :
                  cls.operacaoSinal === 'subtrair' ? ' (subtraindo)' :
                  ' (auto: entrada/saída do lançamento)';

                const effectLabel = {
                  receita: '📊 Entra no resultado como receita',
                  despesa: '📊 Entra no resultado como despesa',
                  operacao: `🔁 Impacta caixa${sinalLabel}, não entra no resultado`,
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
                    <td className="px-3 py-2.5 text-center">
                      {isOperacao ? (
                        <select
                          value={cls.operacaoSinal}
                          onChange={e => handleSinalChange(tipo, e.target.value as 'auto' | 'somar' | 'subtrair')}
                          className="h-8 text-xs border rounded px-2 bg-background"
                          title="Define como esse tipo afeta o saldo final"
                        >
                          <option value="auto">Auto (entrada/saída)</option>
                          <option value="somar">Sempre somar (+)</option>
                          <option value="subtrair">Sempre subtrair (−)</option>
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
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
