import { Unzip, UnzipInflate, zipSync, strToU8 } from 'fflate';

/** Modelos com formatação até a última linha do Excel (1 milhão de linhas) travam o navegador.
 *  Mantém só as primeiras `maxRow` linhas de cada aba e limita os intervalos (validações, formatação) a essa faixa. */
export const SLIM_MAX_ROW = 1500;

function clampRefs(xml: string, maxRow: number) {
  return xml.replace(/sqref="([^"]*)"/g, (_m, refs: string) => {
    const kept = refs.split(/\s+/).filter(Boolean).map(r => {
      const [a, b] = r.split(':');
      const row = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
      if (row(a) > maxRow) return null;
      if (b && row(b) > maxRow) return `${a}:${b.replace(/\d+$/, String(maxRow))}`;
      return r;
    }).filter(Boolean);
    return `sqref="${kept.join(' ') || 'A1'}"`;
  });
}

class SheetTrimmer {
  private out: string[] = []; private buf = ''; private state: 'head' | 'skip' | 'tail' = 'head';
  constructor(private maxRow: number) {}
  push(s: string) {
    this.buf += s;
    if (this.state === 'head') {
      const re = /<row\b[^>]*\br="(\d+)"/g; let m: RegExpExecArray | null;
      while ((m = re.exec(this.buf))) if (Number(m[1]) > this.maxRow) {
        this.out.push(this.buf.slice(0, m.index)); this.buf = this.buf.slice(m.index); this.state = 'skip'; break;
      }
      if (this.state === 'head') { const keep = Math.max(0, this.buf.length - 400); this.out.push(this.buf.slice(0, keep)); this.buf = this.buf.slice(keep); return; }
    }
    if (this.state === 'skip') {
      const i = this.buf.indexOf('</sheetData>');
      if (i < 0) { this.buf = this.buf.slice(-20); return; }
      this.buf = this.buf.slice(i); this.state = 'tail';
    }
    if (this.state === 'tail' && this.buf.length > 4_000_000) { this.out.push(this.buf); this.buf = ''; }
  }
  done() { this.out.push(this.buf); return clampRefs(this.out.join(''), this.maxRow).replace(/<dimension[^>]*\/>/, ''); }
}

export function needsSlim(buf: ArrayBuffer) { return buf.byteLength > 2_000_000; }

export async function slimXlsx(buf: ArrayBuffer, maxRow = SLIM_MAX_ROW): Promise<ArrayBuffer> {
  const files: Record<string, Uint8Array> = {};
  const pending: Promise<void>[] = [];
  const uz = new Unzip();
  uz.register(UnzipInflate);
  uz.onfile = f => {
    pending.push(new Promise((res, rej) => {
      const isSheet = /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name);
      const dec = new TextDecoder(); const tr = new SheetTrimmer(maxRow); const parts: Uint8Array[] = [];
      f.ondata = (err, chunk, final) => {
        if (err) return rej(err);
        if (isSheet) tr.push(dec.decode(chunk, { stream: !final })); else parts.push(chunk);
        if (final) {
          if (isSheet) files[f.name] = strToU8(tr.done());
          else { const n = parts.reduce((a, p) => a + p.length, 0); const u = new Uint8Array(n); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; } files[f.name] = u; }
          res();
        }
      };
      f.start();
    }));
  };
  const u8 = new Uint8Array(buf); const step = 1 << 20;
  for (let i = 0; i < u8.length; i += step) uz.push(u8.subarray(i, Math.min(i + step, u8.length)), i + step >= u8.length);
  await Promise.all(pending);
  const z = zipSync(files);
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
}
