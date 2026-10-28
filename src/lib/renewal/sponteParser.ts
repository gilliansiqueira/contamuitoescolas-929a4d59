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

/** Cabeçalho do "Alunos por turma" do Omni. */
export function detectOmni(matrix: any[][]): number {
  for (let r = 0; r < Math.min(30, matrix.length); r++) {
    const vals = (matrix[r] ?? []).map(norm);
    if (['turma', 'aluno', 'matricula', 'instrutor'].every(h => vals.includes(h))) return r;
  }
  return -1;
}

/** Converte linhas do Omni para as chaves do Sponte. Matrícula "6409/2" = matrícula 6409, contrato 2. */
export function fromOmni(rows: Record<string, any>[]): Record<string, any>[] {
  const g = (o: Record<string, any>, n: string) => { const k = Object.keys(o).find(x => norm(x) === n); return k ? o[k] : null; };
  const count = new Map<string, number>();
  for (const o of rows) { const t = String(g(o, 'turma') ?? '').trim(); count.set(t, (count.get(t) ?? 0) + 1); }
  return rows.map(o => {
    const [mat, contrato] = String(g(o, 'matricula') ?? '').trim().split('/');
    const turma = String(g(o, 'turma') ?? '').trim();
    const mod = String(g(o, 'modalidade') ?? '').trim();
    const tipo = String(g(o, 'tipo') ?? '').trim();
    return {
      Nome: turma, Aluno: g(o, 'aluno'), NumeroMatricula: mat?.trim() || null, NumeroContrato: contrato?.trim() ? `${mat.trim()}/${contrato.trim()}` : null,
      Professor: g(o, 'instrutor'), Curso: g(o, 'curso'), Estagio: g(o, 'livro'),
      Modalidade: !mod || norm(mod) === 'turmas' ? tipo || mod : mod,
      DataInicio: g(o, 'inicio'), DataTermino: g(o, 'fim'), FoneCelular: g(o, 'telefone'), Email: g(o, 'e mail'),
      SituacaoAluno: g(o, 'status aluno'), SituacaoTurma: g(o, 'status turma'), IntegrantesAtuais: count.get(turma) ?? null,
      Dias: g(o, 'dias'), Horario: g(o, 'horario'), Semestre: g(o, 'semestre'),
    };
  });
}

export function parseSponteMatrix(matrix: any[][], force?: SourceKey): ParsedSource {
  const omniRow = detectOmni(matrix);
  if (omniRow >= 0 && force !== 'contas_receber') {
    const headers = (matrix[omniRow] ?? []).map(h => String(h ?? '').trim());
    const ai = headers.findIndex(h => norm(h) === 'aluno');
    const raw: Record<string, any>[] = []; let discarded = 0;
    for (let r = omniRow + 1; r < matrix.length; r++) {
      const line = matrix[r] ?? [];
      if (!String(line[ai] ?? '').trim()) { if (line.some(v => v != null && v !== '')) discarded++; continue; }
      const o: Record<string, any> = {}; headers.forEach((h, i) => { if (h) o[h] = line[i]; }); raw.push(o);
    }
    const rows = fromOmni(raw);
    const source: SourceKey = force === 'turmas_formacao' || looksLikeFormacao(rows) ? 'turmas_formacao' : 'turmas_existentes';
    return { source, headers: Object.keys(rows[0] ?? {}), rows, discarded };
  }
  const det0 = detectSource(matrix);
  if (force === 'turmas_formacao' && det0 && det0.source !== 'turmas_existentes') throw new Error('Este arquivo não parece um relatório de turmas. Exporte as turmas em formação do próximo período com os integrantes.');
  const det = det0 && force ? { ...det0, source: force } : det0;
  if (!det) throw new Error('Não reconheci o relatório. Envie "Turmas Existentes" (com integrantes) ou "Contas a Receber" do Sponte, ou "Alunos por turma" do Omni, em Excel.');
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
  const source = det.source === 'turmas_existentes' && looksLikeFormacao(rows) ? 'turmas_formacao' : det.source;
  return { source, headers, rows, discarded };
}

/** Aba "Turmas" do Omni: Turma + Instrutor + Sala + Alunos (sem coluna Aluno). */
function omniTurmasInfo(matrix: any[][]): Map<string, { sala: any; alunos: any }> | null {
  for (let r = 0; r < Math.min(30, matrix.length); r++) {
    const vals = (matrix[r] ?? []).map(norm);
    if (['turma', 'instrutor', 'sala', 'alunos'].every(h => vals.includes(h)) && !vals.includes('aluno')) {
      const ti = vals.indexOf('turma'), si = vals.indexOf('sala'), ai = vals.indexOf('alunos');
      const m = new Map<string, { sala: any; alunos: any }>();
      for (let i = r + 1; i < matrix.length; i++) {
        const t = String(matrix[i]?.[ti] ?? '').trim();
        if (t) m.set(t, { sala: matrix[i][si], alunos: matrix[i][ai] });
      }
      return m;
    }
  }
  return null;
}

/** Lê todas as abas e usa a primeira que tiver um relatório reconhecido (a ordem das abas não importa). */
export function parseSponteWorkbook(sheets: any[][][], force?: SourceKey): ParsedSource {
  let parsed: ParsedSource | null = null; let firstErr: unknown = null;
  let info: Map<string, { sala: any; alunos: any }> | null = null;
  for (const m of sheets) {
    info = info ?? omniTurmasInfo(m);
    if (parsed) continue;
    if (detectOmni(m) < 0 && !detectSource(m)) continue;
    try { parsed = parseSponteMatrix(m, force); } catch (e) { firstErr = firstErr ?? e; }
  }
  if (!parsed) { if (firstErr) throw firstErr; return parseSponteMatrix(sheets[0] ?? [], force); }
  if (info) {
    for (const row of parsed.rows) {
      const i = info.get(String(row.Nome ?? '').trim());
      if (!i) continue;
      if (row.Sala == null || row.Sala === '') row.Sala = i.sala;
      const n = Number(i.alunos); if (Number.isFinite(n) && n > 0) row.IntegrantesAtuais = n;
    }
    if (!parsed.headers.includes('Sala')) parsed.headers = [...parsed.headers, 'Sala'];
  }
  return parsed;
}

export async function parseSponteFile(file: File, force?: SourceKey): Promise<ParsedSource> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false, cellDates: true });
  const sheets = wb.SheetNames.map(n => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }));
  return parseSponteWorkbook(sheets, force);
}
