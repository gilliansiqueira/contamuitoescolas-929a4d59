/**
 * Extrai a contraparte (nome ou CPF/CNPJ) da descrição de um lançamento bancário.
 * Retorna '' quando a descrição é genérica (tarifa, IOF, depósito, rendimento…).
 * Uso exclusivamente informativo (avisos) — não afeta valores nem classificação.
 */
const GENERIC = new Set([
  'PIX', 'PAGAMENTO', 'PAGTO', 'PAG', 'PGTO', 'DEB', 'DEBITO', 'CRED', 'CREDITO', 'EMIT', 'EMITIDO', 'REC', 'RECEB',
  'RECEBIDO', 'RECEBIMENTO', 'ENVIADO', 'TED', 'DOC', 'TRANSF', 'TRANSFERENCIA', 'TEF', 'DEP', 'DEPOSITO', 'CHEQUE',
  'CH', 'CAIXA', 'AGENCIA', 'AG', 'TARIFA', 'TAR', 'IOF', 'JUROS', 'RENDIMENTO', 'RENDIMENTOS', 'REND', 'APLICACAO',
  'APLIC', 'RESGATE', 'RESG', 'AUTOMATICO', 'AUTOMATICA', 'AUT', 'MAQUININHA', 'BOLETO', 'TITULO', 'COBRANCA',
  'CONVENIO', 'SAQUE', 'ESTORNO', 'DEVOLUCAO', 'COMPRA', 'CARTAO', 'CONTA', 'CC', 'CP', 'DE', 'DA', 'DO', 'PARA',
  'EM', 'E', 'LIQ', 'LIQUIDACAO', 'MESMA', 'TITULARIDADE', 'INTERNET', 'BANKING', 'MOBILE', 'SICOOB', 'SICREDI',
  'BB', 'INTER', 'OUTRA', 'OUTRO', 'BANCO', 'VALOR', 'SALDO', 'TAXA', 'TX', 'MANUT', 'MANUTENCAO', 'PACOTE', 'SERVICOS',
]);

export function extractCounterparty(descricao: string | null | undefined): string {
  const s = String(descricao ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const doc = s.replace(/[.\-/]/g, '').match(/\b(\d{14}|\d{11})\b/)?.[1] ?? '';
  const words = s.replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/)
    .filter(w => w && !/\d/.test(w) && !GENERIC.has(w) && w.length >= 2);
  const name = words.join(' ');
  const hasName = words.some(w => w.length >= 3);
  if (!hasName && !doc) return '';
  return [doc, hasName ? name : ''].filter(Boolean).join(' ').trim();
}
