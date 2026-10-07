import { renewalDb as db } from '@/hooks/useRenewal';
import type { RenewalSheet } from '@/hooks/useRenewal';
import { buildImported, mergeRows, applyRenewedFromNextPeriod } from './mergeEngine';
import type { RenewalRow, RenewalSettings, Override, RenewalColumn, Issue } from './types';
import type { ParsedSource } from './sponteParser';
import { buildWorkbook } from './exportXlsx';
import type { TemplateStructure } from './types';

const KEEP: Record<string, string[]> = {
  turmas_existentes: ['Nome', 'Curso', 'Estagio', 'Professor', 'Modalidade', 'IntegrantesAtuais', 'Aluno', 'NumeroMatricula', 'TerminoContrato', 'NumeroContrato', 'SituacaoAluno', 'SituacaoContrato'],
  turmas_formacao: ['Nome', 'Curso', 'Estagio', 'Professor', 'Modalidade', 'Aluno', 'NumeroMatricula', 'DataMatricula', 'DataInicio', 'InicioContrato', 'DataContrato', 'NumeroContrato'],
  contas_receber: ['Sacado', 'NumeroMatricula', 'DataVencimento', 'DataPagamento', 'Categoria', 'FormaCobranca', 'Situacao', 'SituacaoParcela', 'Valor', 'NumeroContrato', 'Turma'],
};

async function chunked<T>(items: T[], size: number, fn: (c: T[]) => Promise<void>) { for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size)); }

export async function saveImport(sheet: RenewalSheet, parsed: ParsedSource, fileName: string, userId?: string) {
  const rows = parsed.rows.map(r => Object.fromEntries(KEEP[parsed.source].filter(k => k in r).map(k => [k, r[k] instanceof Date ? r[k].toISOString().slice(0, 10) : r[k]])));
  const { error } = await db.from('renewal_imports').insert({ sheet_id: sheet.id, school_id: sheet.school_id, source_key: parsed.source, file_name: fileName, row_count: rows.length, summary: { rows, discarded: parsed.discarded }, imported_by: userId });
  if (error) throw error;
}

/** Recalcula a planilha a partir das últimas importações, preservando o que a equipe editou. */
export async function rebuildSheet(sheet: RenewalSheet, settings: RenewalSettings, existing: RenewalRow[]) {
  const { data: imps, error } = await db.from('renewal_imports').select('*').eq('sheet_id', sheet.id).order('created_at', { ascending: false });
  if (error) throw error;
  const latest = (k: string) => imps.find((i: any) => i.source_key === k);
  const t = latest('turmas_existentes'); const c = latest('contas_receber');
  if (!t) return { stats: null, issues: 0 };
  const { rows: imported, issues } = buildImported(t.summary.rows, c?.summary.rows ?? null, { settings, minDue: sheet.params?.minDue });
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
  const all2 = [...issues, ...extra];
  await chunked(all2, 400, async part => { const { error: e } = await db.from('renewal_issues').insert(part.map(i => ({ sheet_id: sheet.id, school_id: sheet.school_id, kind: i.kind, row_key: i.row_key ?? null, message: i.message, detail: i.detail ?? {} }))); if (e) throw e; });
  const patch: any = { updated_at: new Date().toISOString() };
  if (c && sheet.status === 'aguardando_relatorios') patch.status = 'em_preparacao';
  if (sheet.sent_version) patch.dirty = true;
  await db.from('renewal_sheets').update(patch).eq('id', sheet.id);
  return { stats, issues: all2.length };
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
  const buf = await buildWorkbook(rows, sheet.columns, structure);
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
