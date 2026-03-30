/** Move a date to next business day (Mon-Fri) if it falls on weekend */
export function toNextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  if (day === 0) d.setDate(d.getDate() + 1); // Sun → Mon
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
