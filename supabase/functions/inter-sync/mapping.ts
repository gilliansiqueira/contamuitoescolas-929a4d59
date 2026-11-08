// Regras puras da integração Banco Inter (sem dependências do Deno — testadas no Vitest).

export interface InterTx {
  idTransacao?: string; dataInclusao?: string; dataTransacao?: string; dataEntrada?: string;
  tipoTransacao?: string; tipoOperacao?: string; valor?: string | number; titulo?: string; descricao?: string;
}
export interface MappedTx { data: string; tipo: 'entrada' | 'saida'; valor: number; descricao: string; bankRef: string }
export interface ExistingRow { data: string; tipo: string; valor: number | string; bank_ref: string | null }

/** Converte um lançamento do extrato do Inter. O sentido vem do campo C/D do banco, nunca do sinal do valor. */
export function mapInterTx(t: InterTx): MappedTx | null {
  const data = String(t.dataTransacao ?? t.dataEntrada ?? t.dataInclusao ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const op = String(t.tipoOperacao ?? '').toUpperCase();
  if (op !== 'C' && op !== 'D') return null;
  const valor = Math.round(Math.abs(Number(String(t.valor ?? '').replace(',', '.'))) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const descricao = [t.titulo, t.descricao].map(s => String(s ?? '').trim()).filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i).join(' - ') || String(t.tipoTransacao ?? 'Lançamento Inter');
  const id = String(t.idTransacao ?? '').trim();
  const bankRef = id ? `inter:${id}` : `inter:${data}|${op}|${valor.toFixed(2)}|${descricao}`;
  return { data, tipo: op === 'C' ? 'entrada' : 'saida', valor, descricao, bankRef };
}

const key = (d: string, tipo: string, v: number | string) => `${d}|${tipo}|${Number(v).toFixed(2)}`;

/**
 * Separa o que é novo. Já gravado com o mesmo código do Inter = repetido.
 * Linhas de OFX/PDF (sem código do Inter) no mesmo dia, sentido e valor consomem uma correspondência cada,
 * para o extrato enviado à mão e a API não duplicarem.
 */
export function splitNew(mapped: MappedTx[], existing: ExistingRow[]): { novos: MappedTx[]; jaExistiam: number } {
  const refs = new Set(existing.filter(e => e.bank_ref?.startsWith('inter:')).map(e => e.bank_ref));
  const livres = new Map<string, number>();
  for (const e of existing) if (!e.bank_ref?.startsWith('inter:')) {
    const k = key(e.data, e.tipo, e.valor); livres.set(k, (livres.get(k) ?? 0) + 1);
  }
  const novos: MappedTx[] = []; let jaExistiam = 0; const vistos = new Set<string>();
  for (const m of mapped) {
    if (refs.has(m.bankRef) || vistos.has(m.bankRef)) { jaExistiam++; continue; }
    vistos.add(m.bankRef);
    const k = key(m.data, m.tipo, m.valor); const n = livres.get(k) ?? 0;
    if (n > 0) { livres.set(k, n - 1); jaExistiam++; continue; }
    novos.push(m);
  }
  return { novos, jaExistiam };
}

/** Janela de leitura: madrugada relê 7 dias; horário comercial relê 2. Nunca antes da data de início. */
export function syncWindow(today: string, startDate: string, origem: 'noturna' | 'comercial' | 'manual'): { inicio: string; fim: string } {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (origem === 'comercial' ? 1 : 6));
  const inicio = d.toISOString().slice(0, 10);
  return { inicio: inicio < startDate ? startDate : inicio, fim: today };
}
