import { describe, it, expect } from 'vitest';
import { isInMyPortfolio } from '@/lib/myPortfolio';
describe('minha carteira', () => {
  it('inclui escolas da pessoa supervisionada', () => { expect(isInMyPortfolio('bia', 'thauane', ['bia'])).toBe(true); });
  it('não inclui escolas de quem não é supervisionada', () => { expect(isInMyPortfolio('tamires', 'thauane', ['bia'])).toBe(false); });
});
