import { describe, it, expect } from 'vitest';
import { erpAlerts } from '@/lib/teamAlerts';
const names = new Map([['s1', 'WNC']]);
describe('erpAlerts', () => {
  it('avisa quando o Tiny está ligado e desautorizado', () => {
    const a = erpAlerts([{ id: 'c', school_id: 's1', enabled: true, authorized: false, last_error: 'invalid_grant' }], names);
    expect(a).toHaveLength(1);
    expect(a[0].text).toContain('WNC: Tiny desconectado');
  });
  it('não avisa integração desligada ou saudável', () => {
    expect(erpAlerts([{ id: 'c', school_id: 's1', enabled: false, authorized: false, last_error: 'x' }, { id: 'd', school_id: 's1', enabled: true, authorized: true, last_error: null }], names)).toHaveLength(0);
  });
});
