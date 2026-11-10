import { expect, it } from 'vitest';
import { validateAccountRegistration } from '../lib/bankStatements/accountRegistration';
import { checkStatementIdentity } from '../lib/bankStatements/identity';
const cash = { banco: '', bankCode: '', holderDocument: '', holderEntityId: '' };
it('caixa incompleto pode ser salvo e importar segue com aviso (sem obrigação nova)', () => {
  expect(() => validateAccountRegistration(cash, [])).not.toThrow();
  expect(checkStatementIdentity({ bankCode: '237', branch: '0123', account: '00123456' }, { school_id: 'a', agencia: null, conta: null }, 'a')).toMatchObject({ verified: false });
});
it('edição de cadastro parcial ou banco desconhecido continua permitida', () => expect(() => validateAccountRegistration({ ...cash, banco: 'Caixa manual fictício' }, [])).not.toThrow());
it('alias explicitamente incompatível não pode ser salvo', () => expect(() => validateAccountRegistration({ ...cash, banco: 'Sicredi', bankCode: '237' }, [])).toThrow('incompatível'));
it('documento malformado não pode ser salvo', () => expect(() => validateAccountRegistration({ ...cash, holderDocument: '123' }, [])).toThrow('inválido'));
it('documento incompatível com titular específico não pode ser salvo', () => expect(() => validateAccountRegistration({ ...cash, holderDocument: '00000000000000', holderEntityId: 'e' }, [{ id: 'e', cnpj: '11111111111111' }])).toThrow('diverge'));
it('titular de outra empresa não pode ser salvo', () => expect(() => validateAccountRegistration({ ...cash, holderEntityId: 'externo' }, [])).toThrow('vínculo'));