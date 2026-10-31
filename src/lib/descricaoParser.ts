/** Lê descrições do tipo "Expedição Peru (12 a 20/09/2026) - Guias Locais (USD ...) - Fornecedor". */

export interface ParsedDescricao {
  tipo: string;
  fornecedor: string | null;
  detalhe: string;
}

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const TIPOS: [RegExp, string][] = [
  [/^gastos?( diversos)? guia qdc|^guias? qdc/, 'Guia QdC'],
  [/^guias?( locais| local)?\b|^guia\b/, 'Guias locais'],
  [/^hospedage|^hotel|^pousada/, 'Hospedagem'],
  [/^seguro/, 'Seguro'],
  [/^marketing|^anuncio/, 'Marketing'],
  [/^taxas?( de pagamento| asaas)?\b|^tarifa/, 'Taxas de pagamento'],
  [/^aliment|^refei/, 'Alimentação'],
  [/^desloc|^transp|^transfer|^passage|^onibus|^van\b|^combust/, 'Deslocamento'],
  [/^camiseta|^brinde|^envio de produtos/, 'Brindes'],
  [/^impostos?/, 'Impostos'],
  [/^outros|^diversos/, 'Outros'],
];

function tipoCanonico(seg: string): string | null {
  const n = norm(seg);
  for (const [re, nome] of TIPOS) if (re.test(n)) return nome;
  return null;
}

const DATE_RE = /\d{1,2}\s*\/\s*\d{1,2}|\d{4}/;

function limpa(s: string) {
  return (s || '')
    .replace(/\[tiny[^\]]*\]/gi, '')
    .replace(/\(\s*total da atividade\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function semParenteses(s: string) {
  return s.replace(/\s*\([^)]*\)/g, '').trim();
}

/** Parece nome de fornecedor/pessoa (texto sem números e sem palavras de detalhe). */
function pareceFornecedor(seg: string) {
  const s = semParenteses(seg);
  if (!s || s.length > 50) return false;
  if (/\d/.test(s)) return false;
  if (/^(parcela|inclui|ja |já |em aberto|vet|usd|us\$|pen)/i.test(s)) return false;
  if (tipoCanonico(s)) return false;
  return true;
}

export function parseDescricao(descricao: string, groupName = ''): ParsedDescricao {
  let d = limpa(descricao);
  // tira prefixo genérico e nome do centro
  const g = norm(groupName);
  const partes = d.split(/\s+[-–—]\s+/).map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return { tipo: 'Outros', fornecedor: null, detalhe: '' };

  // primeiro segmento = atividade/centro (+ datas): descartado quando houver mais partes
  let resto = partes;
  const primeiro = norm(semParenteses(partes[0])).replace(/^(expedicao|passeio|tour|trilha|caiaque)\s*(de|do|da|no|na|ao)?\s*/, '');
  const ehAtividade =
    partes.length > 1 &&
    (!!g && (primeiro.startsWith(g) || g.startsWith(primeiro) || primeiro.includes(g.split(' ')[0])) ||
      DATE_RE.test(partes[0]) ||
      !tipoCanonico(partes[0]));
  if (ehAtividade) resto = partes.slice(1);

  // tipo de custo
  const tipoSeg = resto[0] || partes[0];
  const tipo = tipoCanonico(tipoSeg) || semParenteses(tipoSeg).replace(DATE_RE, '').trim() || 'Outros';

  // detalhes entre parênteses do segmento do tipo (sem datas)
  const detalhes: string[] = [];
  (tipoSeg.match(/\(([^)]*)\)/g) || []).forEach(m => detalhes.push(m.slice(1, -1)));

  // fornecedor = último segmento, se parecer nome
  let fornecedor: string | null = null;
  const meio = resto.slice(1);
  if (meio.length && pareceFornecedor(meio[meio.length - 1])) {
    const ultimo = meio.pop();
    if (ultimo) fornecedor = semParenteses(ultimo);
  }
  // Taxa Asaas sem fornecedor explícito
  if (!fornecedor && /asaas/i.test(tipoSeg)) fornecedor = 'Asaas';
  detalhes.push(...meio);

  return { tipo, fornecedor, detalhe: detalhes.join(' · ') };
}
