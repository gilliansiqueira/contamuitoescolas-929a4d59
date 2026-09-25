import { extractCounterparty as e } from '@/lib/bankStatements/counterparty';
import { test, expect } from 'vitest';
test('x', () => {
  expect(e('DEP CHEQUE CAIXA AGENCIA')).toBe('');
  expect(e('TARIFA PACOTE SERVICOS')).toBe('');
  expect(e('Laura Darold Cariaga - Pix | Maquininha')).toBe('LAURA DAROLD CARIAGA');
  expect(e('PAGAMENTO PIX-PIX_DEB   17688085000145 Even3')).toContain('17688085000145');
});
