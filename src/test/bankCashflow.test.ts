import { describe, it, expect } from 'vitest';
import { summarize, accountBalance, suggestTransferPairs, type BankAccount, type BankTx } from '@/lib/bankStatements/bankCashflowEngine';
import { parseOFX, parseCSV, computeDedupHashes, parseBRNumber } from '@/lib/bankStatements/parsers';

const acc = (id: string, saldo = 0): BankAccount => ({ id, nome: id, banco: '', agencia: null, conta: null, saldo_inicial: saldo, saldo_inicial_data: '2026-07-31', ativa: true });
const tx = (p: Partial<BankTx>): BankTx => ({ id: Math.random().toString(), account_id: 'A', import_id: 'i', data: '2026-08-05', descricao: 'x', valor: 100, tipo: 'entrada', transfer_pair_id: null, recon_status: 'pendente', recon_by_email: null, recon_at: null, recon_note: null, created_at: '2026-08-05', ...p });

describe('fluxo bancário do piloto', () => {
  it('conciliação não altera saldo', () => {
    const a = [acc('A', 1000)];
    const t1 = [tx({ valor: 200 }), tx({ valor: 50, tipo: 'saida' })];
    const t2 = t1.map(t => ({ ...t, recon_status: 'conciliado' as const }));
    expect(accountBalance(a[0], t1, '2026-08-31')).toBe(1150);
    expect(accountBalance(a[0], t2, '2026-08-31')).toBe(1150);
    expect(summarize(a, t1, '2026-08-01', '2026-08-31', '2026-08-31').saldoAtual).toBe(summarize(a, t2, '2026-08-01', '2026-08-31', '2026-08-31').saldoAtual);
  });

  it('transferência interna fica fora de entradas/saídas, mas mexe no saldo de cada conta', () => {
    const a = [acc('A', 1000), acc('B', 0)];
    const txs = [tx({ account_id: 'A', tipo: 'saida', valor: 300, transfer_pair_id: 'p' }), tx({ account_id: 'B', tipo: 'entrada', valor: 300, transfer_pair_id: 'p' }), tx({ account_id: 'A', valor: 40 })];
    const s = summarize(a, txs, '2026-08-01', '2026-08-31', '2026-08-31');
    expect(s.entradasRealizadas).toBe(40);
    expect(s.saidasRealizadas).toBe(0);
    expect(s.saldoAtual).toBe(1040);
    expect(accountBalance(a[1], txs, '2026-08-31')).toBe(300);
  });

  it('sugere par de transferência', () => {
    const p = suggestTransferPairs([tx({ account_id: 'A', tipo: 'saida', valor: 300 }), tx({ account_id: 'B', tipo: 'entrada', valor: 300, data: '2026-08-06' })]);
    expect(p).toHaveLength(1);
  });

  it('pendências e percentual', () => {
    const s = summarize([acc('A')], [tx({}), tx({ recon_status: 'conciliado' }), tx({ recon_status: 'nao_se_aplica' })], '2026-08-01', '2026-08-31', '2026-08-31');
    expect(s.pendentesQtd).toBe(1);
    expect(Math.round(s.percentConciliado)).toBe(67);
  });
});

describe('leitores e duplicidade', () => {
  it('lê OFX', () => {
    const r = parseOFX('<BANKID>001<STMTTRN><DTPOSTED>20260805<TRNAMT>-10.50<FITID>abc<MEMO>Tarifa</STMTTRN><STMTTRN><DTPOSTED>20260806<TRNAMT>200<FITID>def<MEMO>PIX</STMTTRN>');
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0]).toMatchObject({ tipo: 'saida', valor: 10.5, bankRef: 'abc' });
  });
  it('lê CSV brasileiro', () => {
    const r = parseCSV('Data;Descrição;Valor\n05/08/2026;PIX recebido;1.500,50\n06/08/2026;Tarifa;-12,00');
    expect(r.transactions).toEqual([
      { data: '2026-08-05', descricao: 'PIX recebido', valor: 1500.5, tipo: 'entrada' },
      { data: '2026-08-06', descricao: 'Tarifa', valor: 12, tipo: 'saida' },
    ]);
  });
  it('mesmo arquivo gera as mesmas chaves; lançamentos idênticos no dia não colidem', async () => {
    const t = { data: '2026-08-05', descricao: 'Tarifa', valor: 5, tipo: 'saida' as const };
    const h1 = await computeDedupHashes('A', [t, t]);
    const h2 = await computeDedupHashes('A', [t, t]);
    expect(h1[0]).not.toBe(h1[1]);
    expect(h1).toEqual(h2);
  });
  it('número brasileiro', () => {
    expect(parseBRNumber('1.234,56')).toBe(1234.56);
    expect(parseBRNumber('(10,00)')).toBe(-10);
  });
});
