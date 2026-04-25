import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Tags, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EffectiveClassification, OperacaoSinal } from '@/lib/classificationUtils';
import { defaultSinalFor } from '@/lib/classificationUtils';

export interface TipoMappingRow {
  tipoValor: string;        // canonical key (normalized)
  label: string;            // first raw spelling encountered
  count: number;            // occurrences in file
  classificacao: EffectiveClassification;
  operacaoSinal: OperacaoSinal;
  prefilled: boolean;       // pre-loaded from existing config (sugestão apenas)
}

interface Props {
  rows: TipoMappingRow[];
  onChange: (next: TipoMappingRow[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** Opcional — quando fornecido, exibe botão "Salvar como padrão". */
  onSaveAsDefault?: () => void;
}

const CLASS_LABEL: Record<EffectiveClassification, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  operacao: 'Operação',
  ignorar: 'Ignorar',
};

export function TipoMappingStep({ rows, onChange, onConfirm, onCancel, onSaveAsDefault }: Props) {
  const allMapped = rows.every(r => !!r.classificacao);
  const suggestedCount = rows.filter(r => r.prefilled).length;

  function update(i: number, patch: Partial<TipoMappingRow>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    // Auto-suggest sinal when classificacao changes
    if (patch.classificacao && patch.classificacao !== next[i].classificacao) {
      next[i].classificacao = patch.classificacao;
      next[i].operacaoSinal = defaultSinalFor(patch.classificacao);
    }
    onChange(next);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Tags className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-display font-semibold text-foreground">
            Classificação dos tipos
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Defina como cada tipo encontrado neste arquivo deve ser tratado.
            A configuração vale apenas para este upload — você pode classificar o
            mesmo tipo de forma diferente em outros arquivos.
          </p>
          {suggestedCount > 0 && (
            <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {suggestedCount} tipo(s) pré-sugerido(s) a partir do padrão salvo (você pode alterar livremente).
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Tipo no arquivo</th>
              <th className="px-3 py-2 font-medium">Linhas</th>
              <th className="px-3 py-2 font-medium">Classificação</th>
              <th className="px-3 py-2 font-medium">Impacto no caixa</th>
              <th className="px-3 py-2 font-medium">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sinalDisabled = r.classificacao === 'ignorar';
              return (
                <tr key={r.tipoValor} className="border-t border-border/40">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {r.label}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.count}</td>
                  <td className="px-3 py-2">
                    <select
                      value={r.classificacao}
                      onChange={e =>
                        update(i, {
                          classificacao: e.target.value as EffectiveClassification,
                        })
                      }
                      className="h-8 border rounded px-2 bg-background w-full"
                    >
                      <option value="receita">{CLASS_LABEL.receita}</option>
                      <option value="despesa">{CLASS_LABEL.despesa}</option>
                      <option value="operacao">{CLASS_LABEL.operacao}</option>
                      <option value="ignorar">{CLASS_LABEL.ignorar}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.operacaoSinal}
                      disabled={sinalDisabled}
                      onChange={e =>
                        update(i, {
                          operacaoSinal: e.target.value as OperacaoSinal,
                        })
                      }
                      className="h-8 border rounded px-2 bg-background w-full disabled:opacity-50"
                    >
                      <option value="somar">Somar (+)</option>
                      <option value="subtrair">Diminuir (−)</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                        r.prefilled
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {r.prefilled ? 'Sugerido' : 'Novo'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        {onSaveAsDefault && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSaveAsDefault}
            disabled={!allMapped}
            title="Reaproveitar este mapeamento em futuros uploads"
          >
            <Save className="w-4 h-4 mr-1" />
            Salvar como padrão
          </Button>
        )}
        <Button size="sm" onClick={onConfirm} disabled={!allMapped}>
          <ArrowRight className="w-4 h-4 mr-1" />
          Confirmar e visualizar
        </Button>
      </div>
    </motion.div>
  );
}
