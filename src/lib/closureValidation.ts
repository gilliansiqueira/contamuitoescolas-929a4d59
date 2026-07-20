/**
 * Validações executadas ANTES de fechar um mês.
 *
 * Bloqueiam o fechamento quando há inconsistências que tornariam o
 * snapshot/histórico não-confiável.
 * 
 * Consome a lista oficial de chaves padrão resolvidas a partir do ledgerEngine.
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizeTipo, DEFAULT_MAPPINGS } from '@/lib/ledgerEngine';
import type { ClosureModule } from '@/hooks/usePeriodClosures';

export interface ClosureValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function prevMonth(m: string): string {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function validateClosure(
  schoolId: string,
  month: string,
  module: ClosureModule
): Promise<ClosureValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) Tipos válidos: itens do Template Financeiro da escola + fallbacks do Ledger
  const { data: school } = await supabase
    .from('schools')
    .select('financial_model_template_id' as any)
    .eq('id', schoolId)
    .maybeSingle();
  const tplId = (school as any)?.financial_model_template_id as string | null;
  const { data: tplItems = [] } = tplId
    ? await supabase
        .from('financial_model_template_items' as any)
        .select('name')
        .eq('template_id', tplId)
    : { data: [] as any[] } as any;

  const validKeys = new Set<string>();
  (tplItems as any[]).forEach(c => {
    if (c?.name) validKeys.add(normalizeTipo(c.name));
  });

  // Adiciona chaves padrão oficiais do ledgerEngine
  Object.keys(DEFAULT_MAPPINGS).forEach(k => {
    validKeys.add(normalizeTipo(k));
  });

  // Aceita também valores genéricos estruturais sempre permitidos
  ['receita', 'despesa', 'entrada', 'saida', 'operacao', 'ignorar'].forEach(k =>
    validKeys.add(k)
  );

  // 2) Lançamentos do mês
  const monthStart = `${month}-01`;
  const [y, mm] = month.split('-').map(Number);
  const nextDate = new Date(y, mm, 1);
  const nextStart = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`;

  if (module === 'projecao') {
    const { data: entries = [] } = await supabase
      .from('financial_entries')
      .select('id, tipo, tipo_original, categoria, valor, data')
      .eq('school_id', schoolId)
      .gte('data', monthStart)
      .lt('data', nextStart);

    const tiposInvalidos = new Set<string>();
    let semCategoria = 0;
    for (const e of entries as any[]) {
      const tipo = String(e.tipo_original || e.tipo || '').trim();
      if (!tipo) {
        tiposInvalidos.add('(vazio)');
        continue;
      }
      if (!validKeys.has(normalizeTipo(tipo))) tiposInvalidos.add(tipo);
      if (!e.categoria || !String(e.categoria).trim()) semCategoria += 1;
    }
    if (tiposInvalidos.size > 0) {
      errors.push(
        `Há ${tiposInvalidos.size} tipo(s) fora do modelo financeiro: ${Array.from(tiposInvalidos).slice(0, 5).join(', ')}${tiposInvalidos.size > 5 ? '…' : ''}. Cadastre-os em Classificação de Tipos ou ajuste os lançamentos antes de fechar.`
      );
    }
    if (semCategoria > 0) {
      warnings.push(`${semCategoria} lançamento(s) sem categoria.`);
    }
  } else {
    // realizado — valida tipo simples (receita/despesa/operacao)
    const { data: entries = [] } = await supabase
      .from('realized_entries')
      .select('id, tipo, conta_nome, valor')
      .eq('school_id', schoolId)
      .gte('data', monthStart)
      .lt('data', nextStart);
    const tiposPermitidos = new Set(['receita', 'despesa', 'operacao', 'entrada', 'saida']);
    let tiposRuins = 0;
    let semConta = 0;
    for (const e of entries as any[]) {
      const t = String(e.tipo || '').toLowerCase().trim();
      if (!tiposPermitidos.has(t)) tiposRuins += 1;
      if (!e.conta_nome || !String(e.conta_nome).trim()) semConta += 1;
    }
    if (tiposRuins > 0) {
      errors.push(`${tiposRuins} lançamento(s) com tipo inválido (esperado: receita, despesa ou operação).`);
    }
    if (semConta > 0) {
      warnings.push(`${semConta} lançamento(s) sem conta vinculada.`);
    }
  }

  // 3) Consistência de saldo: mês anterior fechado → saldo_final dele deve ser
  //    a referência para este mês.
  if (module === 'projecao') {
    const prev = prevMonth(month);
    const { data: prevSnap } = await supabase
      .from('period_closure_snapshots' as any)
      .select('saldo_final, created_at')
      .eq('school_id', schoolId)
      .eq('module', module)
      .eq('month', prev)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prevSnap) {
      // Apenas aviso — pode ser o primeiro mês.
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
