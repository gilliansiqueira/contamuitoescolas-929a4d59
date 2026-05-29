/**
 * Validação estrita de tipos/categorias contra o Modelo Financeiro da escola.
 *
 * Garante que qualquer rótulo trazido por upload (Projeção ou Realizado) só seja
 * aceito quando corresponder exatamente (após normalização) a um item do modelo
 * financeiro da escola. Variações como "Receita Real" ou "Saída" — que não
 * existem no modelo — são consideradas desconhecidas e precisam passar pela
 * tela de mapeamento obrigatório.
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizeTipo } from '@/lib/classificationUtils';
import {
  fetchSchoolTemplateId,
  fetchTemplateItems,
  type FinancialModelTemplateItem,
} from '@/lib/financialModels';

export interface ModelValidationResult {
  modelItems: FinancialModelTemplateItem[];
  validKeys: Set<string>;
  unknownLabels: string[];
  isKnown: (label: string) => boolean;
  suggestItem: (label: string) => FinancialModelTemplateItem | null;
}

/** Carrega os itens do modelo financeiro de uma escola (deduplicados, sem "ignorar"). */
export async function loadSchoolModelItems(schoolId: string): Promise<FinancialModelTemplateItem[]> {
  const templateId = await fetchSchoolTemplateId(schoolId);
  if (!templateId) return [];
  const items = await fetchTemplateItems(templateId);
  const seen = new Set<string>();
  const out: FinancialModelTemplateItem[] = [];
  for (const it of items) {
    if (it.tipo === 'ignorar') continue;
    const key = normalizeTipo(it.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** Constrói um validador a partir de uma lista de itens do modelo. */
export function buildModelValidator(
  modelItems: FinancialModelTemplateItem[],
  labels: string[] = [],
): ModelValidationResult {
  const validKeys = new Set(modelItems.map(i => normalizeTipo(i.name)));
  const byKey = new Map(modelItems.map(i => [normalizeTipo(i.name), i]));

  const isKnown = (label: string) => validKeys.has(normalizeTipo(label));

  const suggestItem = (label: string): FinancialModelTemplateItem | null => {
    const norm = normalizeTipo(label);
    if (byKey.has(norm)) return byKey.get(norm) ?? null;
    // Fallback heurístico: matching parcial (substring).
    for (const [k, v] of byKey.entries()) {
      if (k.includes(norm) || norm.includes(k)) return v;
    }
    return null;
  };

  const seen = new Set<string>();
  const unknownLabels: string[] = [];
  for (const l of labels) {
    const k = normalizeTipo(l);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (!validKeys.has(k)) unknownLabels.push(l);
  }

  return { modelItems, validKeys, unknownLabels, isKnown, suggestItem };
}

/** Persiste uma regra de mapeamento (source → categoria do modelo) para reuso. */
export async function persistModelMappingRule(args: {
  schoolId: string;
  sourceText: string;
  targetCategoria: string;
  matchField?: 'categoria' | 'descricao';
}) {
  const { schoolId, sourceText, targetCategoria, matchField = 'categoria' } = args;
  const source_normalized = normalizeTipo(sourceText);
  await supabase.from('category_rules').upsert(
    {
      school_id: schoolId,
      source_text: sourceText,
      source_normalized,
      target_categoria: targetCategoria,
      match_field: matchField,
    },
    { onConflict: 'school_id,source_normalized,match_field' },
  );
}
