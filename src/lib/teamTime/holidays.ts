/** Feriados nacionais (fixos + móveis via Páscoa) — dia no formato YYYY-MM-DD. */
const pad = (n: number) => String(n).padStart(2, '0');

function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

const cache = new Map<number, Set<string>>();
export function nationalHolidays(y: number): Set<string> {
  let s = cache.get(y);
  if (s) return s;
  s = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map(md => `${y}-${md}`));
  const e = easter(y).getTime();
  for (const off of [-48, -47, -2, 60]) {
    const d = new Date(e + off * 86400000);
    s.add(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  cache.set(y, s);
  return s;
}

export const isNationalHoliday = (dia: string) => nationalHolidays(Number(dia.slice(0, 4))).has(dia.slice(0, 10));
