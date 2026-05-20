import { supabase } from '@/integrations/supabase/client';
import { normalizeTipo } from '@/lib/classificationUtils';

export interface FinancialModelTemplate {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
}

export interface FinancialModelTemplateItem {
  id: string;
  template_id: string;
  name: string;
  tipo: 'entrada' | 'saida' | 'ignorar';
  impacta_caixa: boolean;
  entra_no_resultado: boolean;
  sort_order: number;
}

/**
 * Aplica um modelo financeiro à escola: copia todos os itens do template
 * para `type_classifications` da escola via upsert (não apaga o que já existe).
 * Também grava o template escolhido em `schools.financial_model_template_id`.
 */
export async function applyTemplateToSchool(schoolId: string, templateId: string) {
  const { data: items, error } = await supabase
    .from('financial_model_template_items' as any)
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');
  if (error) throw error;

  for (const it of (items ?? []) as any[]) {
    const tipoValor = normalizeTipo(it.name);
    const isIgnorar = it.tipo === 'ignorar';
    const impactaCaixa = isIgnorar ? false : it.impacta_caixa;
    const entraNoResultado = isIgnorar ? false : it.entra_no_resultado;
    const classificacao =
      isIgnorar                                          ? 'ignorar' :
      entraNoResultado && it.tipo === 'entrada'          ? 'receita' :
      entraNoResultado && it.tipo === 'saida'            ? 'despesa' :
      impactaCaixa                                       ? 'operacao' :
                                                           'ignorar';
    const operacao_sinal = it.tipo === 'saida' ? 'subtrair' : 'somar';

    // procura existente por (school_id, tipo_valor)
    const { data: existing } = await supabase
      .from('type_classifications')
      .select('id')
      .eq('school_id', schoolId)
      .eq('tipo_valor', tipoValor)
      .maybeSingle();

    const payload = {
      school_id: schoolId,
      tipo_valor: tipoValor,
      label: it.name,
      classificacao,
      entra_no_resultado: entraNoResultado,
      impacta_caixa: impactaCaixa,
      operacao_sinal,
    };

    if (existing?.id) {
      await supabase.from('type_classifications').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('type_classifications').insert(payload as any);
    }
  }

  // grava o template no school
  await supabase.from('schools').update({ financial_model_template_id: templateId } as any).eq('id', schoolId);
}

export async function fetchTemplates(): Promise<FinancialModelTemplate[]> {
  const { data, error } = await supabase
    .from('financial_model_templates' as any)
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as any;
}

export async function fetchTemplateItems(templateId: string): Promise<FinancialModelTemplateItem[]> {
  const { data, error } = await supabase
    .from('financial_model_template_items' as any)
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as any;
}

export async function fetchSchoolTemplateId(schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('schools')
    .select('financial_model_template_id' as any)
    .eq('id', schoolId)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.financial_model_template_id ?? null;
}
