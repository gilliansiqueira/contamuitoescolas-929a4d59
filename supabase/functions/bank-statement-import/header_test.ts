// Synthetic PDFs only (no real statements). Run: deno test -A --node-modules-dir=auto supabase/functions/bank-statement-import/header_test.ts
import { assertEquals } from 'jsr:@std/assert@1';
import { readIdentity } from './header.ts';
import { checkStatementIdentity } from '../_shared/bankIdentity.ts';

function pdf(lines: string[]): Uint8Array {
  const content = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map(l => `(${l}) Tj T*`).join(' ')} ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new TextEncoder().encode(out);
}
const header = ['Extrato ficticio de conta corrente', 'Banco: 237', 'Agencia: 0123', 'Conta: 0012345-6', 'Data Descricao Valor', '10/11/2026 PIX CNPJ 11111111111111 10,00'];
const account = { school_id: 'a', banco: 'Bradesco', agencia: '0123', conta: '0012345-6' };

Deno.test('PDF de texto: servidor lê banco/agência/conta do cabeçalho e confirma', async () => {
  const id = await readIdentity('pdf', pdf(header));
  assertEquals([id?.bankCode, id?.branch, id?.account, id?.holderDocument], ['237', '0123', '0012345-6', undefined]);
  assertEquals(checkStatementIdentity(id, account, 'a').verified, true);
});
Deno.test('PDF de texto de outra conta: divergência concreta bloqueia', async () => {
  const id = await readIdentity('pdf', pdf(header.map(l => l.replace('Banco: 237', 'Banco: 748'))));
  let blocked = false; try { checkStatementIdentity(id, account, 'a'); } catch { blocked = true; }
  assertEquals(blocked, true);
});
Deno.test('PDF sem texto (imagem) e PDF corrompido: inconclusivo, nunca bloqueio', async () => {
  for (const bytes of [pdf([]), new TextEncoder().encode('%PDF-1.4 corrompido')]) {
    const id = await readIdentity('pdf', bytes);
    assertEquals(id, undefined);
    const check = checkStatementIdentity(id, account, 'a');
    assertEquals([check.verified, check.warnings.length > 0], [false, true]);
  }
});
Deno.test('PDF com senha: servidor não pede senha; resultado inconclusivo', async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeFile(`${dir}/in.pdf`, pdf(header));
    const r = await new Deno.Command('qpdf', { args: ['--encrypt', 'senha-ficticia', 'dono-ficticio', '256', '--', `${dir}/in.pdf`, `${dir}/out.pdf`] }).output();
    assertEquals(r.success, true);
    const id = await readIdentity('pdf', await Deno.readFile(`${dir}/out.pdf`));
    assertEquals(id, undefined);
    assertEquals(checkStatementIdentity(id, account, 'a').verified, false);
  } finally { await Deno.remove(dir, { recursive: true }); }
});
Deno.test('CSV/Excel sem cabeçalho: inconclusivo e permitido', async () => {
  const id = await readIdentity('csv', new TextEncoder().encode('Data;Descrição;Valor\n10/11/2026;Banco 748 Conta 999;10'));
  const check = checkStatementIdentity(id, account, 'a');
  assertEquals(check.verified, false);
});
