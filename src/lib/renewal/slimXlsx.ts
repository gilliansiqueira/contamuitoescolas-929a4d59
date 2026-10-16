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

export async function slimXlsx(buf: ArrayBuffer, maxRow = SLIM_MAX_ROW): Promise<ArrayBuffer> {
  const u8 = new Uint8Array(buf); const step = 1 << 20;
  return slimXlsxChunks(async function* () {
    for (let i = 0; i < u8.length; i += step) {
      yield u8.subarray(i, Math.min(i + step, u8.length));
      if ((i / step) % 8 === 7) await new Promise(r => setTimeout(r, 0)); // deixa a tela respirar
    }
  }(), maxRow);
}

/** Mesma leitura, recebendo o arquivo em pedaços (ex.: File.stream()), sem carregar tudo na memória. */
export async function slimXlsxChunks(chunks: AsyncIterable<Uint8Array>, maxRow = SLIM_MAX_ROW): Promise<ArrayBuffer> {
  const files: Record<string, Uint8Array> = {};
  const pending: Promise<void>[] = [];
  const uz = new Unzip();
  uz.register(UnzipInflate);
  uz.onfile = f => {
    pending.push(new Promise((res, rej) => {
      const isSheet = /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name);
      const tr = new SheetTrimmer(maxRow); const parts: Uint8Array[] = [];
      f.ondata = (err, chunk, final) => {
        if (err) return rej(err);
        if (isSheet) tr.pushBytes(chunk, final); else parts.push(chunk);
        if (final) {
          if (isSheet) files[f.name] = strToU8(tr.done());
          else { const n = parts.reduce((a, p) => a + p.length, 0); const u = new Uint8Array(n); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; } files[f.name] = u; }
          res();
        }
      };
      f.start();
    }));
  };
  let prev: Uint8Array | null = null;
  for await (const c of chunks) { if (prev) uz.push(prev, false); prev = c; }
  uz.push(prev ?? new Uint8Array(0), true);
  await Promise.all(pending);
  const z = zipSync(files);
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
}

/** Roda a leitura num processo separado do navegador (Web Worker). */
export function slimXlsxInWorker(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./slimWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { w.terminate(); e.data.ok ? resolve(e.data.buf) : reject(new Error(e.data.error)); };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Faltou memória para ler o modelo.')); };
    w.postMessage(file);
  });
}
