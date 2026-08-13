/** Fuso oficial do sistema — Brasília (UTC−3, sem horário de verão desde 2019). */
export const APP_TIMEZONE = 'America/Sao_Paulo';
export const APP_LOCALE = 'pt-BR';

/**
 * Interpreta datas do backend (DATE ou DATETIME MySQL) como horário de Brasília.
 */
export function parseAppDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00-03:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    const normalized = s.replace(' ', 'T');
    const withTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)
      ? normalized
      : `${normalized}-03:00`;
    const d = new Date(withTz);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** dd/mm/aaaa */
export function formatDateBR(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parseAppDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** dd/mm/aaaa, hh:mm */
export function formatDateTimeBR(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parseAppDate(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Ex.: quarta-feira, 12 de agosto */
export function formatLongDateBR(value: Date = new Date()): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(value);
}

/** Ex.: 14:30:45 (horário de Brasília) */
export function formatTimeBR(value: Date = new Date()): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

/** Ex.: 10 de novembro de 2026 */
export function formatDateLongBR(value: string | Date | null | undefined): string {
  const d = parseAppDate(value);
  if (!d) return '____ de ______________ de ______';
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${day} de ${month} de ${year}`;
}

/** YYYY-MM-DD no fuso de Brasília (para inputs type="date"). */
export function todayDateISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function greetingBR(): string {
  const hour = Number(
    new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
