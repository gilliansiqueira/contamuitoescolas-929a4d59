/**
 * Fonte única de verdade para metadados de um "tipo" (rótulo) vindo de
 * qualquer origem (uploads, histórico mensal, snapshots).
 *
 * Regras (alinhadas com classificationUtils.ts):
 *   1) Sem heurística por nome — a configuração do usuário em
 *      `type_classifications` é a única fonte.
 *   2) Se a configuração marcar como 'ignorar', NÃO impacta nada.
 *   3) Sem configuração:
 *        - classificação = 'operacao'
 *        - sinal = 'somar'
 *        - entraNoResultado = false
 *        - impactaCaixa = false  ← (o gate do modelo financeiro
 *          filtra tipos órfãos antes disso; aqui só blindamos)
 *
 * Esta função substitui as antigas `resolveTipoMeta` (Dashboard)
 * e `resolveHistTipo` (snapshotUtils), eliminando duplicidade e
 * divergência entre telas.
 */
import type { TypeClassification } from '@/types/financial';
import { getCanonicalKey, normalizeTipo, defaultSinalFor } from '@/lib/classificationUtils';

export type Classificacao = 'receita' | 'despesa' | 'operacao' | 'ignorar';
export type Sinal = 'somar' | 'subtrair';

export interface TipoMeta {
  classificacao: Classificacao;
  sinal: Sinal;
  entraNoResultado: boolean;
  impactaCaixa: boolean;
  /** Conveniência: equivalente a sinal === 'somar'. */
  isEntrada: boolean;
  label: string;
  canonicalKey: string;
}

export function resolveTipoMeta(
  tipoKey: string,
  classifications: TypeClassification[]
): TipoMeta {
  const key = normalizeTipo(tipoKey);
  const canonicalKey = getCanonicalKey(tipoKey);
  const cfg = classifications.find(c => normalizeTipo(c.tipoValor) === key);

  if (cfg) {
    const cls = cfg.classificacao as Classificacao;

    if (cls === 'ignorar') {
      return {
        classificacao: 'ignorar',
        sinal: 'somar',
        entraNoResultado: false,
        impactaCaixa: false,
        isEntrada: false,
        label: cfg.label || tipoKey,
        canonicalKey,
      };
    }

    const raw = cfg.operacaoSinal;
    const sinal: Sinal =
      raw === 'somar' || raw === 'subtrair' ? raw : defaultSinalFor(cls);

    return {
      classificacao: cls,
      sinal,
      entraNoResultado: cls === 'receita' || cls === 'despesa',
      impactaCaixa: true,
      isEntrada: sinal === 'somar',
      label: cfg.label || tipoKey,
      canonicalKey,
    };
  }

  // Sem configuração do usuário: NÃO impacta nada.
  // O gate do modelo financeiro já filtra órfãos antes disso —
  // este é apenas um fallback defensivo, sem heurística por nome.
  return {
    classificacao: 'operacao',
    sinal: 'somar',
    entraNoResultado: false,
    impactaCaixa: false,
    isEntrada: false,
    label: tipoKey,
    canonicalKey,
  };
}
