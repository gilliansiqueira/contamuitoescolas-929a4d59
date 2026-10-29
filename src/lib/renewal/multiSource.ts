const nk = (s: any) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const isoD = (v: any) => { const s = String(v ?? ''); const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10); };
const numV = (v: any) => { if (typeof v === 'number') return v.toFixed(2); const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n.toFixed(2) : ''; };

/**
 * Junta vários Contas a Receber (ex.: Sponte + Omni da mesma escola). Importações em ordem da mais nova
 * para a mais antiga: a mesma parcela (aluno + vencimento + valor) conta uma vez, valendo a versão mais nova.
 */
export function mergeContasImports(importsNewestFirst: Record<string, any>[][]): Record<string, any>[] {
  const seen = new Set<string>(); const out: Record<string, any>[] = [];
  for (const rows of importsNewestFirst) {
    const local = new Set<string>();
    for (const r of rows) {
      const k = `${nk(r.Sacado)}|${isoD(r.DataVencimento)}|${numV(r.Valor)}`;
      if (seen.has(k)) continue;
      local.add(k); out.push(r);
    }
    local.forEach(k => seen.add(k));
  }
  return out;
}

const OMNI_KEYS = ['Semestre', 'Dias'];
export const isOmniTurmas = (rows: any[]) => rows.some(r => OMNI_KEYS.some(k => k in r));
const FILL: [string, string][] = [['Professor', 'Professor'], ['Estagio', 'Estagio'], ['FoneCelular', 'FoneCelular'], ['Email', 'Email']];

/** Completa campos vazios das turmas com outro relatório de turmas (outro sistema), pela matrícula ou nome idêntico. Nunca adiciona alunos. */
export function complementTurmas(base: Record<string, any>[], other: Record<string, any>[]): Record<string, any>[] {
  const byMat = new Map<string, any>(); const byName = new Map<string, any>();
  for (const o of other) { const m = String(o.NumeroMatricula ?? '').trim(); if (m) byMat.set(m, o); byName.set(nk(o.Aluno), o); }
  const empty = (v: any) => v == null || String(v).trim() === '' || /^[\s\-–—]*$/.test(String(v));
  return base.map(r => {
    const o = byMat.get(String(r.NumeroMatricula ?? '').trim()) ?? byName.get(nk(r.Aluno));
    if (!o) return r;
    const n = { ...r };
    for (const [to, from] of FILL) if (empty(n[to]) && !empty(o[from])) n[to] = o[from];
    return n;
  });
}

