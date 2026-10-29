import { describe, it, expect } from 'vitest';
import { parseSponteWorkbook, normalizeContasRows } from '@/lib/renewal/sponteParser';

const notas = [
  ['Nº Parcela', 'Valor', 'Data Vencimento', 'Sacado', 'Forma de Cobrança', 'Valor Pago', 'Data Pgto', 'Valor Líquido', 'Categoria', 'Nº Matrícula'],
  [4, 495, '01/10/2026', 'Daniel Fundão Polese', 'Cartão de Crédito', 420.75, '01/07/2026', 409.85, 'Parcelas de módulo', '8028/4'],
];

describe('Omni "Emissão de notas" (Linhares)', () => {
  it('reconhece a aba mesmo fora da primeira posição e separa matrícula/contrato', () => {
    const p = parseSponteWorkbook([[['Indicador', 'Valor']], notas]);
    expect(p.source).toBe('contas_receber');
    expect(p.rows[0].NumeroMatricula).toBe('8028');
    expect(p.rows[0].NumeroContrato).toBe('8028/4');
    expect(p.rows[0].Situacao).toBe('Pago');
  });
  it('sem pagamento: vencido se já passou, a vencer se não', () => {
    const r = normalizeContasRows([{ DataVencimento: '01/09/2026' }, { DataVencimento: '01/12/2026' }], '2026-10-29');
    expect(r.map(x => x.Situacao)).toEqual(['Vencido', 'A vencer']);
  });
});
