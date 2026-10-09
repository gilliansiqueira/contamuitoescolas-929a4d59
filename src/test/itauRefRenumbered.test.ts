import { describe, it, expect } from 'vitest';
import { sameRefTx, sameBankEntryText, refCollisionHash, computeDedupHashes } from '@/lib/bankStatements/parsers';

describe('Itaú renumera o código do lançamento entre downloads', () => {
  const casanAntigo = { data: '2026-09-30', tipo: 'saida', valor: 311.81 };
  const leonardo = { data: '2026-09-30', tipo: 'entrada' as const, valor: 50, descricao: 'PIX RECEBIDO LEONARD30/09 LEONARDO PADILHA CARVALHO', bankRef: '20260930014' };
  it('mesmo código com outro valor/sentido não é duplicado', async () => {
    expect(sameRefTx(casanAntigo, leonardo as any)).toBe(false);
    const [h] = await computeDedupHashes('A', [leonardo as any]);
    expect(await refCollisionHash('A', leonardo as any)).not.toBe(h);
  });
  it('mesmo código com mesmos dados continua duplicado', () => {
    expect(sameRefTx({ data: '2026-09-30', tipo: 'entrada', valor: '50.00' }, leonardo as any)).toBe(true);
  });
});

describe('Bradesco reaproveita o código antigo em outro lançamento', () => {
  it('mesmo código, dia e valor mas outra pessoa = lançamento diferente', () => {
    const taiane = { data: '2026-10-05', tipo: 'entrada', valor: 315, descricao: 'PIX RECEBIDO REM: TAIANE DE ASSIS TRIND 04/10' };
    const raimundo = { data: '2026-10-05', tipo: 'entrada' as const, valor: 315, descricao: 'PIX RECEBIDO REM: RAIMUNDO MARQUES DOS  05/10', bankRef: 'N102BE' };
    expect(sameRefTx(taiane, raimundo)).toBe(false);
    expect(sameRefTx(taiane, { ...raimundo, descricao: taiane.descricao })).toBe(true);
  });
});

describe('Banco muda a descrição do mesmo lançamento', () => {
  const base = { data: '2026-10-06', tipo: 'entrada' as const, valor: 2.1, bankRef: '20261006003' };
  it('Itaú APR × MAIS = mesmo lançamento', () => {
    expect(sameRefTx({ ...base, descricao: 'REND PAGO APLIC AUT APR' }, { ...base, descricao: 'RENDIMENTOS REND PAGO APLIC AUT MAIS' })).toBe(true);
  });
  it('BB Rende Fácil e CDL = mesmo lançamento', () => {
    expect(sameRefTx({ ...base, descricao: 'BB RENDE FÁCIL' }, { ...base, descricao: 'BB RENDE FÁCIL - RENDE FACIL' })).toBe(true);
    expect(sameRefTx({ ...base, descricao: 'BOLETO PAGO CDL - CAM.DI CDL - CAM.DIR.LOJISTAS FPOLIS 83.901.660/0001-70' }, { ...base, descricao: 'BOLETO PAGO CDL - CAM.DIR.LOJISTAS FPOLIS 83.901.660/0001-70' })).toBe(true);
  });
  it('Pix de pessoas diferentes continua diferente', () => {
    expect(sameRefTx({ ...base, descricao: 'PIX RECEBIDO REM: IARA MARINHO NAZARE   03/10' }, { ...base, descricao: 'PIX RECEBIDO REM: ADRIA EMILY RIBEIRO D 05/10' })).toBe(false);
    expect(sameRefTx({ ...base, descricao: 'PIX RECEBIDO REM: C RODRIGUES BRASIL    03/10' }, { ...base, descricao: 'PIX RECEBIDO REM: RAIMUNDO MARQUES DOS  05/10' })).toBe(false);
  });
});

describe('Bradesco: PDF × OFX do mesmo dia com textos diferentes (Fazenda, 02–07/10)', () => {
  it('hífen, TRANSF.AUTORIZ × TRANSF CC, resgate e texto encurtado = mesmo lançamento', () => {
    expect(sameBankEntryText('PAGTO ELETRONICO TRIBUTO - INTERNET --RECEITA FEDERAL/SP', 'PAGTO ELETRONICO TRIBUTO INTERNET --RECEITA FEDERAL/SP')).toBe(true);
    expect(sameBankEntryText('TRANSF.AUTORIZ.ENTRE C/C ANY CLAUDIA FERREIRA', 'TRANSF CC PARA CC ANY CLAUDIA FERREIRA')).toBe(true);
    expect(sameBankEntryText('RESG AUTOMATICO INVESTIM', 'RESG/VENCTO CDB')).toBe(true);
    expect(sameBankEntryText('PAGTO ELETRON  COBRANCA', 'PAGTO ELETRON  COBRANCA PAG COBRANCA NET EMPRESA')).toBe(true);
    expect(sameBankEntryText('PIX ENVIADO - DES: Jean Lucas Jardim 02/10', 'PIX ENVIADO DES: Jean Lucas Jardim     02/10')).toBe(true);
  });
  it('pessoas diferentes continuam separadas', () => {
    expect(sameBankEntryText('PIX RECEBIDO REM: TAIANE DE ASSIS TRIND 04/10', 'PIX RECEBIDO REM: RAIMUNDO MARQUES DOS  05/10')).toBe(false);
    expect(sameBankEntryText('TRANSF CC PARA CC ANTONIO GUILHERME PINHEIRO', 'TRANSF CC PARA CC MIRIAM CELESTE SOUZA OLIVEIRA')).toBe(false);
    expect(sameBankEntryText('RESG/VENCTO CDB', 'REND PAGO APLIC AUT')).toBe(false);
  });
});
