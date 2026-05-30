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
  'rendimento': { entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'somar' },
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
export function resolveLedgerRule(
  tipoKey: string,
  classifications: TypeClassification[]
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

  // 3. REGRA ABSOLUTA DE FALLBACK: se não existir configuração nem padrão
  return {
    impactaCaixa: false,
    entraNoResultado: false,
    operacaoSinal: 'somar',
    label: tipoKey
  };
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

  const rule = resolveLedgerRule(entry.tipoOriginal || entry.tipo, classifications);
  if (!rule.impactaCaixa) return 0;
  return rule.operacaoSinal === 'somar' ? entry.valor : -entry.valor;
}

/**
 * MOTOR CENTRAL DE PROCESSAMENTO E CONSOLIDAÇÃO FINANCEIRA.
 * 
 * É a ÚNICA fonte de verdade no cálculo de saldo e resultado do sistema.
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
    // Saldo é computado exclusivamente a partir do impacto do Ledger
    const impact = getLedgerSaldoImpact(e, classifications);
    saldoMovimento += impact;

    // Resoluções de regra genérica
    const rule = e.editadoManualmente
      ? {
          impactaCaixa: true,
          entraNoResultado: true,
          operacaoSinal: e.tipo === 'entrada' ? ('somar' as const) : ('subtrair' as const)
        }
      : resolveLedgerRule(e.tipoOriginal || e.tipo, classifications);

    // DRE / Resultado
    if (rule.entraNoResultado) {
      if (rule.operacaoSinal === 'somar') {
        receitas += e.valor;
      } else {
        despesas += e.valor;
      }
    } else if (rule.impactaCaixa) {
      // Movimentações que impactam o saldo mas estão fora do resultado operacional
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
