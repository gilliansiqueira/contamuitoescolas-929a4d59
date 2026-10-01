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

import { readFileSync as _rf } from 'fs';
import { parseCaixaImageText as _pc } from '@/lib/bankStatements/parsers';
it('Caixa Pinheirinho: OCR sem 3 linhas SALDO DIA ainda confere pelo saldo da linha', () => {
  const txt = _rf('src/test/fixtures/caixa_pinheirinho_ocr.txt', 'utf8').split('\n')
    .filter(l => !/^(25|14|09)\/09\/2026 - 00:00:00 000000 SALDO DIA/.test(l)).join('\n');
  const r = _pc(txt);
  expect(r.transactions).toHaveLength(6);
  expect(r.saldoFinalInformado).toBe(352.02);
  expect(r.bloqueiaImportacao).toBe(false);
});

it('Caixa Pinheirinho: sem SALDO DIA em 30/09 usa o saldo do último lançamento do dia', () => {
  const txt = _rf('src/test/fixtures/caixa_pinheirinho_ocr.txt', 'utf8').split('\n')
    .filter(l => !/^30\/09\/2026 - 00:00:00 000000 SALDO DIA/.test(l)).join('\n');
  const r = _pc(txt);
  expect(r.transactions).toHaveLength(6);
  expect(r.bloqueiaImportacao).toBe(false);
  expect(r.saldoFinalInformado).toBe(352.02);
});
