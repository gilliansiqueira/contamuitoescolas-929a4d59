/**
 * Camadas de matching de categoria para importação de despesas.
 *
 * IMPORTANTE: este módulo é uma camada ADICIONAL sobre o sistema atual.
 * Ele não substitui category_rules, chart_of_accounts ou modelItems —
 * apenas adiciona normalização mais agressiva, alias por tokens, keyword
 * e fuzzy (Dice), com prioridade explícita por método e score.
 *
 * Ordem de prioridade:
 *   1. memory   (1.00)  — regra aprovada em category_rules (exato no normalizado)
 *   2. exact    (0.98)  — igual a uma categoria conhecida após normalização
 *   3. alias    (0.95)  — mesmo conjunto de tokens significativos
 *   4. keyword  (0.90)  — todos os tokens de input contidos no candidato (ou vice-versa)
 *   5. fuzzy   (0.85+)  — coeficiente de Dice em bigramas ≥ 0.80
 *   6. ai (fallback)    — apenas se solicitado externamente (0.70–0.84)
 */

export type MatchMethod = 'memory' | 'exact' | 'alias' | 'keyword' | 'fuzzy' | 'ai' | 'none';

export interface MatchResult {
  target: string | null;
  score: number;
  method: MatchMethod;
  /** Sempre 'existing_system' | 'memory' | 'ai' para compatibilidade com pedido do produto */
  matchMethod: 'existing_system' | 'memory' | 'ai' | 'none';
}

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'os', 'as',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'sem', 'por',
  'um', 'uma', 'pra', 'pro', 'the', 'of', 'and', 'or',
]);

const COMMON_TYPOS: Array<[RegExp, string]> = [
  [/\bdesp\b/g, 'despesa'],
  [/\brec\b/g, 'receita'],
  [/\bmanut\b/g, 'manutencao'],
  [/\bmaterial\.?\s*/g, 'material '],
  [/\bservicos?\b/g, 'servico'],
  [/\bcontas?\b/g, 'conta'],
  [/\bfornecedor(es)?\b/g, 'fornecedor'],
  [/\bagua\b/g, 'agua'],
  [/\benergia eletrica\b/g, 'energia'],
  [/\bluz\b/g, 'energia'],
  [/\binternet\/telefone\b/g, 'internet telefone'],
  [/\bsal[aá]rios?\b/g, 'salario'],
  [/\bfolha de pagamento\b/g, 'salario'],
];

/**
 * Normalização robusta para comparação. Mantém compatibilidade com a
 * normalização simples antiga (apenas NFD + lowercase + trim) mas adiciona
 * remoção de ruídos comuns em planilhas contábeis.
 */
export function normalizeCategory(input: string): string {
  if (!input) return '';
  let s = String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Remove conteúdo entre parênteses e colchetes (ex: "Aluguel (matriz)")
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  // Remove asteriscos e marcadores
  s = s.replace(/[*#•·°]/g, ' ');
  // Remove pontuação preservando letras/dígitos
  s = s.replace(/[^\p{L}\p{N}\s\/\-]/gu, ' ');
  // Hífen / barra → espaço
  s = s.replace(/[\/\-]+/g, ' ');
  // Aplica correções comuns
  for (const [re, rep] of COMMON_TYPOS) s = s.replace(re, rep);
  // Colapsa espaços
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Tokens significativos (sem stopwords, sem números soltos curtos). */
export function tokenize(input: string): string[] {
  const norm = normalizeCategory(input);
  return norm
    .split(' ')
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

/** Bigramas para Dice. */
function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  const x = s.replace(/\s+/g, '');
  for (let i = 0; i < x.length - 1; i++) out.add(x.slice(i, i + 2));
  return out;
}

/** Coeficiente de Dice em bigramas (0..1). */
export function diceCoefficient(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export interface MatchInput {
  /** Texto bruto vindo da planilha. */
  raw: string;
  /** Map normalizado→target da memória (category_rules). */
  memory: Map<string, string>;
  /** Lista oficial de categorias conhecidas (nomes do chart_of_accounts + modelItems). */
  knownCategories: string[];
}

/**
 * Executa a cascata de matching. Retorna o melhor resultado ou
 * { target: null, method: 'none' } se nada bater acima do limiar fuzzy.
 *
 * IA não é chamada aqui — é fallback externo opcional.
 */
export function matchCategory({ raw, memory, knownCategories }: MatchInput): MatchResult {
  const norm = normalizeCategory(raw);
  if (!norm) return { target: null, score: 0, method: 'none', matchMethod: 'none' };

  // 1) Memory (exato no normalizado) — PRIORIDADE ABSOLUTA
  const mem = memory.get(norm);
  if (mem) return { target: mem, score: 1.0, method: 'memory', matchMethod: 'memory' };

  // Indexa candidatos uma vez
  const candidates = knownCategories.map(c => ({
    name: c,
    norm: normalizeCategory(c),
    tokens: tokenize(c),
  }));

  // 2) Exact
  const exact = candidates.find(c => c.norm === norm);
  if (exact) return { target: exact.name, score: 0.98, method: 'exact', matchMethod: 'existing_system' };

  const inputTokens = tokenize(raw);

  // 3) Alias — conjunto de tokens idêntico
  if (inputTokens.length > 0) {
    const inputSet = new Set(inputTokens);
    const alias = candidates.find(c => {
      if (c.tokens.length !== inputTokens.length) return false;
      return c.tokens.every(t => inputSet.has(t));
    });
    if (alias) return { target: alias.name, score: 0.95, method: 'alias', matchMethod: 'existing_system' };
  }

  // 4) Keyword — todos os tokens do input estão no candidato (ou vice-versa)
  if (inputTokens.length > 0) {
    const inputSet = new Set(inputTokens);
    let best: { name: string; overlap: number } | null = null;
    for (const c of candidates) {
      if (c.tokens.length === 0) continue;
      const candSet = new Set(c.tokens);
      const inputInCand = inputTokens.every(t => candSet.has(t));
      const candInInput = c.tokens.every(t => inputSet.has(t));
      if (inputInCand || candInInput) {
        const overlap = c.tokens.filter(t => inputSet.has(t)).length;
        if (!best || overlap > best.overlap) best = { name: c.name, overlap };
      }
    }
    if (best) return { target: best.name, score: 0.90, method: 'keyword', matchMethod: 'existing_system' };
  }

  // 5) Fuzzy — Dice em bigramas
  let bestFuzzy: { name: string; dice: number } | null = null;
  for (const c of candidates) {
    const d = diceCoefficient(norm, c.norm);
    if (d >= 0.8 && (!bestFuzzy || d > bestFuzzy.dice)) bestFuzzy = { name: c.name, dice: d };
  }
  if (bestFuzzy) {
    // Mapeia Dice [0.80..1.00] → score [0.85..0.89]
    const score = 0.85 + (bestFuzzy.dice - 0.8) * 0.2;
    return {
      target: bestFuzzy.name,
      score: Math.min(0.89, Number(score.toFixed(3))),
      method: 'fuzzy',
      matchMethod: 'existing_system',
    };
  }

  return { target: null, score: 0, method: 'none', matchMethod: 'none' };
}

/** Limiar acima do qual o match é confiável o suficiente para auto-aplicar sem confirmação. */
export const AUTO_APPLY_THRESHOLD = 0.95;
