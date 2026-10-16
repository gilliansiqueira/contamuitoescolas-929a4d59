import { Unzip, UnzipInflate, zipSync, strToU8 } from 'npm:fflate@0.8.2';

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
  private dec = new TextDecoder(); private carry = new Uint8Array(0);
  private static END = new TextEncoder().encode('</sheetData>');
  pushBytes(chunk: Uint8Array, final: boolean) {
    if (this.state !== 'skip') return this.push(this.dec.decode(chunk, { stream: !final }));
    // Linhas descartadas: procura o fim do bloco direto nos bytes, sem montar texto (economiza memória).
    const m = SheetTrimmer.END; const c = new Uint8Array(this.carry.length + chunk.length);
    c.set(this.carry); c.set(chunk, this.carry.length);
    for (let i = 0; i <= c.length - m.length; i++) {
      if (c[i] !== 60) continue; let ok = true;
      for (let j = 1; j < m.length; j++) if (c[i + j] !== m[j]) { ok = false; break; }
      if (ok) { this.state = 'tail'; this.buf = ''; this.dec = new TextDecoder(); return this.push(this.dec.decode(c.subarray(i), { stream: !final })); }
    }
    this.carry = c.slice(Math.max(0, c.length - m.length));
  }
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
      if (i < 0) { this.carry = new TextEncoder().encode(this.buf.slice(-20)); this.buf = ''; return; }
      this.buf = this.buf.slice(i); this.state = 'tail';
    }
    if (this.state === 'tail' && this.buf.length > 4_000_000) { this.out.push(this.buf); this.buf = ''; }
  }
  done() { this.out.push(this.buf); return clampRefs(this.out.join(''), this.maxRow).replace(/<dimension[^>]*\/>/, ''); }
}

export function needsSlim(buf: ArrayBuffer) { return buf.byteLength > 2_000_000; }

