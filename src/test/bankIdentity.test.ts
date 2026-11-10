import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { headerIdentity, normalizeAccount, checkStatementIdentity, resolveHolder, ImportGeneration, resolveBankCode, BANK_ALIASES, KNOWN_BANK_CODES, decodeBankText, compareNumber, IdentityMismatchError } from '../lib/bankStatements/identity';
import { headerIdentity as serverIdentity } from '../../supabase/functions/_shared/bankIdentity';
import { parseOFX } from '../lib/bankStatements/parsers';

// Regra da proprietária (10/11/2026): só bloqueia divergência concreta; o resto é aviso. Fixtures fictícias.
const account = { school_id: 'empresa-a', banco: 'Bradesco', bank_code: '237', agencia: '0123', conta: '0012345-6' };
const identity = { bankCode: '237', branch: '0123', account: '00123456' };
const ofx = (bank = '237', branch = '0123', acc = '00123456') => `<OFX><BANKACCTFROM><BANKID>${bank}\n<BRANCHID>${branch}\n<ACCTID>${acc}\n</BANKACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20261110\n<TRNAMT>10\n<MEMO>Pagador CNPJ 11111111111111\n</STMTTRN></BANKTRANLIST></OFX>`;
const check = (id: Parameters<typeof checkStatementIdentity>[0], acc: Parameters<typeof checkStatementIdentity>[1] = account, school = 'empresa-a') => checkStatementIdentity(id, acc, school);
const allowedWithWarning = (id: Parameters<typeof checkStatementIdentity>[0], acc: Parameters<typeof checkStatementIdentity>[1] = account) => { const r = check(id, acc); expect(r.verified).toBe(false); expect(r.warnings.length).toBeGreaterThan(0); };

describe('Divergência concreta: BLOQUEIA', () => {
  it('extrato Bradesco na conta Sicredi', () => expect(() => check(headerIdentity(ofx(), true), { ...account, banco: 'Sicredi', bank_code: '748' })).toThrow(IdentityMismatchError));
  it('banco diferente mesmo faltando agência e conta', () => expect(() => check({ bankCode: '748' })).toThrow('banco'));
  it('conta diferente mesmo faltando banco e agência', () => expect(() => check({ account: '00123457' })).toThrow('conta'));
  it('agência diferente mesmo faltando o resto', () => expect(() => check({ branch: '0999' })).toThrow('agência'));
  it('outra conta do mesmo banco', () => expect(() => check({ ...identity, account: '00123457' })).toThrow('conta'));
  it('dígito divergente não é relaxado', () => expect(() => check({ ...identity, account: '0012345-X' })).toThrow('conta'));
  it('conta de outra empresa', () => expect(() => check(identity, account, 'empresa-b')).toThrow('empresa'));
  it('titular cadastrado diferente do cabeçalho', () => expect(() => check({ ...identity, holderDocument: '11111111111111' }, { ...account, holder_document: '00000000000000' })).toThrow('titular'));
  it('mensagem não expõe números completos', () => { try { check({ ...identity, account: '00123457' }); } catch (e) { expect(String(e)).not.toContain('00123457'); } });
});

describe('Sem identificação suficiente: PERMITE com aviso (nunca verificado)', () => {
  it('PDF/OCR sem identidade', () => allowedWithWarning(undefined));
  it('OFX/CSV/Excel sem cabeçalho', () => allowedWithWarning(headerIdentity('Data;Descrição;Valor\n10/11/2026;Banco 748 Conta 999;10')));
  it('cadastro incompleto (caixa/manual)', () => allowedWithWarning(identity, { school_id: 'empresa-a', banco: '', agencia: null, conta: null }));
  it('banco cadastrado desconhecido', () => allowedWithWarning(identity, { ...account, banco: 'Banco inventado', bank_code: null }));
  it('código do banco desconhecido no arquivo', () => allowedWithWarning({ ...identity, bankCode: '999' }));
  it('dígito ausente de um lado não prova outra conta', () => allowedWithWarning({ ...identity, account: '0012345' }));
  it('agência com dígito no arquivo e sem no cadastro', () => allowedWithWarning({ ...identity, branch: '0123-4' }));
  it('documento no arquivo sem titular cadastrado', () => allowedWithWarning({ ...identity, holderDocument: '11111111111111' }));
  it('titular específico inconsistente no cadastro', () => allowedWithWarning(identity, resolveHolder({ ...account, holder_entity_id: 'e' }, null)));
  it('cadastro duplicado/ambíguo avisa', () => { const r = checkStatementIdentity(identity, account, 'empresa-a', { sharedRegistration: true }); expect(r.verified).toBe(false); expect(r.warnings.join(' ')).toContain('outro cadastro'); });
  it('OFX com várias contas', () => allowedWithWarning(headerIdentity(ofx() + ofx('748'), true)));
  it.each(['BANKID', 'BRANCHID', 'ACCTID', 'CNPJ'])('tags %s contraditórias no mesmo bloco viram aviso', tag => {
    allowedWithWarning(headerIdentity(ofx().replace('</BANKACCTFROM>', `<${tag}>11111111111111\n<${tag}>22222222222222\n</BANKACCTFROM>`), true));
  });
  it('aviso não abre diálogo nem pede senha', () => { const prompt = vi.fn(); const confirm = vi.fn(); vi.stubGlobal('prompt', prompt); vi.stubGlobal('confirm', confirm); check(undefined); expect(prompt).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
});

describe('Conferência completa: verificado', () => {
  it('conta correta sem documento no OFX', () => expect(check(headerIdentity(ofx(), true))).toMatchObject({ verified: true, warnings: [] }));
  it('formatação e zeros à esquerda equivalentes', () => expect(check({ bankCode: '0237', branch: '01.23', account: '12345-6' }).verified).toBe(true));
  it('titular cadastrado igual', () => expect(check({ ...identity, holderDocument: '00.000.000/0000-00' }, { ...account, holder_document: '00000000000000' }).verified).toBe(true));
  it('titular específico (multi-CNPJ) vem do vínculo da própria conta', () => expect(check({ ...identity, holderDocument: '22222222222222' }, resolveHolder({ ...account, holder_entity_id: 'e' }, '22222222222222')).verified).toBe(true));
  it('outro CNPJ da empresa não vale como titular desta conta', () => expect(() => check({ ...identity, holderDocument: '33333333333333' }, resolveHolder({ ...account, holder_entity_id: 'e' }, '22222222222222'))).toThrow('titular'));
  it('alias exato do cadastro antigo dispensa código', () => expect(check(identity, { ...account, bank_code: null }).verified).toBe(true));
});

describe('Leitura do cabeçalho', () => {
  it('documento de pagador OFX não é titular', () => expect(headerIdentity(ofx(), true).holderDocument).toBeUndefined());
  it('documento de pagador CSV não é titular', () => expect(headerIdentity('Banco;237\nAgência;0123\nConta;0012345-6\nData;Descrição;Valor\n10/11/2026;CNPJ: 11111111111111;10').holderDocument).toBeUndefined());
  it('CNPJ genérico do cabeçalho (ex.: do próprio banco) não é titular', () => expect(headerIdentity('Banco Fictício S.A.\nCNPJ: 11.111.111/0001-11\nAgência: 0123\nConta: 0012345-6\nData Descrição Valor').holderDocument).toBeUndefined());
  it('rótulo explícito do titular é lido', () => expect(headerIdentity('CPF/CNPJ do titular;00.000.000/0000-00\nData;Descrição;Valor').holderDocument).toBe('00.000.000/0000-00'));
  it('valor não engole data seguinte na mesma linha', () => expect(headerIdentity('Conta: 0012345-6 01/10/2026 a 31/10/2026\nData Descrição Valor').account).toBe('0012345-6'));
  it('"saldo em conta" não vira número de conta', () => expect(headerIdentity('Saldo em conta: 1.234,56\nData Descrição Valor').account).toBeUndefined());
  it('tags equivalentes não são contraditórias', () => expect(headerIdentity(ofx().replace('</BANKACCTFROM>', '<ACCTID>00.12345-6\n</BANKACCTFROM>'), true).ambiguous).toBe(false));
  it.each(['utf8', 'bom', 'cp1252'])('cabeçalho Agência em %s', encoding => {
    const text = 'Banco;237\nAgência;0123\nConta;00123456\nData;Descrição;Valor';
    const bytes = encoding === 'cp1252' ? Uint8Array.from([...text].map(c => c.charCodeAt(0))) : new TextEncoder().encode((encoding === 'bom' ? '\uFEFF' : '') + text);
    expect(check(headerIdentity(decodeBankText(bytes))).verified).toBe(true);
  });
  it('nome do arquivo não participa da leitura', () => expect(parseOFX(ofx()).identity).toEqual(headerIdentity(ofx(), true)));
  it('contrato de leitura servidor/cliente é igual', () => expect(serverIdentity(ofx(), true)).toEqual(headerIdentity(ofx(), true)));
  it('não converte letras em números', () => expect(normalizeAccount('OO12345-6')).toBe(''));
  it('comparação numérica', () => expect([compareNumber('0012345', '0012345-6'), compareNumber('00123457', '0012345-6'), compareNumber('', '1'), compareNumber('abc', '1')]).toEqual(['uncertain', 'mismatch', 'missing', 'uncertain']));
});

describe('Aliases e paridade com o banco de dados', () => {
  it.each(Object.entries(BANK_ALIASES))('alias exato %s resolve %s', (alias, code) => expect(resolveBankCode(alias)).toBe(code));
  it('alias parcial não resolve', () => expect(resolveBankCode('Bradesco Sicredi')).toBe(''));
  it('código incompatível com alias não resolve', () => expect(resolveBankCode('Sicredi', '237')).toBe(''));
  it('lista de bancos conhecidos é a mesma da regra do banco de dados', () => {
    const sql = readFileSync('drizzle/migrations/0119_bank_identity_warn_not_block.sql', 'utf8');
    const list = sql.match(/ANY\(ARRAY\[([^\]]+)\]\)/)![1].match(/'(\d{3})'/g)!.map(s => s.slice(1, 4));
    expect(new Set(list)).toEqual(new Set(KNOWN_BANK_CODES));
  });
});

describe('Troca de destino/arquivo', () => {
  it('troca de destino após prévia invalida geração', () => { const g = new ImportGeneration(); const v = g.invalidate(); g.invalidate(); expect(g.current(v)).toBe(false); });
  it('troca de arquivo durante análise invalida resultado antigo', async () => { const g = new ImportGeneration(); const v = g.invalidate(); const pending = Promise.resolve(v); g.invalidate(); expect(g.current(await pending)).toBe(false); });
});
