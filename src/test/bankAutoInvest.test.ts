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

import { summarize as _sum } from '@/lib/bankStatements/bankCashflowEngine';
describe('categoria Operação', () => {
  it('sai de entradas/saídas mas continua no saldo', () => {
    const acc: any = { id: 'a', nome: 'A', banco: 'X', agencia: null, conta: null, saldo_inicial: 100, saldo_inicial_data: '2026-08-31', ativa: true };
    const base: any = { account_id: 'a', import_id: 'i', transfer_pair_id: null, recon_status: 'pendente', recon_by_email: null, recon_at: null, recon_note: null, created_at: 'x' };
    const txs: any[] = [
      { ...base, id: '1', data: '2026-09-02', descricao: 'Venda', valor: 50, tipo: 'entrada', movement_kind: 'normal' },
      { ...base, id: '2', data: '2026-09-03', descricao: 'Distribuição de lucros', valor: 30, tipo: 'saida', movement_kind: 'operacao' },
    ];
    const s = _sum([acc], txs, '2026-09-01', '2026-09-30', '2026-09-30');
    expect(s.entradasRealizadas).toBe(50);
    expect(s.saidasRealizadas).toBe(0);
    expect(s.operacoesOut).toBe(30);
    expect(s.saldoAtual).toBe(120);
  });
});

describe('divisão com Ignorar', () => {
  it('800 saída + 200 ignorar: saídas 800, saldo -1000', () => {
    const acc: any = { id: 'a', nome: 'A', banco: 'X', agencia: null, conta: null, saldo_inicial: 0, saldo_inicial_data: '2026-08-31', ativa: true };
    const t: any = { id: '1', account_id: 'a', import_id: 'i', transfer_pair_id: null, recon_status: 'pendente', recon_by_email: null, recon_at: null, recon_note: null, created_at: 'x', data: '2026-09-02', descricao: 'PIX', valor: 1000, tipo: 'saida', movement_kind: 'normal',
      splits: [{ id: 's1', valor: 800, categoria: 'normal', descricao: null, note: null, sort_order: 1 }, { id: 's2', valor: 200, categoria: 'ignorar', descricao: null, note: null, sort_order: 2 }] };
    const s = _sum([acc], [t], '2026-09-01', '2026-09-30', '2026-09-30');
    expect(s.saidasRealizadas).toBe(800);
    expect(s.ignorados).toBe(200);
    expect(s.saldoAtual).toBe(-1000);
  });
});

import { detectOwnTransfer } from '@/lib/bankStatements/bankCashflowEngine';
describe('transferência entre contas próprias', () => {
  it('reconhece razão social e não pega sobrenome', () => {
    expect(detectOwnTransfer('Pix enviado: "Cp :01181521-Pegorer Idiomas LTDA"', ['pegorer idiomas'])).toBe(true);
    expect(detectOwnTransfer('Pix enviado: "Cp :03042597-Camila Kussakari Pegorer"', ['pegorer idiomas'])).toBe(false);
  });
  it('fica fora de entradas/saídas, mas no saldo', () => {
    const acc: any = { id: 'a', nome: 'A', banco: 'X', agencia: null, conta: null, saldo_inicial: 1000, saldo_inicial_data: '2026-08-31', ativa: true };
    const t: any = { id: '1', account_id: 'a', import_id: 'i', transfer_pair_id: null, recon_status: 'pendente', recon_by_email: null, recon_at: null, recon_note: null, created_at: 'x', data: '2026-09-02', descricao: 'Pegorer Idiomas', valor: 300, tipo: 'saida', movement_kind: 'transferencia' };
    const s = _sum([acc], [t], '2026-09-01', '2026-09-30', '2026-09-30');
    expect(s.saidasRealizadas).toBe(0);
    expect(s.transferenciasInternas).toBe(300);
    expect(s.saldoAtual).toBe(700);
  });
});
