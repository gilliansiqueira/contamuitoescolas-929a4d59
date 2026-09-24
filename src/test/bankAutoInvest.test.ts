import { describe, it, expect } from 'vitest';
import { accountBalances, summarize, detectMovementKind, DEFAULT_AUTO_INVEST_PATTERNS, type BankAccount, type BankTx } from '@/lib/bankStatements/bankCashflowEngine';

const acc: BankAccount = { id: 'A', nome: 'BB', banco: 'BB', agencia: null, conta: null, saldo_inicial: 599, saldo_inicial_data: '2026-08-31', ativa: true, has_auto_invest: true, auto_invest_saldo_inicial: 122078.73, auto_invest_saldo_data: '2026-08-31' };
const tx = (p: Partial<BankTx>): BankTx => ({ id: Math.random().toString(), account_id: 'A', import_id: 'i', data: '2026-09-01', descricao: 'x', valor: 100, tipo: 'entrada', transfer_pair_id: null, recon_status: 'pendente', recon_by_email: null, recon_at: null, recon_note: null, created_at: '', movement_kind: 'normal', ...p });

describe('aplicação automática', () => {
  it('detecta BB Rende Fácil pelo sentido', () => {
    expect(detectMovementKind('BB RENDE FÁCIL - RENDE FACIL', 'saida', DEFAULT_AUTO_INVEST_PATTERNS)).toBe('auto_aplicacao');
    expect(detectMovementKind('BB RENDE FÁCIL', 'entrada', DEFAULT_AUTO_INVEST_PATTERNS)).toBe('auto_resgate');
    expect(detectMovementKind('PIX - RECEBIDO', 'entrada', DEFAULT_AUTO_INVEST_PATTERNS)).toBe('normal');
  });
  it('aplicação e resgate não mudam o total nem entradas/saídas', () => {
    const txs = [tx({ valor: 1000 }), tx({ valor: 900, tipo: 'saida', movement_kind: 'auto_aplicacao' }), tx({ valor: 200, movement_kind: 'auto_resgate' })];
    const b = accountBalances(acc, txs, '2026-09-30');
    expect(b.emConta).toBe(899);
    expect(b.aplicado).toBe(122778.73);
    expect(b.total).toBe(123677.73);
    const s = summarize([acc], txs, '2026-09-01', '2026-09-30', '2026-09-30');
    expect(s.entradasRealizadas).toBe(1000);
    expect(s.saidasRealizadas).toBe(0);
    expect(s.saldoAtual).toBe(123677.73);
  });
  it('conciliar não altera nenhum dos dois saldos', () => {
    const txs = [tx({ valor: 900, tipo: 'saida', movement_kind: 'auto_aplicacao' })];
    expect(accountBalances(acc, txs.map(t => ({ ...t, recon_status: 'conciliado' as const })), '2026-09-30')).toEqual(accountBalances(acc, txs, '2026-09-30'));
  });
});

import { decodeBankText } from '@/lib/bankStatements/parsers';
describe('acentos do extrato', () => {
  it('lê OFX em Windows-1252', () => {
    const buf = new Uint8Array([0x46, 0xc1, 0x43, 0x49, 0x4c]).buffer; // "FÁCIL" em 1252
    expect(decodeBankText(buf)).toBe('FÁCIL');
    expect(detectMovementKind('BB RENDE F\uFFFDCIL', 'saida', DEFAULT_AUTO_INVEST_PATTERNS)).toBe('auto_aplicacao');
  });
});
