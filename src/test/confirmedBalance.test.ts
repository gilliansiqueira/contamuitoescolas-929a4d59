import { describe, expect, it } from 'vitest';
import { confirmedBankBalance } from '@/lib/bankStatements/confirmedBalance';
import { applyCashflowOverlay } from '@/lib/bankCashflowOverlay';
import type { BankAccount } from '@/lib/bankStatements/bankCashflowEngine';

const account = (id: string, date = '2026-09-28', amount = 0): BankAccount => ({
  id, nome: id, banco: id, agencia: null, conta: null, saldo_inicial: 0, saldo_inicial_data: null, ativa: true,
  anchors: [{ id, data: date, saldo_conta: amount, saldo_aplicado: 0 }],
});

describe('fotografia bancária e futuros', () => {
  it('soma somente contas ativas com extratos conferidos na mesma data', () => {
    expect(confirmedBankBalance([account('BB', '2026-09-28', 7446.64), account('Sicredi', '2026-09-28', 9343.82), account('Stone')]))
      .toEqual({ date: '2026-09-28', balance: 16790.46 });
    expect(confirmedBankBalance([account('BB'), account('Sicredi', '2026-09-27')])).toBeNull();
    expect(confirmedBankBalance([account('BB'), { ...account('Sicredi'), anchors: [] }])).toBeNull();
  });

  it('futuros do extrato permanecem projetados, sem mudar valores nem identificadores', () => {
    const rows = [
      { id: '1', data: '2026-09-28', descricao: 'Pix', valor: 100, tipo: 'entrada' as const, tipo_nome: 'Receita', is_forecast: false },
      { id: '2', data: '2026-09-30', descricao: 'Boleto', valor: 1466.53, tipo: 'saida' as const, tipo_nome: 'Despesa', is_forecast: true },
    ];
    const entries = applyCashflowOverlay([], rows, '2026-09-01', 'escola');
    expect(entries.map(e => [e.id, e.valor, e.origem, e.tipoRegistro])).toEqual([
      ['bcf-1', 100, 'fluxo', 'realizado'], ['bcf-2', 1466.53, 'fluxo', 'projetado'],
    ]);
  });
});