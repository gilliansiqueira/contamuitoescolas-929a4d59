/** Agregações de exibição por centro de custo (obra). Só soma o que já está gravado; não recalcula a SSOT. */
export interface CCItem { group_id: string; descricao: string; valor: number; data: string; tipo: 'receita' | 'despesa' }
export interface CCGroup { id: string; name: string }

const abs = (n: number) => Math.abs(Number(n) || 0);
const norm = (s: string) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** "fornecedor · categoria" → partes; sem separador, tudo é fornecedor. */
export function splitFornecedorCategoria(d: string) {
  const i = (d || '').lastIndexOf(' · ');
  if (i < 0) return { fornecedor: (d || '').trim() || 'Sem descrição', categoria: 'Sem categoria' };
  return { fornecedor: d.slice(0, i).trim() || 'Sem descrição', categoria: d.slice(i + 3).trim() || 'Sem categoria' };
}

export function isEstrutura(name: string) { return norm(name).includes('ATHER ENGENHARIA'); }

export function resultadoPorObra(items: CCItem[], groups: CCGroup[]) {
  const map = new Map<string, { id: string; name: string; receita: number; despesa: number }>();
  for (const g of groups) map.set(g.id, { id: g.id, name: g.name, receita: 0, despesa: 0 });
  for (const it of items) {
    const r = map.get(it.group_id); if (!r) continue;
    if (it.tipo === 'receita') r.receita += abs(it.valor); else r.despesa += abs(it.valor);
  }
  return [...map.values()]
    .filter(r => r.receita || r.despesa)
    .map(r => ({ ...r, resultado: r.receita - r.despesa, margem: r.receita ? (r.receita - r.despesa) / r.receita : null }))
    .sort((a, b) => b.resultado - a.resultado);
}

export function topN<T extends { valor: number }>(rows: T[], n = 10) {
  const total = rows.reduce((s, r) => s + r.valor, 0);
  return rows.slice().sort((a, b) => b.valor - a.valor).slice(0, n).map(r => ({ ...r, pct: total ? r.valor / total : 0 }));
}

export function topObras(items: CCItem[], groups: CCGroup[], n = 10) {
  const name = new Map(groups.map(g => [g.id, g.name]));
  const m = new Map<string, number>();
  for (const it of items) if (it.tipo === 'despesa' && !isEstrutura(name.get(it.group_id) || '')) m.set(it.group_id, (m.get(it.group_id) || 0) + abs(it.valor));
  return topN([...m].map(([id, valor]) => ({ nome: name.get(id) || '—', valor })), n);
}

export function topFornecedores(items: CCItem[], n = 10) {
  const m = new Map<string, number>();
  for (const it of items) if (it.tipo === 'despesa') { const f = splitFornecedorCategoria(it.descricao).fornecedor; m.set(f, (m.get(f) || 0) + abs(it.valor)); }
  return topN([...m].map(([nome, valor]) => ({ nome, valor })), n);
}

/** Maiores categorias por mês (despesa), com variação contra o mês anterior. */
export function evolucaoCategorias(items: CCItem[], meses: string[], n = 8) {
  const tot = new Map<string, number>(); const byMes = new Map<string, Map<string, number>>();
  for (const it of items) {
    if (it.tipo !== 'despesa') continue;
    const c = splitFornecedorCategoria(it.descricao).categoria; const ym = it.data.slice(0, 7);
    tot.set(c, (tot.get(c) || 0) + abs(it.valor));
    if (!byMes.has(c)) byMes.set(c, new Map());
    byMes.get(c)!.set(ym, (byMes.get(c)!.get(ym) || 0) + abs(it.valor));
  }
  const ms = meses.slice().sort();
  return [...tot].sort((a, b) => b[1] - a[1]).slice(0, n).map(([categoria]) => {
    const valores = ms.map(m => byMes.get(categoria)?.get(m) || 0);
    const a = valores[valores.length - 1], b = valores[valores.length - 2];
    return { categoria, valores, variacao: valores.length > 1 && b ? (a - b) / b : null };
  });
}

export function obraVsEstrutura(items: CCItem[], groups: CCGroup[]) {
  const name = new Map(groups.map(g => [g.id, g.name]));
  let obras = 0, estrutura = 0;
  for (const it of items) if (it.tipo === 'despesa') { if (isEstrutura(name.get(it.group_id) || '')) estrutura += abs(it.valor); else obras += abs(it.valor); }
  const t = obras + estrutura;
  return { obras, estrutura, pctObras: t ? obras / t : 0, pctEstrutura: t ? estrutura / t : 0 };
}

/** Obras cujo gasto no mês alvo supera em mais de 30% a média dos meses anteriores com gasto. */
export function obrasEmDestaque(allItems: CCItem[], groups: CCGroup[], mes: string, limite = 0.3) {
  const name = new Map(groups.map(g => [g.id, g.name]));
  const m = new Map<string, Map<string, number>>();
  for (const it of allItems) {
    if (it.tipo !== 'despesa' || isEstrutura(name.get(it.group_id) || '')) continue;
    const ym = it.data.slice(0, 7); if (ym > mes) continue;
    if (!m.has(it.group_id)) m.set(it.group_id, new Map());
    m.get(it.group_id)!.set(ym, (m.get(it.group_id)!.get(ym) || 0) + abs(it.valor));
  }
  const out: { nome: string; atual: number; media: number; variacao: number }[] = [];
  for (const [id, mm] of m) {
    const atual = mm.get(mes) || 0;
    const ant = [...mm].filter(([k]) => k < mes).map(([, v]) => v);
    if (!atual || !ant.length) continue;
    const media = ant.reduce((s, v) => s + v, 0) / ant.length;
    if (media && atual > media * (1 + limite)) out.push({ nome: name.get(id) || '—', atual, media, variacao: atual / media - 1 });
  }
  return out.sort((a, b) => b.variacao - a.variacao);
}
