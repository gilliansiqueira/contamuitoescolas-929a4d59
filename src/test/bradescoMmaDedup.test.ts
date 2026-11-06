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
});
