/**
 * SSOT — Categorização de Recebíveis.
 *
 * Categorias canônicas (em ordem de exibição):
 *   - cartao_maquininha (origem = 'cartao' — uploads Stone/maquininha)
 *   - cartao_sponte     (origem = 'sponte' com categoria de cartão)
 *   - sponte_pay        (forma de cobrança contém "sponte pay")
 *   - pix               (PIX / transferência)
 *   - boleto            (boleto / cobrança bancária / mensalidade)
 *   - cheque
 *   - sem_categoria
 *
 * Sponte Pay NUNCA é agrupado com Boleto/PIX/Transferência.
 */
import type { FinancialEntry } from '@/types/financial';
import { CreditCard, Smartphone, Landmark, DollarSign, Ban, Zap } from 'lucide-react';

export type ReceivableCategoryKey =
  | 'cartao_maquininha'
  | 'cartao_sponte'
  | 'sponte_pay'
  | 'pix'
  | 'boleto'
  | 'cheque'
  | 'sem_categoria';

export const RECEIVABLE_ORDER: ReceivableCategoryKey[] = [
  'cartao_maquininha',
  'cartao_sponte',
  'sponte_pay',
  'pix',
  'boleto',
  'cheque',
  'sem_categoria',
];

export const RECEIVABLE_CONFIG: Record<ReceivableCategoryKey, { label: string; icon: typeof CreditCard }> = {
  cartao_maquininha: { label: 'Cartão (Maquininha)', icon: CreditCard },
  cartao_sponte: { label: 'Cartão (Sponte)', icon: CreditCard },
  sponte_pay: { label: 'Sponte Pay', icon: Zap },
  pix: { label: 'PIX / Transferência', icon: Smartphone },
  boleto: { label: 'Boleto / Cobrança', icon: Landmark },
  cheque: { label: 'Cheque', icon: DollarSign },
  sem_categoria: { label: 'Sem Categoria Definida', icon: Ban },
};

export function categorizeReceivable(entry: FinancialEntry): ReceivableCategoryKey {
  const cat = (entry.categoria || '').toLowerCase();
  const desc = (entry.descricao || '').toLowerCase();

  // Sponte Pay — checado ANTES de boleto/PIX para nunca ser agrupado.
  // Marcador vem do campo "Forma de cobrança" na planilha Sponte.
  if (cat.includes('sponte pay') || desc.includes('sponte pay')) return 'sponte_pay';

  // Cartão via Maquininha (Stone): origem = 'cartao'
  if (entry.origem === 'cartao') return 'cartao_maquininha';

  // Cartão via Sponte
  if (entry.origem === 'sponte' && (cat.includes('cartao') || cat.includes('cartão') || cat.includes('credito') || cat.includes('crédito'))) {
    return 'cartao_sponte';
  }

  // Cheque
  if (entry.origem === 'cheque' || cat.includes('cheque')) return 'cheque';

  // PIX / Transferência
  if (cat.includes('pix') || desc.includes('pix') || cat.includes('transferencia') || cat.includes('transferência')) return 'pix';

  // Boleto / Cobrança
  if (cat.includes('boleto') || cat.includes('cobranca') || cat.includes('cobrança') || cat.includes('mensalidade') || cat.includes('bancaria') || cat.includes('bancária')) return 'boleto';

  // Cartão genérico (sem origem específica)
  if (cat.includes('cartao') || cat.includes('cartão') || desc.includes('cartão')) return 'cartao_maquininha';

  if (entry.origem === 'sponte') return 'boleto';

  return 'sem_categoria';
}
