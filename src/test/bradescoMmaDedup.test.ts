import { describe, it, expect } from 'vitest';
import { sameBankEntryText } from '@/lib/bankStatements/parsers';

describe('Bradesco: mesmo resgate com textos diferentes entre arquivos', () => {
  it('MMA TITULARIDADE e AUTORIZ ENTRE C/C sem nome são o mesmo lançamento', () => {
    expect(sameBankEntryText('TRANSF.MMA.TITULARIDADE*', 'TRANSF.AUTORIZ.ENTRE C/C')).toBe(true);
  });
  it('transferência autorizada para uma pessoa não é resgate', () => {
    expect(sameBankEntryText('TRANSF.MMA.TITULARIDADE*', 'TRANSF.AUTORIZ.ENTRE C/C KASSIANO ROTTA')).toBe(false);
  });
  it('PIX de pessoas diferentes com mesmo valor continuam separados', () => {
    expect(sameBankEntryText('PIX RECEBIDO REM: URBAN COMERCIO VAREJI 04/11', 'PIX RECEBIDO REM: ITAIARA PEREIRA DA SI 04/11')).toBe(false);
  });
  it('depósito e anuidade do cartão com texto trocado entre downloads são o mesmo lançamento', () => {
    expect(sameBankEntryText('DEPOSITO C/C BDN', 'DEP DINHEIRO ATM AG02045MAQ030405SEQ00668')).toBe(true);
    expect(sameBankEntryText('PROVISAO GASTO CART CRED', 'CARTAO CREDITO ANUIDADE')).toBe(true);
  });
  it('depósito não casa com anuidade do cartão', () => {
    expect(sameBankEntryText('DEPOSITO C/C BDN', 'CARTAO CREDITO ANUIDADE')).toBe(false);
  });
});
