import { normalizeAccount, resolveBankCode } from './identity';

/** Saving a cash/manual account is not the same as authorizing a statement import. */
export function validateAccountRegistration(account: { banco: string; bankCode: string; holderDocument: string; holderEntityId: string }, entities: { id: string; cnpj: string }[]): void {
  if (account.bankCode.trim() && !resolveBankCode(account.banco, account.bankCode.trim())) throw new Error('Código do banco inválido ou incompatível com o banco informado.');
  const document = normalizeAccount(account.holderDocument);
  if (account.holderDocument.trim() && !/^(?:\d{11}|\d{14})$/.test(document)) throw new Error('CPF/CNPJ do titular inválido.');
  if (account.holderEntityId) {
    const entity = entities.find(e => e.id === account.holderEntityId);
    if (!entity || (document && normalizeAccount(entity.cnpj) !== document)) throw new Error('Documento diverge do titular específico cadastrado ou vínculo inválido.');
  }
}