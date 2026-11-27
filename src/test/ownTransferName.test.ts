import { describe, it, expect } from 'vitest';
import { detectOwnTransfer } from '@/lib/bankStatements/bankCashflowEngine';
describe('nomes da própria empresa', () => {
  it('reconhece descrição com hífen', () => {
    expect(detectOwnTransfer('PIX RECEBIDO INFLUX 24/11 INFLUX - INGLES E ESPANHOL 08.749.193/0001-90', ['influx ingles e espanhol'])).toBe(true);
  });
  it('não reconhece outra empresa', () => {
    expect(detectOwnTransfer('BOLETO PAGO INFLUX HOLDING E FRANQUIAS LTD', ['influx ingles e espanhol'])).toBe(false);
  });
});
