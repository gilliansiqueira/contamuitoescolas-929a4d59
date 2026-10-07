import { norm } from './fields';
import { toIsoDate, toId } from './sponteParser';
import type { Issue, RenewalColumn, RenewalRow, RenewalSettings } from './types';
import { A_CONFIRMAR, SEM_INFO } from './types';

export interface BuildParams { settings: RenewalSettings; minDue?: string | null }

/** Data mínima padrão de vencimento conforme o período ("2026/2"). */
export function defaultMinDue(period: string): string {
  const [y, s] = period.split('/').map(Number);
  return s === 1 ? `${y - 1}-10-01` : `${y}-05-01`;
}

const isMaterial = (c: string) => norm(c).startsWith('material');
const isCancelled = (p: Record<string, any>) => /cancel|estorn/i.test(String(p.Situacao ?? '')) || /cancel/i.test(String(p.SituacaoParcela ?? ''));

export function isModuleInstallment(p: Record<string, any>, s: RenewalSettings): boolean {
  if (isCancelled(p)) return false;
  const cat = norm(p.Categoria);
  if (isMaterial(cat)) return s.include_material;
  return s.module_categories.some(m => norm(m) === cat || cat.startsWith(norm(m)));
}

export function studentKey(t: Record<string, any>) {
  const m = toId(t.NumeroMatricula);
  return `${m || 'nome:' + norm(t.Aluno)}|${norm(t.Nome)}`;
}

/** Cruza Turmas Existentes com Contas a Receber. Todos os alunos da base ficam; ausência de parcelas ≠ quitação. */
export function buildImported(turmas: Record<string, any>[], contas: Record<string, any>[] | null, p: BuildParams) {
  const issues: Issue[] = [];
  const rows = new Map<string, Record<string, any>>();
  const byMat = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const t of turmas) {
    const key = studentKey(t);
    if (rows.has(key)) continue;
    const mat = toId(t.NumeroMatricula);
    const modalidade = String(t.Modalidade ?? '').trim();
    rows.set(key, {
      turma: String(t.Nome ?? '').trim(), professor: String(t.Professor ?? '').trim() || null,
      integrantes: t.IntegrantesAtuais != null && t.IntegrantesAtuais !== '' ? Number(t.IntegrantesAtuais) : null,
      aluno: String(t.Aluno ?? '').trim(), matricula: mat || null, curso: t.Curso ?? null, estagio: t.Estagio ?? null,
      modalidade: modalidade || null, numero_contrato: toId(t.NumeroContrato) || null,
      termino_contrato: toIsoDate(t.TerminoContrato), situacao_aluno: t.SituacaoAluno ?? null,
      aba: p.settings.separate_modalities.some(m => norm(m) === norm(modalidade)) ? modalidade : null,
    });
    if (mat) byMat.set(mat, [...(byMat.get(mat) ?? []), key]);
    const n = norm(t.Aluno);
    if (!(byName.get(n) ?? []).some(k => k.split('|')[0] === key.split('|')[0])) byName.set(n, [...(byName.get(n) ?? []), key]);
    if (!mat) issues.push({ kind: 'sem_matricula', row_key: key, message: `${t.Aluno}: sem matrícula na base de turmas.` });
  }
  for (const [mat, keys] of byMat) if (keys.length > 1) issues.push({ kind: 'varias_turmas', row_key: keys[0], message: `Matrícula ${mat} (${rows.get(keys[0])!.aluno}) está em ${keys.length} turmas.`, detail: { turmas: keys.map(k => rows.get(k)!.turma) } });

  if (!contas) {
    for (const r of rows.values()) Object.assign(r, { venc_ultima_parcela: null, forma_pagamento_atual: null, termino_pagamento: null });
    return { rows, issues };
  }

  const minDue = p.minDue ?? null;
  const parcelasByMat = new Map<string, Record<string, any>[]>();
  const unmatched = new Map<string, { sacado: string; mat: string; count: number }>();
  for (const c of contas) {
    if (!isModuleInstallment(c, p.settings)) continue;
    const due = toIsoDate(c.DataVencimento);
    if (!due || (minDue && due < minDue)) continue;
    let mat = toId(c.NumeroMatricula);
    if (!mat || !byMat.has(mat)) {
      const cands = byName.get(norm(c.Sacado)) ?? [];
      const mats = [...new Set(cands.map(k => k.split('|')[0]))];
      if (mats.length === 1 && !mats[0].startsWith('nome:')) mat = mats[0];
      else if (mats.length > 1) { issues.push({ kind: 'nome_ambiguo', message: `"${c.Sacado}" corresponde a ${mats.length} alunos com o mesmo nome.`, detail: { sacado: c.Sacado } }); continue; }
      else { const k = `${mat}|${norm(c.Sacado)}`; const u = unmatched.get(k) ?? { sacado: String(c.Sacado), mat, count: 0 }; u.count++; unmatched.set(k, u); continue; }
    }
    parcelasByMat.set(mat, [...(parcelasByMat.get(mat) ?? []), { ...c, _due: due }]);
  }
  const allNames = [...rows.entries()];
  for (const u of unmatched.values()) {
    const tok = norm(u.sacado).split(' ');
    const similar = allNames.filter(([, r]) => { const t = norm(r.aluno).split(' '); return t[0] === tok[0] && t[t.length - 1] === tok[tok.length - 1]; }).map(([, r]) => r.aluno);
    issues.push(similar.length
      ? { kind: 'nome_semelhante', message: `"${u.sacado}" (mat. ${u.mat || '—'}) não bate exatamente; nomes parecidos: ${[...new Set(similar)].join(', ')}.`, detail: u }
      : { kind: 'sem_correspondencia', message: `"${u.sacado}" (mat. ${u.mat || '—'}) tem ${u.count} parcela(s) do módulo mas não está nas turmas.`, detail: u });
  }

  for (const [key, r] of rows) {
    const mat = key.split('|')[0];
    let ps = parcelasByMat.get(mat) ?? [];
    const contratos = [...new Set(ps.map(x => toId(x.NumeroContrato)).filter(Boolean))];
    if (contratos.length > 1) {
      if (r.numero_contrato && contratos.includes(r.numero_contrato)) ps = ps.filter(x => toId(x.NumeroContrato) === r.numero_contrato);
      else issues.push({ kind: 'varios_contratos', row_key: key, message: `${r.aluno}: parcelas de ${contratos.length} contratos (${contratos.join(', ')}).` });
    }
    if (!ps.length) {
      Object.assign(r, { venc_ultima_parcela: SEM_INFO, forma_pagamento_atual: SEM_INFO, termino_pagamento: SEM_INFO });
      issues.push({ kind: 'sem_financeiro', row_key: key, message: `${r.aluno}: nenhuma parcela do módulo encontrada (não significa quitado).` });
      continue;
    }
    const last = ps.reduce((a, b) => (b._due > a._due ? b : a));
    const forma = String(last.FormaCobranca ?? '').trim() || SEM_INFO;
    r.venc_ultima_parcela = last._due;
    r.forma_pagamento_atual = forma;
    // Cartão: o recebimento/antecipação da escola não prova que o aluno terminou de pagar.
    r.termino_pagamento = /cart[aã]o de cr[eé]dito|recorr/i.test(forma) ? A_CONFIRMAR : last._due;
  }
  return { rows, issues };
}

/** Junta nova importação às linhas existentes preservando correções/observações; diferenças viram conflito. */
export function mergeRows(existing: RenewalRow[], imported: Map<string, Record<string, any>>, columns: RenewalColumn[]) {
  const byKey = new Map(existing.map(r => [r.row_key, r]));
  const out: RenewalRow[] = [];
  let conflicts = 0, kept = 0, added = 0;
  let order = 0;
  for (const [key, imp] of imported) {
    const old = byKey.get(key);
    if (!old) { out.push({ row_key: key, imported: imp, overrides: {}, conflicts: {}, sort_order: order++, manual: false }); added++; continue; }
    const conf: RenewalRow['conflicts'] = {};
    for (const [colId, o] of Object.entries(old.overrides ?? {})) {
      const col = columns.find(c => c.id === colId);
      if (!col?.field || col.kind === 'manual') continue;
      const nv = imp[col.field] ?? null;
      if (String(nv ?? '') !== String(o.original ?? '') && String(nv ?? '') !== String(o.value ?? '')) { conf[colId] = { imported: nv, manual: o.value }; conflicts++; }
    }
    if (Object.keys(old.overrides ?? {}).length) kept++;
    out.push({ ...old, imported: imp, conflicts: { ...(old.conflicts ?? {}), ...conf }, sort_order: order++ });
    byKey.delete(key);
  }
  // Linhas que saíram da base: mantidas (manuais ou com edição) e sinalizadas.
  const removed: string[] = [];
  for (const r of byKey.values()) {
    out.push({ ...r, imported: r.manual ? r.imported : { ...r.imported, fora_da_base: true }, sort_order: order++ });
    if (!r.manual) removed.push(r.row_key);
  }
  return { rows: out, stats: { conflicts, kept, added, removed } };
}
