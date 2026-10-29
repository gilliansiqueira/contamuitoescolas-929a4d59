import { renewalDb as db } from '@/hooks/useRenewal';
import type { RenewalSheet } from '@/hooks/useRenewal';
import { buildImported, mergeRows, applyRenewedFromNextPeriod, reclassifyNewStudents } from './mergeEngine';
import type { RenewalRow, RenewalSettings, Override, RenewalColumn, Issue } from './types';
import type { ParsedSource } from './sponteParser';
import { buildWorkbook } from './exportXlsx';
import { mergeContasImports, complementTurmas, isOmniTurmas } from './multiSource';
export { mergeContasImports, complementTurmas } from './multiSource';
import type { TemplateStructure } from './types';

const KEEP: Record<string, string[]> = {
  turmas_existentes: ['Nome', 'Curso', 'Estagio', 'Professor', 'Modalidade', 'IntegrantesAtuais', 'Aluno', 'NumeroMatricula', 'TerminoContrato', 'NumeroContrato', 'SituacaoAluno', 'SituacaoContrato'],
  turmas_formacao: ['Nome', 'Curso', 'Estagio', 'Professor', 'Modalidade', 'Aluno', 'NumeroMatricula', 'DataMatricula', 'DataInicio', 'InicioContrato', 'DataContrato', 'NumeroContrato'],
  contas_receber: ['Sacado', 'NumeroMatricula', 'DataVencimento', 'DataPagamento', 'Categoria', 'FormaCobranca', 'Situacao', 'SituacaoParcela', 'Valor', 'NumeroContrato', 'Turma'],
};

async function chunked<T>(items: T[], size: number, fn: (c: T[]) => Promise<void>) { for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size)); }

export async function saveImport(sheet: RenewalSheet, parsed: ParsedSource, fileName: string, userId?: string) {
  // Relatórios de turmas guardam todas as colunas (telefone, e-mail, datas…) para o Modelo poder usar qualquer uma.
  const keys = (r: Record<string, any>) => parsed.source === 'contas_receber' ? KEEP.contas_receber.filter(k => k in r) : Object.keys(r).filter(k => k && !k.startsWith('__EMPTY'));
  const rows = parsed.rows.map(r => Object.fromEntries(keys(r).map(k => [k, r[k] instanceof Date ? r[k].toISOString().slice(0, 10) : r[k]])));
  const { error } = await db.from('renewal_imports').insert({ sheet_id: sheet.id, school_id: sheet.school_id, source_key: parsed.source, file_name: fileName, row_count: rows.length, summary: { rows, discarded: parsed.discarded }, imported_by: userId });
  if (error) throw error;
}

/** Avisos só informativos: entram como conferidos e não contam como pendência. */
export const INFO_KINDS = new Set(['formacao_aluno_novo', 'formacao_aluno_novo_parcelas']);

/** Campos que a equipe pode preencher na Conferência quando faltam parcelas. */
export const PAYMENT_FIELDS = ['forma_pagamento_atual', 'venc_ultima_parcela', 'termino_pagamento'];

/** Aviso "sem parcelas" já está resolvido se a equipe preencheu algum dado de pagamento da linha. */
export function teamFilledPayment(row: RenewalRow | undefined, columns: RenewalColumn[]): boolean {
  if (!row) return false;
  return columns.some(c => c.field && PAYMENT_FIELDS.includes(c.field) && String(row.overrides?.[c.id]?.value ?? '').trim() !== '');
}

const issueSig = (i: { kind: string; row_key?: string | null; message: string }) => `${i.kind}|${i.row_key ?? ''}|${i.message}`;
/** Remove avisos repetidos e os que a equipe já resolveu com a mesma mensagem. */
export function dedupeAgainstResolved<T extends { kind: string; row_key?: string | null; message: string }>(issues: T[], resolved: { kind: string; row_key?: string | null; message: string }[]): T[] {
  const seen = new Set(resolved.map(issueSig));
  return issues.filter(i => { const s = issueSig(i); if (seen.has(s)) return false; seen.add(s); return true; });
}

/** Recalcula a planilha a partir das últimas importações, preservando o que a equipe editou. */
export async function rebuildSheet(sheet: RenewalSheet, settings: RenewalSettings, existing: RenewalRow[]) {
  const { data: imps, error } = await db.from('renewal_imports').select('*').eq('sheet_id', sheet.id).order('created_at', { ascending: false });
  if (error) throw error;
  const latest = (k: string) => imps.find((i: any) => i.source_key === k);
  const t = latest('turmas_existentes'); const c = latest('contas_receber');
  if (!t) return { stats: null, issues: 0 };
  // Turmas: base = último envio; o último envio do outro sistema (Sponte × Omni) só completa campos vazios.
  const tOmni = isOmniTurmas(t.summary.rows);
  const t2 = imps.find((i: any) => i.source_key === 'turmas_existentes' && isOmniTurmas(i.summary.rows) !== tOmni);
  const turmas = t2 ? complementTurmas(t.summary.rows, t2.summary.rows) : t.summary.rows;
  const contas = c ? mergeContasImports(imps.filter((i: any) => i.source_key === 'contas_receber').map((i: any) => i.summary.rows ?? [])) : null;
  const { rows: imported, issues } = buildImported(turmas, contas, { settings, minDue: sheet.params?.minDue });
  const f = latest('turmas_formacao');
  if (f) {
    issues.push(...applyRenewedFromNextPeriod(imported, f.summary.rows));
    reclassifyNewStudents(issues, f.summary.rows);
  }
  const auto = new Map(existing.filter(r => !r.manual).map(r => [r.row_key, r]));
  const manualRows = existing.filter(r => r.manual);
  const { rows, stats } = mergeRows([...auto.values()], imported, sheet.columns);
  const all = [...rows, ...manualRows.map((r, i) => ({ ...r, sort_order: rows.length + i }))];
  await chunked(all, 400, async part => {
    const { error: e } = await db.from('renewal_rows').upsert(part.map(r => ({ sheet_id: sheet.id, school_id: sheet.school_id, row_key: r.row_key, imported: r.imported, overrides: r.overrides ?? {}, conflicts: r.conflicts ?? {}, sort_order: r.sort_order, manual: r.manual, updated_at: new Date().toISOString() })), { onConflict: 'sheet_id,row_key' });
    if (e) throw e;
  });
  // Linhas antigas que mudaram de turma já foram regravadas com a chave nova.
  if (stats.renamed.length) { const { error: e } = await db.from('renewal_rows').delete().eq('sheet_id', sheet.id).in('row_key', stats.renamed); if (e) throw e; }
  await db.from('renewal_issues').delete().eq('sheet_id', sheet.id).eq('resolved', false);
  const extra: Issue[] = stats.removed.map(k => ({ kind: 'fora_da_base', row_key: k, message: `Linha ${k.split('|')[0]} não veio na nova importação de turmas (mantida para conferência).` }));
  // Formação diz "Rematriculado" mas a equipe marcou outra coisa: mantém a marcação e pede revisão.
  for (const r of rows) {
    if (!r.imported?.formacao_turma) continue;
    for (const col of sheet.columns.filter(c => c.field === 'status_renovacao' || c.field === 'turma_destino')) {
      const o = r.overrides?.[col.id]; const nv = r.imported[col.field!];
      if (o && String(o.value ?? '') !== '' && String(o.value) !== String(nv)) extra.push({ kind: 'formacao_conflito', row_key: r.row_key, message: `${r.imported.aluno}: turmas em formação indicam ${col.title} = "${nv}", mas a equipe marcou "${o.value}" (mantido).` });
    }
  }
  // Avisos já conferidos/desconsiderados pela equipe não voltam; só reabrem se a mensagem mudar (ex.: nº de parcelas).
  const { data: done } = await db.from('renewal_issues').select('kind,row_key,message').eq('sheet_id', sheet.id).eq('resolved', true);
  const all2 = dedupeAgainstResolved([...issues, ...extra], done ?? []);
  const rowByKey = new Map(all.map(r => [r.row_key, r]));
  const autoResolved = (i: Issue) => INFO_KINDS.has(i.kind) || (i.kind === 'sem_financeiro' && teamFilledPayment(rowByKey.get(i.row_key ?? ''), sheet.columns));
  await chunked(all2, 400, async part => { const { error: e } = await db.from('renewal_issues').insert(part.map(i => ({ sheet_id: sheet.id, school_id: sheet.school_id, kind: i.kind, row_key: i.row_key ?? null, message: i.message, detail: autoResolved(i) && !INFO_KINDS.has(i.kind) ? { ...(i.detail ?? {}), resolucao: { motivo: 'Preenchido pela equipe' } } : i.detail ?? {}, resolved: autoResolved(i) }))); if (e) throw e; });
  const patch: any = { updated_at: new Date().toISOString() };
  if (c && sheet.status === 'aguardando_relatorios') patch.status = 'em_preparacao';
  if (sheet.sent_version) patch.dirty = true;
  await db.from('renewal_sheets').update(patch).eq('id', sheet.id);
  return { stats, issues: all2.filter(i => !INFO_KINDS.has(i.kind)).length };
}

export function applyEdit(row: RenewalRow, col: RenewalColumn, value: any, userEmail?: string): RenewalRow {
  const overrides = { ...(row.overrides ?? {}) };
  const original = col.field ? row.imported?.[col.field] ?? null : null;
  if (col.kind !== 'manual' && String(value ?? '') === String(original ?? '')) delete overrides[col.id];
  else overrides[col.id] = { value, original: overrides[col.id]?.original ?? original, by: userEmail, at: new Date().toISOString() } as Override;
  const conflicts = { ...(row.conflicts ?? {}) }; delete conflicts[col.id];
  return { ...row, overrides, conflicts };
}

export async function saveRows(sheet: RenewalSheet, rows: (RenewalRow & { id?: string })[]) {
  const { error } = await db.from('renewal_rows').upsert(rows.map(r => ({ sheet_id: sheet.id, school_id: sheet.school_id, row_key: r.row_key, imported: r.imported, overrides: r.overrides, conflicts: r.conflicts, sort_order: r.sort_order, manual: r.manual, updated_at: new Date().toISOString() })), { onConflict: 'sheet_id,row_key' });
  if (error) throw error;
  await db.from('renewal_sheets').update({ updated_at: new Date().toISOString(), ...(sheet.sent_version ? { dirty: true } : {}) }).eq('id', sheet.id);
}

export async function registerDelivery(sheet: RenewalSheet, rows: RenewalRow[], structure: TemplateStructure | null, d: { sent_at: string; recipient: string; channel: string }, userId?: string) {
  const version = (sheet.current_version ?? 0) + 1;
  const { data: iss } = await db.from('renewal_issues').select('kind,detail').eq('sheet_id', sheet.id);
  const buf = await buildWorkbook(rows, sheet.columns, structure, iss ?? []);
  const path = `${sheet.school_id}/${sheet.id}/v${version}.xlsx`;
  const up = await (db.storage as any).from('renewal-files').upload(path, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), { upsert: false });
  if (up.error) throw up.error;
  const snap = { columns: sheet.columns, rows: rows.map(r => ({ row_key: r.row_key, imported: r.imported, overrides: r.overrides })) };
  let e = (await db.from('renewal_versions').insert({ sheet_id: sheet.id, school_id: sheet.school_id, version, file_path: path, snapshot: snap, created_by: userId })).error; if (e) throw e;
  e = (await db.from('renewal_deliveries').insert({ sheet_id: sheet.id, school_id: sheet.school_id, version, ...d, created_by: userId })).error; if (e) throw e;
  e = (await db.from('renewal_sheets').update({ current_version: version, sent_version: version, dirty: false, status: 'enviada', updated_at: new Date().toISOString() }).eq('id', sheet.id)).error; if (e) throw e;
  return version;
}

export async function downloadVersion(path: string, name: string) {
  const { data, error } = await (db.storage as any).from('renewal-files').createSignedUrl(path, 120);
  if (error) throw error;
  const a = document.createElement('a'); a.href = data.signedUrl; a.download = name; a.click();
}

export function downloadBuffer(buf: ArrayBuffer, name: string) {
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Coloca a planilha no formato do modelo aprovado sem perder dados nem correções (liga colunas pela regra, ou pelo título). */
export function remapToTemplate(oldCols: RenewalColumn[], newCols: RenewalColumn[], rows: RenewalRow[]) {
  const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const map = new Map<string, string>();
  for (const o of oldCols) {
    const t = (o.field && newCols.find(c => c.field === o.field)) || newCols.find(c => !c.field && n(c.title) === n(o.title));
    if (t) map.set(o.id, t.id);
  }
  const extra = oldCols.filter(o => !map.has(o.id) && rows.some(r => r.overrides?.[o.id])).map(o => ({ ...o, hidden: false }));
  const remap = (rec: Record<string, any> = {}) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [map.get(k) ?? k, v]));
  return { columns: [...newCols, ...extra], rows: rows.map(r => ({ ...r, overrides: remap(r.overrides), conflicts: remap(r.conflicts) })) };
}

export async function applyTemplateToSheet(sheet: RenewalSheet, templateId: string, templateCols: RenewalColumn[], rows: RenewalRow[]) {
  const { columns, rows: next } = remapToTemplate(sheet.columns, templateCols, rows);
  await chunked(next, 400, part => saveRows(sheet, part));
  const { error } = await db.from('renewal_sheets').update({ template_id: templateId, columns, updated_at: new Date().toISOString(), ...(sheet.sent_version ? { dirty: true } : {}) }).eq('id', sheet.id);
  if (error) throw error;
}
