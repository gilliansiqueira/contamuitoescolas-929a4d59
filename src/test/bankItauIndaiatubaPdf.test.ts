import { it, expect } from 'vitest';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { parsePdfLines } from '@/lib/bankStatements/parsers';
const f = '/mnt/user-uploads/Itaú_-_Extrato_PDF_-_iNDAIATUBA.pdf';
it.skipIf(!existsSync(f))('Itaú Indaiatuba PDF: linhas de SALDO não viram lançamento', () => {
  const lines = execSync(`pdftotext -layout "${f}" -`).toString().split('\n').map(l => l.trim()).filter(Boolean);
  const r = parsePdfLines(lines);
  console.log(r.transactions.length, r.saldoFinalInformado, r.periodoFim, r.avisos);
  expect(r.transactions.some(t => /saldo/i.test(t.descricao))).toBe(false);
});
