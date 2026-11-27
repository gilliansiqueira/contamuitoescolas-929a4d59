import { describe, it, expect } from 'vitest';
import { accountBalances, type BankAccount, type BankTx } from '@/lib/bankStatements/bankCashflowEngine';
import { projectEntries } from '@/lib/projectionEngine';
import { applyCashflowOverlay } from '@/lib/bankCashflowOverlay';

const tx = (p: Partial<BankTx>): BankTx => ({ id: Math.random().toString(), account_id: 'S', import_id: 'i', data: '2026-11-13', descricao: 'APLIC. FINANC.', valor: 10000, tipo: 'saida', transfer_pair_id: null, recon_status: 'pendente', recon_by_email: null, recon_at: null, recon_note: null, created_at: '', movement_kind: 'auto_aplicacao', ...p });

describe('saldo do Fluxo Bancário igual ao Dashboard', () => {
  it('aplicação lançada em conta sem aplicação automática continua no total depois do extrato (Sicredi Rondonópolis)', () => {
    const acc: BankAccount = { id: 'S', nome: 'Sicredi', banco: 'Sicredi', agencia: null, conta: null, saldo_inicial: 577.35, saldo_inicial_data: '2026-08-31', ativa: true, has_auto_invest: false,
      anchors: [{ id: 'a', data: '2026-11-20', saldo_conta: 7028.67, saldo_aplicado: 10000, aplicado_calc: true } as any] };
    const b = accountBalances(acc, [tx({}), tx({ data: '2026-11-24', valor: 15000 })], '2026-11-27');
    expect(b.aplicado).toBe(25000);
    expect(b.emConta).toBe(-7971.33 + 0); // 7.028,67 − 15.000 depois da âncora
    expect(b.total).toBe(17028.67);
  });

  it('linha do extrato "A classificar" mexe no saldo mesmo com modelo sem esse item (Obras, R$ 4.000)', () => {
    const entries = applyCashflowOverlay([], [{ id: '1', data: '2026-10-07', descricao: 'Rodrigo', valor: 4000, tipo: 'saida', tipo_nome: 'A classificar' }], '2026-09-01', 's');
    const model = { hasModel: true, isInModel: (l: string) => ['despesas', 'receita'].includes(l.toLowerCase()), items: [] } as any;
    const out = projectEntries(entries, [], [], model);
    expect(out).toHaveLength(1);
    expect(out[0].impacto).toBe(-4000);
  });
});
