import { describe, it, expect } from 'vitest';
import { businessDays, computeBenefits } from './benefits';
const base = { diasUteis: 21, ausencias: 0, vrDiario: 30, vtDiario: 12, recebeVt: true, vtCartao: false, liquido: 2000 };
describe('benefícios', () => {
  it('outubro/2026 tem 21 dias úteis (12/10 feriado)', () => { expect(businessDays('2026-10').length).toBe(21); });
  it('desligada em 26/10 conta só até 23/10', () => { expect(businessDays('2026-10', '2026-10-26').length).toBe(16); });
  it('cada falta desconta R$ 12 de VT', () => { expect(computeBenefits({ ...base, ausencias: 2 }).vt).toBe(228); });
  it('PIX = líquido + VR + VT', () => { expect(computeBenefits(base).pix).toBe(2000 + 630 + 252); });
  it('VT no cartão fica fora do PIX', () => { expect(computeBenefits({ ...base, vtCartao: true }).pix).toBe(2630); });
});
