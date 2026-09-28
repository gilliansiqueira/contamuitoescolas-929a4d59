import { describe, expect, it } from 'vitest';
import { computeDedupHashes, parseItauImageText } from '@/lib/bankStatements/parsers';

const OCR = `
Itaú Uniclass
saldo em conta R$ 22.719,31 Limite da Conta utilizado R$ 0,00
extrato conta corrente lançamentos
período de visualização: de 31/08/2026 até 28/09/2026
30/08/2026 SALDO ANTERIOR 7.735,00
04/09/2026 SALDO TOTAL DISPONÍVEL DIA 7.635,36
04/09/2026 PIX QRS CARREFOUR C04/09 -99,80
04/09/2026 REND PAGO APLIC AUT MAIS 0,16
08/09/2026 SALDO TOTAL DISPONÍVEL DIA 3.343,78
08/09/2026 FATURA UNICLASS MULT BLACK -26.296,76
08/09/2026 SISPAG PIX NASCIMENTO REFORM... 22.000,00
08/09/2026 REND PAGO APLIC AUT MAIS 5,18
10/09/2026 SALDO TOTAL DISPONÍVEL DIA 3.253,54
10/09/2026 PIX QRS PEX10/09 -77,89
10/09/2026 SEGURO CARTAO 0000 -12,43
10/09/2026 REND PAGO APLIC AUT MAIS 0,08
18/09/2026 SALDO TOTAL DISPONÍVEL DIA 22.717,57
18/09/2026 PIX QRS COMERCIAL D18/09 -97,63
18/09/2026 PIX QRS RESTAURANTE18/09 -30,14
18/09/2026 PIX TRANSF GARRA T18/09 10.000,00
18/09/2026 PIX TRANSF NOELIA 18/09 9.591,80
`;

describe('PDF Itaú somente-imagem', () => {
  it('lê as linhas, preserva os sinais e fecha pelos saldos diários', () => {
    const r = parseItauImageText(OCR);
    expect(r.transactions).toHaveLength(12);
    expect(r.transactions.find(t => t.valor === 26296.76)?.tipo).toBe('saida');
    expect(r.transactions.find(t => t.valor === 22000)?.tipo).toBe('entrada');
    expect(r.saldoFinalInformado).toBe(22717.57);
    expect(r.saldoAtualCabecalho).toBe(22719.31);
    expect(r.bloqueiaImportacao).toBe(false);
    expect(r.avisos.join(' ')).toContain('R$ 1,74');
  });

  it('bloqueia e identifica a data quando uma linha reconhecida não fecha', () => {
    const r = parseItauImageText(OCR.replace('-77,89', '-70,00'));
    expect(r.bloqueiaImportacao).toBe(true);
    expect(r.divergencias?.join(' ')).toContain('10/09/2026');
    expect(r.divergencias?.join(' ')).toContain('R$ 7,89');
  });

  it('mantém hashes iguais ao reler o mesmo arquivo', async () => {
    const txs = parseItauImageText(OCR).transactions;
    expect(await computeDedupHashes('itau-pf', txs)).toEqual(await computeDedupHashes('itau-pf', txs));
  });
});