import { supabase } from '@/integrations/supabase/client';

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
 * Aplica um modelo financeiro à escola: apenas registra o template escolhido
 * em `schools.financial_model_template_id`. Toda a decisão financeira (entra
 * no resultado / impacta caixa) é lida diretamente dos itens do template —
 * não há mais cópia para `type_classifications` (tabela descontinuada).
 */
export async function applyTemplateToSchool(schoolId: string, templateId: string) {
  const { error } = await supabase
    .from('schools')
    .update({ financial_model_template_id: templateId } as any)
    .eq('id', schoolId);
  if (error) throw error;
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
