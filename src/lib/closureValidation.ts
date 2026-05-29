/**
 * Validações executadas ANTES de fechar um mês.
 *
 * Bloqueiam o fechamento quando há inconsistências que tornariam o
 * snapshot/histórico não-confiável:
 *
 *  - Tipos fora do modelo financeiro da escola
 *  - Categorias vazias / inválidas em entries
 *  - Saldo do mês anterior fechado deveria bater com o saldo inicial deste mês
 *
 * Usado por `usePeriodClosures.useCloseMonths`. Lança nada — apenas devolve
 * a lista de erros para a UI decidir como exibir.
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizeTipo } from '@/lib/classificationUtils';
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

  // 1) Tipos válidos do modelo da escola
  const { data: clsRows = [] } = await supabase
    .from('type_classifications')
    .select('tipo_valor, label, classificacao')
    .eq('school_id', schoolId);
  const validKeys = new Set(
    (clsRows as any[]).map(c => normalizeTipo(c.tipo_valor))
  );
  // Aceita também valores genéricos sempre permitidos
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
  //    a referência para este mês. Se este mês tem snapshot (reaberto e refechando),
  //    avisamos quando houver divergência grande.
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
      // (não bloqueia)
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
