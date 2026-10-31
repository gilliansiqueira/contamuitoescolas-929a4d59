import { describe, it, expect } from 'vitest';
import { novaAncora, totalInformado } from '@/lib/saldoBancos';

describe('saldo dos bancos', () => {
  it('soma os saldos informados e ignora conta sem saldo (C6)', () => {
    expect(totalInformado([{ saldo: 314426.66 }, { saldo: 27.12 }, { saldo: 37000 }, { saldo: 301000 }, { saldo: null }])).toBe(652453.78);
  });
  it('ajusta a âncora para o saldo calculado bater com o informado', () => {
    expect(novaAncora(0, 652453.78, -137654.05)).toBe(790107.83);
  });
});
