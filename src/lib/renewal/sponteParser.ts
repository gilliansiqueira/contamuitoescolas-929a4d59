import * as XLSX from 'xlsx';
/** Turmas com todas as linhas "Em formação" são do próximo período, nunca a base atual. */
export function looksLikeFormacao(rows: Record<string, any>[]) {
  return rows.length > 0 && rows.every(r => /forma[cç][aã]o/i.test(String(r.SituacaoTurma ?? '')));
}
import { norm } from './fields';

export type SourceKey = 'turmas_existentes' | 'contas_receber' | 'turmas_formacao';

const REQUIRED: Partial<Record<SourceKey, string[]>> = {
  turmas_existentes: ['nome', 'aluno', 'numeromatricula'],
  contas_receber: ['sacado', 'datavencimento', 'categoria'],
};

export interface ParsedSource { source: SourceKey; headers: string[]; rows: Record<string, any>[]; discarded: number }

/** Data do Sponte ("dd/mm/aaaa hh:mm:ss", Date ou serial) → "aaaa-mm-dd". */
export function toIsoDate(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null; }
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const i = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return i ? `${i[1]}-${i[2]}-${i[3]}` : null;
}

export function toNumber(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Matrícula/contrato: texto sem ".0" nem zeros à esquerda. */
export function toId(v: any): string {
  if (v == null) return '';
  return String(v).trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
}

/** Reconhece qual relatório é pelo cabeçalho. */
export function detectSource(matrix: any[][]): { source: SourceKey; headerRow: number } | null {
  for (let r = 0; r < Math.min(30, matrix.length); r++) {
    const vals = (matrix[r] ?? []).map(norm);
    for (const [k, req] of Object.entries(REQUIRED) as [SourceKey, string[]][]) {
      if (req.every(h => vals.includes(h))) return { source: k, headerRow: r };
    }
  }
  return null;
}

export function parseSponteMatrix(matrix: any[][], force?: SourceKey): ParsedSource {
  const det0 = detectSource(matrix);
  if (force === 'turmas_formacao' && det0 && det0.source !== 'turmas_existentes') throw new Error('Este arquivo não parece um relatório de turmas. Exporte as turmas em formação do próximo período com os integrantes.');
  const det = det0 && force ? { ...det0, source: force } : det0;
  if (!det) throw new Error('Não reconheci o relatório. Envie "Turmas Existentes" (com integrantes) ou "Contas a Receber" exportados em Excel tabulado.');
  const headers = (matrix[det.headerRow] ?? []).map(h => String(h ?? '').trim());
  const key = det.source === 'contas_receber' ? 'Sacado' : 'Aluno';
  const ki = headers.indexOf(key);
  const rows: Record<string, any>[] = [];
  let discarded = 0;
  for (let r = det.headerRow + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const k = String(line[ki] ?? '').trim();
    // Linhas de apresentação, subtotais e totais não têm aluno/sacado.
    if (!k || /^total/i.test(k)) { if (line.some(v => v != null && v !== '')) discarded++; continue; }
    const o: Record<string, any> = {};
    headers.forEach((h, i) => { if (h) o[h] = line[i]; });
    rows.push(o);
  }
  return { source: det.source, headers, rows, discarded };
}

export async function parseSponteFile(file: File, force?: SourceKey): Promise<ParsedSource> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  return parseSponteMatrix(matrix, force);
}
