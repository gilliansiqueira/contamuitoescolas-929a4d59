import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCaixaImageText } from '@/lib/bankStatements/parsers';

describe('Caixa PDF somente-imagem (Pinheirinho)', () => {
  const text = readFileSync(join(__dirname, 'fixtures/caixa_pinheirinho_ocr.txt'), 'utf8');
  it('lê todos os lançamentos e fecha com os saldos diários', () => {
    const r = parseCaixaImageText(text);
    expect(r.bloqueiaImportacao).toBe(false);
    expect(r.transactions.length).toBe(6);
    expect(r.saldoFinalInformado).toBeCloseTo(352.02, 2);
    expect(r.periodoFim).toBe('2026-09-30');
    const pix = r.transactions.find(t => t.descricao.includes('CRED PIX'));
    expect(pix?.tipo).toBe('entrada');
    expect(pix?.valor).toBeCloseTo(10259.71, 2);
  });
  it('bloqueia quando um valor não fecha', () => {
    const r = parseCaixaImageText(text.replace('108,80 D', '108,90 D'));
    expect(r.bloqueiaImportacao).toBe(true);
  });
});
