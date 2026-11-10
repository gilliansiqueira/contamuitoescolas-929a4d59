import { describe, it, expect } from 'vitest';
import { headerIdentity, normalizeAccount, validateStatementIdentity, ImportGeneration, resolveBankCode, BANK_ALIASES, decodeBankText } from '../lib/bankStatements/identity';
import { headerIdentity as serverIdentity } from '../../supabase/functions/_shared/bankIdentity';
import { parseOFX } from '../lib/bankStatements/parsers';

const account = { school_id: 'empresa-a', bank_code: '237', agencia: '0123', conta: '0012345-6', identity_verified: true, holder_document: '00000000000000' };
const identity = { bankCode: '237', branch: '0123', account: '00123456' };
const ofx = (bank = '237', branch = '0123', acc = '00123456') => `<OFX><BANKACCTFROM><BANKID>${bank}\n<BRANCHID>${branch}\n<ACCTID>${acc}\n</BANKACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20261110\n<TRNAMT>10\n<MEMO>Pagador CNPJ 11111111111111\n</STMTTRN></BANKTRANLIST></OFX>`;
describe('Identidade bancária: fixtures exclusivamente fictícias', () => {
  it('Bradesco não entra na Sicredi', () => expect(() => validateStatementIdentity(headerIdentity(ofx(), true), { ...account, bank_code: '748' }, 'empresa-a')).toThrow('Banco'));
  it('outra conta do mesmo banco é bloqueada', () => expect(() => validateStatementIdentity({ ...identity, account: '00123457' }, account, 'empresa-a')).toThrow('Conta'));
  it('mesma identidade em empresa errada é bloqueada', () => expect(() => validateStatementIdentity(identity, account, 'empresa-b')).toThrow('empresa'));
  it('conta correta sem documento no OFX é aceita', () => expect(() => validateStatementIdentity(headerIdentity(ofx(), true), account, 'empresa-a')).not.toThrow());
  it('formatação equivalente mantém todos os dígitos', () => expect(() => validateStatementIdentity({ ...identity, branch: '01.23', account: '00.12345-6' }, account, 'empresa-a')).not.toThrow());
  it('não retira zeros significativos', () => expect(() => validateStatementIdentity({ ...identity, account: '123456' }, account, 'empresa-a')).toThrow('Conta'));
  it('dígito divergente não é relaxado', () => expect(() => validateStatementIdentity({ ...identity, account: '0012345-X' }, account, 'empresa-a')).toThrow('Conta'));
  it('não converte letras em números', () => expect(normalizeAccount('OO12345-6')).toBe(''));
  it('CNPJ incompatível no cabeçalho bloqueia', () => expect(() => validateStatementIdentity({ ...identity, holderDocument: '11111111111111' }, account, 'empresa-a')).toThrow('titular'));
  it('CNPJ autorizado específico da conta aceita formatação', () => expect(() => validateStatementIdentity({ ...identity, holderDocument: '00.000.000/0000-00' }, account, 'empresa-a')).not.toThrow());
  it('documento de pagador OFX não é titular', () => expect(headerIdentity(ofx(), true).holderDocument).toBeUndefined());
  it('documento de pagador CSV não é titular', () => expect(headerIdentity('Banco;237\nAgência;0123\nConta;0012345-6\nData;Descrição;Valor\n10/11/2026;CNPJ: 11111111111111;10').holderDocument).toBeUndefined());
  it('metadados ausentes bloqueiam', () => expect(() => validateStatementIdentity({}, account, 'empresa-a')).toThrow('não identifica'));
  it('cadastro completo dispensa checkbox', () => expect(() => validateStatementIdentity(identity, { ...account, identity_verified: false }, 'empresa-a')).not.toThrow());
  it('cadastro antigo com alias exato dispensa código novo', () => expect(() => validateStatementIdentity(identity, { ...account, banco: 'Bradesco', bank_code: null, identity_verified: false }, 'empresa-a')).not.toThrow());
  it.each(Object.entries(BANK_ALIASES))('alias exato %s resolve %s', (alias, code) => expect(resolveBankCode(alias)).toBe(code));
  it('banco desconhecido exige complemento', () => expect(resolveBankCode('Banco inventado')).toBe(''));
  it('alias parcial não resolve', () => expect(resolveBankCode('Bradesco Sicredi')).toBe(''));
  it('código incompatível com alias bloqueia', () => expect(resolveBankCode('Sicredi', '237')).toBe(''));
  it.each(['BANKID','BRANCHID','ACCTID','CNPJ'])('tags %s contraditórias no mesmo bloco bloqueiam', tag => {
    const text = ofx().replace('</BANKACCTFROM>', `<${tag}>11111111111111\n<${tag}>22222222222222\n</BANKACCTFROM>`);
    expect(() => validateStatementIdentity(headerIdentity(text, true), account, 'empresa-a')).toThrow();
  });
  it('tags equivalentes não são contraditórias', () => expect(headerIdentity(ofx().replace('</BANKACCTFROM>', '<ACCTID>00.12345-6\n</BANKACCTFROM>'), true).ambiguous).toBe(false));
  it.each(['utf8','bom','cp1252'])('cabeçalho Agência em %s', encoding => {
    const text = 'Banco;237\nAgência;0123\nConta;00123456\nData;Descrição;Valor';
    const bytes = encoding === 'cp1252' ? Uint8Array.from([...text].map(c => c.charCodeAt(0))) : new TextEncoder().encode((encoding === 'bom' ? '\uFEFF' : '') + text);
    expect(headerIdentity(decodeBankText(bytes)).branch).toBe('0123');
    expect(() => validateStatementIdentity(headerIdentity(decodeBankText(bytes)), account, 'empresa-a')).not.toThrow();
  });
  it('cadastro sem agência bloqueia', () => expect(() => validateStatementIdentity(identity, { ...account, agencia: null }, 'empresa-a')).toThrow('cadastro'));
  it('OFX multi-conta bloqueia', () => expect(() => validateStatementIdentity(headerIdentity(ofx() + ofx('748'), true), account, 'empresa-a')).toThrow());
  it('cabeçalho com contas contraditórias bloqueia', () => expect(() => validateStatementIdentity(headerIdentity('Banco;237\nAgência;0123\nConta;00123456\nConta;00123457\nData;Descrição;Valor'), account, 'empresa-a')).toThrow());
  it('nome do arquivo não participa da leitura', () => expect(parseOFX(ofx()).identity).toEqual(headerIdentity(ofx(), true)));
  it.each(['CSV', 'Excel', 'PDF'])('%s sem cabeçalho não tem rota alternativa', () => expect(() => validateStatementIdentity(headerIdentity('Data;Descrição;Valor\n10/11/2026;Banco 237 Conta 00123456;10'), account, 'empresa-a')).toThrow());
  it('troca de destino após prévia invalida geração', () => { const g = new ImportGeneration(); const v = g.invalidate(); g.invalidate(); expect(g.current(v)).toBe(false); });
  it('troca de arquivo durante análise invalida resultado antigo', async () => { const g = new ImportGeneration(); const v = g.invalidate(); const pending = Promise.resolve(v); g.invalidate(); expect(g.current(await pending)).toBe(false); });
  it('cancelamento invalida análise', () => { const g = new ImportGeneration(); const v = g.invalidate(); g.invalidate(); expect(g.current(v)).toBe(false); });
  it('contrato de leitura servidor/cliente é igual', () => { expect(serverIdentity(ofx(), true)).toEqual(headerIdentity(ofx(), true)); });
});