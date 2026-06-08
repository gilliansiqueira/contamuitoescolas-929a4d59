import type { FinancialEntry, TypeClassification } from '@/types/financial';

export interface LedgerRule {
  impactaCaixa: boolean;
  entraNoResultado: boolean;
  operacaoSinal: 'somar' | 'subtrair';
  label?: string;
}

/**
 * Normalização canônica de tipo (lowercase, sem acentos, trim).
 */
export function normalizeTipo(s: string): string {
  if (!s) return '';
  return s
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Tabela de fallbacks estáticos oficiais (DEFAULT_MAPPINGS) para garantir
 * consistência na Projeção de forma out-of-the-box.
 */
export const DEFAULT_MAPPINGS: Record<string, LedgerRule> = {
  'receita': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'somar' },
  'despesa': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'despesas': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'saida': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'saidas': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'distribuicao de lucros': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'investimento': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'resgate de investimento': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'transferencia entre contas': { entraNoResultado: false, impactaCaixa: false, operacaoSinal: 'somar' },
  'transferencia': { entraNoResultado: false, impactaCaixa: false, operacaoSinal: 'somar' },
  'entrada aporte': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'saida aporte': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'pro-labore': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'pro labore': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'compra da escola': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'resgate': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'aplicacao': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'aplicacoes': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'entrada emprestimo': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'saida emprestimo': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'entrada devolucao': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'saida devolucao': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'subtrair' },
  'ignorar': { entraNoResultado: false, impactaCaixa: false, operacaoSinal: 'somar' },
  'antecipacao': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'antecipacoes': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'rendimento': { entraNoResultado: false, impactaCaixa: true, operacaoSinal: 'somar' },
  'aplicacao e resgate automatico': { entraNoResultado: false, impactaCaixa: false, operacaoSinal: 'somar' },
  'aplicacao e resgate': { entraNoResultado: false, impactaCaixa: false, operacaoSinal: 'somar' },
};

/**
 * MOTOR CENTRAL DE RESOLUÇÃO DE REGRAS FINANCEIRAS.
 * 
 * Processa a transação em tempo de execução consultando a tabela de classificações.
 * Se não existir uma configuração explícita no banco de dados e nem no mapeamento estático,
 * retorna a regra padrão: impactaCaixa = false, entraNoResultado = false, operacaoSinal = "somar".
 */
/**
 * Item mínimo do Modelo Financeiro usado como fallback de classificação.
 * Quando a escola tem um modelo atribuído e o tipo aparece nele, suas
 * propriedades (tipo/impacta_caixa/entra_no_resultado) são usadas como
 * regra antes do fallback absoluto. Isso garante que linhas presentes no
 * Modelo (ex.: "Reembolso Outras Unidades") sejam contabilizadas mesmo
 * sem uma entrada explícita em `type_classifications`.
 */
export interface ModelItemRule {
  name: string;
  tipo: 'entrada' | 'saida' | 'ignorar';
  impacta_caixa: boolean;
  entra_no_resultado: boolean;
}

function modelItemToRule(item: ModelItemRule, originalKey: string): LedgerRule {
  if (item.tipo === 'ignorar') {
    return { impactaCaixa: false, entraNoResultado: false, operacaoSinal: 'somar', label: item.name || originalKey };
  }
  return {
    impactaCaixa: !!item.impacta_caixa,
    entraNoResultado: !!item.entra_no_resultado,
    operacaoSinal: item.tipo === 'saida' ? 'subtrair' : 'somar',
    label: item.name || originalKey,
  };
}

export function resolveLedgerRule(
  tipoKey: string,
  classifications: TypeClassification[],
  modelItems: ModelItemRule[] = []
): LedgerRule {
  const normalizedKey = normalizeTipo(tipoKey);

  // 1. Procura na tabela de configurações da empresa (type_classifications)
  const cfg = classifications.find(c => normalizeTipo(c.tipoValor) === normalizedKey);
  if (cfg) {
    const isIgnorar = cfg.classificacao === 'ignorar';
    const impactaCaixa = isIgnorar ? false : (cfg.impactaCaixa ?? false);
    const entraNoResultado = isIgnorar ? false : (cfg.entraNoResultado ?? false);

    let operacaoSinal: 'somar' | 'subtrair' = 'somar';
    if (cfg.operacaoSinal === 'subtrair') {
      operacaoSinal = 'subtrair';
    } else if (cfg.operacaoSinal === 'somar') {
      operacaoSinal = 'somar';
    } else {
      // Fallback por classificação legada se sinal não estiver explícito
      operacaoSinal = cfg.classificacao === 'despesa' ? 'subtrair' : 'somar';
    }

    return {
      impactaCaixa,
      entraNoResultado,
      operacaoSinal,
      label: cfg.label || tipoKey
    };
  }

  // 2. Procura no mapeamento padrão em memória
  const def = DEFAULT_MAPPINGS[normalizedKey];
  if (def) {
    return {
      ...def,
      label: tipoKey
    };
  }

  // 3. Procura no Modelo Financeiro da escola (quando fornecido).
  //    Itens do modelo carregam a regra de impacto/resultado configurada
  //    no template, evitando que tipos válidos do modelo sejam ignorados
  //    apenas por não terem linha em `type_classifications`.
  if (modelItems.length > 0) {
    const item = modelItems.find(i => normalizeTipo(i.name) === normalizedKey);
    if (item) return modelItemToRule(item, tipoKey);
  }

  // 4. REGRA ABSOLUTA DE FALLBACK: se não existir configuração nem padrão
  return {
    impactaCaixa: false,
    entraNoResultado: false,
    operacaoSinal: 'somar',
    label: tipoKey
  };
}


/**
 * Resolve a regra do ledger para uma entry tentando, em ordem:
 *   tipoOriginal → categoria → tipo
 * Garante que entries projetadas (tipoOriginal vazio) sejam classificadas
 * pelo nome da categoria configurada em type_classifications.
 */
export function resolveEntryTipoKey(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): string {
  const candidates = [entry.tipoOriginal, entry.categoria, entry.tipo].filter(
    (s): s is string => !!s && s.trim() !== ''
  );
  for (const key of candidates) {
    const norm = normalizeTipo(key);
    const cfg = classifications.find(c => normalizeTipo(c.tipoValor) === norm);
    if (cfg) return key;
    if (DEFAULT_MAPPINGS[norm]) return key;
  }
  return candidates[0] || entry.tipo;
}

/**
 * Origens cuja classificação NUNCA pode ser sobrescrita pelas regras de
 * `type_classifications`. Esses uploads (Sponte, Cheques, Cartões, Contas a
 * Pagar) representam dados projetados/operacionais e SEMPRE entram como
 * receita (entrada) ou despesa (saida) — as regras de "Ignorar" e demais
 * classificações só se aplicam ao Fluxo de Caixa Realizado e ao Histórico
 * Financeiro digitado.
 */
const ORIGENS_SEMPRE_CLASSIFICADAS = new Set([
  'sponte',
  'cheque',
  'cartao',
  'contas_pagar',
]);

function defaultRuleForTipo(tipo: 'entrada' | 'saida'): LedgerRule {
  return tipo === 'entrada'
    ? { impactaCaixa: true, entraNoResultado: true, operacaoSinal: 'somar' }
    : { impactaCaixa: true, entraNoResultado: true, operacaoSinal: 'subtrair' };
}

export function resolveEntryLedgerRule(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): LedgerRule {
  if (entry.origem && ORIGENS_SEMPRE_CLASSIFICADAS.has(entry.origem)) {
    return defaultRuleForTipo(entry.tipo);
  }
  return resolveLedgerRule(resolveEntryTipoKey(entry, classifications), classifications);
}

/**
 * Retorna o impacto absoluto de saldo de uma transação.
 */
export function getLedgerSaldoImpact(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): number {
  if (entry.editadoManualmente) {
    const sinal = entry.tipo === 'entrada' ? 'somar' : 'subtrair';
    return sinal === 'somar' ? entry.valor : -entry.valor;
  }

  if (entry.origem && ORIGENS_SEMPRE_CLASSIFICADAS.has(entry.origem)) {
    return entry.tipo === 'entrada' ? entry.valor : -entry.valor;
  }

  const rule = resolveEntryLedgerRule(entry, classifications);
  if (!rule.impactaCaixa) return 0;
  return rule.operacaoSinal === 'somar' ? entry.valor : -entry.valor;
}


/**
 * MOTOR CENTRAL DE PROCESSAMENTO E CONSOLIDAÇÃO FINANCEIRA.
 */
export function processLedger(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
) {
  let receitas = 0;
  let despesas = 0;
  let operacoesIn = 0;
  let operacoesOut = 0;
  let saldoMovimento = 0;

  for (const e of entries) {
    const impact = getLedgerSaldoImpact(e, classifications);
    saldoMovimento += impact;

    const rule = e.editadoManualmente
      ? {
          impactaCaixa: true,
          entraNoResultado: true,
          operacaoSinal: e.tipo === 'entrada' ? ('somar' as const) : ('subtrair' as const)
        }
      : resolveEntryLedgerRule(e, classifications);

    if (rule.entraNoResultado) {
      if (rule.operacaoSinal === 'somar') {
        receitas += e.valor;
      } else {
        despesas += e.valor;
      }
    } else if (rule.impactaCaixa) {
      if (rule.operacaoSinal === 'somar') {
        operacoesIn += e.valor;
      } else {
        operacoesOut += e.valor;
      }
    }
  }

  return {
    receitas,
    despesas,
    resultado: receitas - despesas,
    operacoesIn,
    operacoesOut,
    saldoMovimento,
  };
}
