import { describe, it, expect } from 'vitest';
import { businessDayDiff, findTransferCounterpart } from '@/lib/bankStatements/bankCashflowEngine';
const tx = (id: string, account_id: string, data: string, tipo: 'entrada' | 'saida', mk = 'normal') =>
  ({ id, account_id, data, valor: 6670.85, tipo, transfer_pair_id: null, movement_kind: mk }) as any;
describe('pareamento de transferências em dias úteis', () => {
  it('sábado 10/10 → segunda 13/10 conta 1 dia útil e pareia', () => {
    expect(businessDayDiff('2026-10-10', '2026-10-13')).toBe(1);
    const s = tx('s', 'stone', '2026-10-10', 'saida', 'transferencia');
    const e = tx('e', 'sicredi', '2026-10-13', 'entrada');
    expect(findTransferCounterpart(s, [s, e])?.id).toBe('e');
  });
  it('3 dias úteis de diferença não pareia', () => {
    const s = tx('s', 'a', '2026-10-05', 'saida', 'transferencia');
    const e = tx('e', 'b', '2026-10-08', 'entrada');
    expect(findTransferCounterpart(s, [s, e])).toBeNull();
  });
});
