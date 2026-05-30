/**
 * Hook que carrega os itens do Modelo Financeiro ativo de uma escola
 * e expõe helpers para validar se um rótulo de tipo/categoria pertence
 * ao modelo.
 *
 * Regra de uso (decisão de produto):
 *  - Se a escola TEM um modelo financeiro atribuído → `isInModel` valida
 *    estritamente: tipos que não existem no modelo NÃO devem participar
 *    de cálculos (Dashboard, Histórico, Projeção, Fluxo, Relatórios).
 *  - Se a escola NÃO tem modelo atribuído → `hasModel=false` e `isInModel`
 *    aceita tudo (fail-open), mantendo o comportamento atual.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchSchoolTemplateId, fetchTemplateItems, type FinancialModelTemplateItem } from '@/lib/financialModels';
import { normalizeTipo } from '@/lib/classificationUtils';
import { useTypeClassifications } from '@/hooks/useFinancialData';

export interface SchoolModel {
  hasModel: boolean;
  items: FinancialModelTemplateItem[];
  validKeys: Set<string>;
  isInModel: (label: string) => boolean;
}

export function useSchoolModel(schoolId: string): SchoolModel {
  const { data } = useQuery({
    queryKey: ['school-model-items', schoolId],
    queryFn: async () => {
      const tplId = await fetchSchoolTemplateId(schoolId);
      if (!tplId) return { tplId: null as string | null, items: [] as FinancialModelTemplateItem[] };
      const items = await fetchTemplateItems(tplId);
      return { tplId, items };
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  const { data: classifications = [] } = useTypeClassifications(schoolId);

  return useMemo<SchoolModel>(() => {
    const items = data?.items ?? [];
    const hasModel = !!data?.tplId && items.length > 0;
    const validKeys = new Set([
      ...items.map(i => normalizeTipo(i.name)),
      ...classifications
        .filter(c => c.classificacao !== 'ignorar')
        .map(c => normalizeTipo(c.tipoValor))
    ]);

    const isInModel = (label: string) => {
      if (!hasModel) return true; // fail-open quando a escola não tem modelo
      if (!label) return false;
      return validKeys.has(normalizeTipo(label));
    };
    return { hasModel, items, validKeys, isInModel };
  }, [data, classifications]);
}
