function norm(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const PEOPLE_RE = /marketing digital|identidade visual|\bdesign|\bedicao|social media|fotograf/;

/** Retorna a subcategoria de marketing, ou null se o lançamento não é de marketing. */
export function classifyMarketingSub(conta: string, descricao: string): string | null {
  const c = norm(conta);
  const d = norm(descricao);
  const isMkt = c === 'marketing' || (c === 'administrativo' && PEOPLE_RE.test(d) && d.includes('marketing') || (c === 'administrativo' && /identidade visual|edicao .*video/.test(d)));
  if (!isMkt) return null;
  if (PEOPLE_RE.test(d)) return 'Marketing · Pessoas / serviços';
  if (d.startsWith('impostos') || /cofins|pis|iss/.test(d)) return 'Marketing · Impostos sobre anúncios';
  if (/camiseta|brinde|adesivo|bone/.test(d)) return 'Marketing · Camisetas e brindes';
  if (/rd station|canva|mlabs|ferramenta|assinatura|software/.test(d)) return 'Marketing · Ferramentas';
  if (/anuncio|google ads|meta ads|campanha|impulsion|^expedicao|marketing$/.test(d) || !d.includes(' - ') || d.endsWith('- marketing')) return 'Marketing · Anúncios';
  return 'Marketing · Outros';
}

const MKT_PARENT_SUBS = new Set([
  'Marketing · Anúncios',
  'Marketing · Impostos sobre anúncios',
  'Marketing · Ferramentas',
]);

/** Retorna 'Marketing' quando a subcategoria deve ir para a categoria mãe própria de Marketing. */
export function marketingParentGroup(sub: string | null): string | null {
  return sub && MKT_PARENT_SUBS.has(sub) ? 'Marketing' : null;
}

const NOT_PERSON = new Set(['marketing', 'google', 'governo', 'cartao caju', 'caju', 'receita federal', 'prefeitura']);

/** Extrai o nome de uma pessoa da descrição, quando houver. */
export function extractPersonName(descricao: string): string | null {
  const d = (descricao || '').replace(/\[.*?\]/g, '').trim();
  const fgts = d.match(/(?:FGTS|INSS|Sal[aá]rio|Vale \w+)(?: Mensal)? ([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?: [A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,4}) \(/);
  if (fgts) return fgts[1];
  const parts = d.split(' - ');
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1].trim();
  if (NOT_PERSON.has(norm(last))) return null;
  const words = last.split(/\s+/);
  if (words.length < 2 || words.length > 6) return null;
  const connectors = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
  const ok = words.every(w => connectors.has(w) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçü]+$/.test(w));
  return ok ? last : null;
}

/** Atribui pró-labores sem nome (ex.: QdC EXPEDIÇÕES) aos sócios com pró-labore nomeado no mesmo mês. */
export function attributeUnnamedProLabore(entries: { id: string; data: string; descricao: string; conta_nome: string }[]): Record<string, string> {
  const byMonth: Record<string, { named: Set<string>; unnamed: { id: string; key: string }[] }> = {};
  entries.forEach(e => {
    if (!/pro.?labore/.test(norm(e.conta_nome)) || !/pro.?labore mensal/.test(norm(e.descricao))) return;
    const ym = (e.data || '').slice(0, 7);
    const b = (byMonth[ym] ||= { named: new Set(), unnamed: [] });
    const n = extractPersonName(e.descricao);
    if (n) b.named.add(n);
    else b.unnamed.push({ id: e.id, key: e.descricao.match(/Tiny (\d+)/)?.[1] || e.id });
  });
  const out: Record<string, string> = {};
  Object.values(byMonth).forEach(({ named, unnamed }) => {
    const names = [...named].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!names.length) return;
    unnamed.sort((a, b) => a.key.localeCompare(b.key)).forEach((u, i) => { out[u.id] = names[i % names.length]; });
  });
  return out;
}
