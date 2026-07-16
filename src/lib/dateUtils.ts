const ISO_DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const BR_DATE_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
const EXCEL_MIN_SERIAL = 20000;
const EXCEL_MAX_SERIAL = 80000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function makeUTCDateString(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < EXCEL_MIN_SERIAL || serial > EXCEL_MAX_SERIAL) return null;
  const d = new Date(Math.round((serial - 25569) * 86400000));
  if (Number.isNaN(d.getTime())) return null;
  return makeUTCDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Parse spreadsheet/import dates without timezone shifts.
 * Brazilian D/M/Y is the canonical text format; Excel serials and Date cells
 * are converted through UTC so 01/06 never becomes 31/05 in BRT.
 */
export function parseSpreadsheetDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;

  if (raw instanceof Date) {
    return makeUTCDateString(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }

  if (typeof raw === 'number') {
    return parseExcelSerialDate(raw);
  }

  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[T\s]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, '').trim();

  const iso = s.match(ISO_DATE_RE);
  if (iso) return makeUTCDateString(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const br = s.match(BR_DATE_RE);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = Number(br[3]);
    if (year < 100) year += 2000;
    return makeUTCDateString(year, month, day);
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    return parseExcelSerialDate(Number(s));
  }

  return null;
}

/** Move a date to next business day (Mon-Fri) if it falls on weekend */
export function toNextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  if (day === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  return d.toISOString().slice(0, 10);
}

/**
 * Move a date to previous business day (Mon-Fri) if it falls on weekend.
 * Regra de Projeção: lançamento projetado (a pagar / a receber) nunca cai
 * em sábado ou domingo — desloca para a sexta-feira anterior.
 */
export function toPreviousBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1); // Sat → Fri
  if (day === 0) d.setDate(d.getDate() - 2); // Sun → Fri
  return d.toISOString().slice(0, 10);
}

/** Add N calendar days to a date string and return business day */
export function addDaysAndAdjust(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const iso = d.toISOString().slice(0, 10);
  return toNextBusinessDay(iso);
}

/** Check if a date is weekend */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Get all days in a month range as YYYY-MM-DD strings */
export function getAllDaysInMonths(months: string[]): string[] {
  const days: string[] = [];
  for (const m of months) {
    const [y, mo] = m.split('-').map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return days.sort();
}

/** Format date for display */
export function formatDateBR(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** Get day of week name in pt-BR */
export function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return names[d.getDay()];
}
