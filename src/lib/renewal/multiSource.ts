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


/** Diz se uma linha (aluno/matrícula) aparece num relatório de turmas de outro sistema — aluno real, não pendência. */
export function inOtherTurmas(other: Record<string, any>[] | null | undefined) {
  const mats = new Set<string>(); const names = new Set<string>();
  for (const o of other ?? []) { const m = String(o.NumeroMatricula ?? '').trim(); if (m) mats.add(m); if (o.Aluno) names.add(nk(o.Aluno)); }
  return (row: { matricula?: any; aluno?: any } | undefined) => !!row && ((row.matricula && mats.has(String(row.matricula).trim())) || names.has(nk(row.aluno)));
}

/** Alunos que estão em turma num sistema e não no outro (Sponte × Omni). Só aviso: ninguém entra nem sai da planilha. */
export function divergenciaSistemas(base: Record<string, any>[], other: Record<string, any>[], baseIsOmni: boolean) {
  const [bn, on] = baseIsOmni ? ['Omni', 'Sponte'] : ['Sponte', 'Omni'];
  const names = (rs: Record<string, any>[]) => new Map(rs.filter(r => String(r.Aluno ?? '').trim()).map(r => [nk(r.Aluno), String(r.Aluno).trim()]));
  const b = names(base), o = names(other); const out: { kind: string; message: string; detail: any }[] = [];
  const soO = [...o].filter(([k]) => !b.has(k)).map(([, v]) => v).sort();
  const soB = [...b].filter(([k]) => !o.has(k)).map(([, v]) => v).sort();
  for (const a of soO) out.push({ kind: 'divergencia_sistemas', message: `${a}: está em turma no ${on}, mas não no ${bn}.`, detail: { aluno: a, so_em: on } });
  for (const a of soB) out.push({ kind: 'divergencia_sistemas', message: `${a}: está em turma no ${bn}, mas não no ${on}.`, detail: { aluno: a, so_em: bn } });
  return out;
}

/**
 * Turmas do próximo período (ex.: 2027/1) não entram na planilha de renovação.
 * Período atual = semestre mais comum no relatório do Omni; tira da base quem só aparece em turma de semestre posterior
 * (no próprio relatório ou no do outro sistema).
 */
export function dropNextPeriod(base: Record<string, any>[], other: Record<string, any>[] = []) {
  const all = [...base, ...other].filter(r => String(r.Semestre ?? '').trim());
  if (!all.length) return { rows: base, removed: [] as string[] };
  const cnt = new Map<string, number>(); for (const r of all) cnt.set(String(r.Semestre).trim(), (cnt.get(String(r.Semestre).trim()) ?? 0) + 1);
  const cur = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
  const isNext = (r: Record<string, any>) => { const s = String(r.Semestre ?? '').trim(); return !!s && s > cur; };
  const nextOther = new Set(other.filter(isNext).map(r => nk(r.Aluno)));
  const curOther = new Set(other.filter(r => !isNext(r)).map(r => nk(r.Aluno)));
  const removed: string[] = [];
  const rows = base.filter(r => {
    const out = isNext(r) || (nextOther.has(nk(r.Aluno)) && !curOther.has(nk(r.Aluno)));
    if (out) removed.push(String(r.Aluno)); return !out;
  });
  return { rows, removed };
}
