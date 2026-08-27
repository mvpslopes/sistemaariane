/** Gestação média da égua: cerca de 11 meses (≈ 340 dias). */

export const EQUINE_GESTATION_MONTHS = 11;
export const EQUINE_GESTATION_WINDOW_BEFORE_DAYS = 10;
export const EQUINE_GESTATION_WINDOW_AFTER_DAYS = 15;

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addCalendarMonthsISO(iso: string, months: number): string | null {
  const d = parseISODate(iso);
  if (!d) return null;
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

export function addDaysISO(iso: string, days: number): string | null {
  const d = parseISODate(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function equineExpectedDue(coveringDate: string | null | undefined): string | null {
  if (!coveringDate) return null;
  return addCalendarMonthsISO(coveringDate, EQUINE_GESTATION_MONTHS);
}

export function equineDueWindow(coveringDate: string | null | undefined, overrideDue?: string | null) {
  const due = (overrideDue && parseISODate(overrideDue) ? overrideDue : null) || equineExpectedDue(coveringDate);
  if (!due) return null;
  const start = addDaysISO(due, -EQUINE_GESTATION_WINDOW_BEFORE_DAYS);
  const end = addDaysISO(due, EQUINE_GESTATION_WINDOW_AFTER_DAYS);
  if (!start || !end) return null;
  return { due, start, end };
}
