import { supabase } from '@/integrations/supabase/client';
import { rebuildSheet } from '@/lib/renewal/persist';

const db = supabase as any;
const DEF = { include_material: false, module_categories: ['Parcela Regular', 'Parcela Especial'], separate_modalities: ['Personal', 'VIP', 'Semi', 'ON'] };

export async function run(schoolId: string) {
  const { data: sheets } = await db.from('renewal_sheets').select('*').eq('school_id', schoolId);
  const { data: st } = await db.from('renewal_settings').select('*').eq('school_id', schoolId).maybeSingle();
  const out: any[] = [];
  for (const sheet of sheets ?? []) {
    const { data: rows } = await db.from('renewal_rows').select('*').eq('sheet_id', sheet.id).limit(5000);
    const before = new Map((rows ?? []).map((r: any) => [r.row_key, r.imported]));
    const res = await rebuildSheet(sheet, st ?? DEF, rows ?? []);
    const { data: after } = await db.from('renewal_rows').select('row_key, imported, overrides').eq('sheet_id', sheet.id).limit(5000);
    for (const r of after ?? []) {
      const b: any = before.get(r.row_key) ?? {};
      const a = r.imported ?? {};
      if (b.venc_ultima_parcela !== a.venc_ultima_parcela || b.forma_pagamento_atual !== a.forma_pagamento_atual || b.termino_pagamento !== a.termino_pagamento)
        out.push({ sheet: sheet.id, aluno: a.aluno, turma: a.turma, antes: [b.venc_ultima_parcela, b.forma_pagamento_atual, b.termino_pagamento], depois: [a.venc_ultima_parcela, a.forma_pagamento_atual, a.termino_pagamento], editado: Object.keys(r.overrides ?? {}).length > 0 });
    }
    out.push({ resumo: sheet.id, issues: res.issues });
  }
  return out;
}
