import { headerIdentity, decodeBankText, pdfItemsToLines, type StatementIdentity } from '../_shared/bankIdentity.ts';

/** Independent server reading of the PDF header (first page only). Any failure = inconclusive, never a block. */
export async function pdfHeaderText(bytes: Uint8Array): Promise<string | undefined> {
  const read = (async () => {
    const { getDocumentProxy } = await import('npm:unpdf@1.4.0');
    const pdf = await getDocumentProxy(bytes.slice());
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const lines = pdfItemsToLines(content.items as { str?: string; transform?: number[] }[]);
    return lines.join('').replace(/\s+/g, '').length < 40 ? undefined : lines.join('\n');
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 6000); });
  try { return await Promise.race([read, timeout]); } catch { return undefined; } finally { clearTimeout(timer); }
}
export async function readIdentity(ext: string, bytes: Uint8Array): Promise<StatementIdentity | undefined> {
  try {
    if (ext === 'ofx' || ext === 'csv' || ext === 'txt') return headerIdentity(decodeBankText(bytes), ext === 'ofx');
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('npm:xlsx@0.18.5');
      const wb = XLSX.read(bytes, { type: 'array' });
      return headerIdentity(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';' }));
    }
    if (ext === 'pdf') { const text = await pdfHeaderText(bytes); return text ? headerIdentity(text) : undefined; }
  } catch { /* unreadable header = inconclusive */ }
  return undefined;
}

