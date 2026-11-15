import type { PeriodMode, PeriodSelection, RecurringFrequency } from '../types/finance';

const euroFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const euroCompactFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatEuro(
  cents: number,
  options?: { showPlus?: boolean; compactDecimals?: boolean }
): string {
  const isNegative = cents < 0;
  const absEuros = Math.abs(cents) / 100;
  const formatted = options?.compactDecimals
    ? euroCompactFormatter.format(absEuros)
    : euroFormatter.format(absEuros);

  if (isNegative) return `-${formatted} €`;
  if (options?.showPlus && cents > 0) return `+${formatted} €`;
  return `${formatted} €`;
}

export function centsToInputString(cents: number): string {
  if (!cents) return '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rem = abs % 100;
  const sign = cents < 0 ? '-' : '';
  if (rem === 0) return `${sign}${euros}`;
  return `${sign}${euros},${String(rem).padStart(2, '0')}`;
}

export function parseEuroToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw * 100);
  }
  let cleaned = String(raw)
    .trim()
    .replace(/[€$£\s\u00A0]/g, '');
  if (!cleaned) return null;

  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  cleaned = cleaned.replace(/^[+-]/, '').replace(/[()]/g, '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Italian format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Anglo format: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  const cents = Math.round(num * 100);
  return isNegative ? -cents : cents;
}

export interface CalcEvaluation {
  valid: boolean;
  cents: number;
  hasOperator: boolean;
  formattedPreview: string;
}

export function evaluateCalculatorExpression(expr: string): CalcEvaluation {
  const normalized = expr.trim();
  if (!normalized) {
    return { valid: false, cents: 0, hasOperator: false, formattedPreview: '0,00 €' };
  }

  // Replace display symbols with JS math tokens
  const sanitized = normalized
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');

  const hasOperator = /[+\-*/]/.test(sanitized.slice(1));

  // Tokenize numbers and basic operators safely without eval
  const tokenRegex = /(\d+(?:[.,]\d+)?|[+\-*/])/g;
  const tokens = sanitized.match(tokenRegex);
  if (!tokens || tokens.length === 0) {
    return { valid: false, cents: 0, hasOperator, formattedPreview: '0,00 €' };
  }

  // If expression ends with a trailing operator while user is still typing, drop trailing operators for live preview
  const cleanTokens = [...tokens];
  while (cleanTokens.length > 1 && /^[+\-*/]$/.test(cleanTokens[cleanTokens.length - 1])) {
    cleanTokens.pop();
  }

  const values: number[] = [];
  const ops: string[] = [];

  const precedence = (op: string) => (op === '*' || op === '/' ? 2 : 1);
  const applyOp = () => {
    const op = ops.pop();
    const b = values.pop();
    const a = values.pop();
    if (op === undefined || b === undefined || a === undefined) return false;
    if (op === '+') values.push(a + b);
    else if (op === '-') values.push(a - b);
    else if (op === '*') values.push(a * b);
    else if (op === '/') {
      if (b === 0) return false;
      values.push(a / b);
    }
    return true;
  };

  let expectNumber = true;
  for (let i = 0; i < cleanTokens.length; i++) {
    const tk = cleanTokens[i];
    if (expectNumber) {
      if (tk === '-' || tk === '+') {
        const next = cleanTokens[i + 1];
        if (!next || /^[+\-*/]$/.test(next)) break;
        const num = Number(next.replace(',', '.'));
        if (!Number.isFinite(num)) {
          return { valid: false, cents: 0, hasOperator, formattedPreview: '0,00 €' };
        }
        values.push(tk === '-' ? -num : num);
        i++;
        expectNumber = false;
      } else if (!/^[+\-*/]$/.test(tk)) {
        const num = Number(tk.replace(',', '.'));
        if (!Number.isFinite(num)) {
          return { valid: false, cents: 0, hasOperator, formattedPreview: '0,00 €' };
        }
        values.push(num);
        expectNumber = false;
      } else {
        return { valid: false, cents: 0, hasOperator, formattedPreview: '0,00 €' };
      }
    } else {
      if (/^[+\-*/]$/.test(tk)) {
        while (ops.length > 0 && precedence(ops[ops.length - 1]) >= precedence(tk)) {
          if (!applyOp()) {
            return { valid: false, cents: 0, hasOperator, formattedPreview: 'Errore' };
          }
        }
        ops.push(tk);
        expectNumber = true;
      } else {
        break;
      }
    }
  }

  while (ops.length > 0) {
    if (!applyOp()) {
      return { valid: false, cents: 0, hasOperator, formattedPreview: 'Errore' };
    }
  }

  const result = values[0] ?? 0;
  if (!Number.isFinite(result)) {
    return { valid: false, cents: 0, hasOperator, formattedPreview: 'Errore' };
  }
  const cents = Math.max(0, Math.round(result * 100));
  return {
    valid: cents > 0,
    cents,
    hasOperator,
    formattedPreview: formatEuro(cents),
  };
}

// Local calendar helpers (strict YYYY-MM-DD without UTC timezone drift)
export function todayISO(): string {
  const now = new Date();
  return toISODate(now);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function addDaysISO(iso: string, delta: number): string {
  const dt = parseLocalDate(iso);
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
}

export function getPeriodBounds(period: PeriodSelection): { start: string; end: string } {
  const dt = parseLocalDate(period.anchorDate);
  const y = dt.getFullYear();
  const m = dt.getMonth();

  switch (period.mode) {
    case 'day':
      return { start: period.anchorDate, end: period.anchorDate };
    case 'week': {
      // Monday = 0 ... Sunday = 6
      const dayOfWeek = (dt.getDay() + 6) % 7;
      const monday = new Date(y, m, dt.getDate() - dayOfWeek, 12, 0, 0);
      const sunday = new Date(y, m, dt.getDate() - dayOfWeek + 6, 12, 0, 0);
      return { start: toISODate(monday), end: toISODate(sunday) };
    }
    case 'month': {
      // Strictly starts on the 1st of every month
      const first = new Date(y, m, 1, 12, 0, 0);
      const last = new Date(y, m + 1, 0, 12, 0, 0);
      return { start: toISODate(first), end: toISODate(last) };
    }
    case 'year': {
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    case 'custom': {
      const s = period.customStart <= period.customEnd ? period.customStart : period.customEnd;
      const e = period.customStart <= period.customEnd ? period.customEnd : period.customStart;
      return { start: s, end: e };
    }
  }
}

export function shiftPeriodAnchor(mode: PeriodMode, anchorDate: string, direction: -1 | 1): string {
  const dt = parseLocalDate(anchorDate);
  if (mode === 'day') {
    dt.setDate(dt.getDate() + direction);
  } else if (mode === 'week') {
    dt.setDate(dt.getDate() + direction * 7);
  } else if (mode === 'month') {
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + direction);
  } else if (mode === 'year') {
    dt.setFullYear(dt.getFullYear() + direction);
  }
  return toISODate(dt);
}

const IT_MONTHS_LONG = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const IT_MONTHS_SHORT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

const IT_WEEKDAYS_LONG = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

export function formatPeriodLabel(period: PeriodSelection): string {
  const today = todayISO();
  const yesterday = addDaysISO(today, -1);

  if (period.mode === 'day') {
    const dt = parseLocalDate(period.anchorDate);
    const base = `${dt.getDate()} ${IT_MONTHS_LONG[dt.getMonth()]}`;
    if (period.anchorDate === today) return `Oggi, ${base}`;
    if (period.anchorDate === yesterday) return `Ieri, ${base}`;
    return `${IT_WEEKDAYS_LONG[dt.getDay()]}, ${base} ${dt.getFullYear()}`;
  }

  if (period.mode === 'week') {
    const { start, end } = getPeriodBounds(period);
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} ${IT_MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${s.getDate()} ${IT_MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${IT_MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }

  if (period.mode === 'month') {
    const dt = parseLocalDate(period.anchorDate);
    return `${IT_MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  if (period.mode === 'year') {
    const dt = parseLocalDate(period.anchorDate);
    return `Anno ${dt.getFullYear()}`;
  }

  const { start, end } = getPeriodBounds(period);
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  return `${s.getDate()} ${IT_MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()} – ${e.getDate()} ${IT_MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
}

export function formatItalianDateHeader(iso: string): string {
  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  const dt = parseLocalDate(iso);
  const dayLabel = `${IT_WEEKDAYS_LONG[dt.getDay()]} ${dt.getDate()} ${IT_MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`;
  if (iso === today) return `Oggi · ${dayLabel}`;
  if (iso === yesterday) return `Ieri · ${dayLabel}`;
  return dayLabel;
}

export function formatShortDate(iso: string): string {
  const dt = parseLocalDate(iso);
  return `${dt.getDate()} ${IT_MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function advanceRecurringDate(iso: string, frequency: RecurringFrequency): string {
  const dt = parseLocalDate(iso);
  if (frequency === 'daily') {
    dt.setDate(dt.getDate() + 1);
  } else if (frequency === 'weekly') {
    dt.setDate(dt.getDate() + 7);
  } else if (frequency === 'monthly') {
    const origDay = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + 1);
    const maxDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(origDay, maxDay));
  } else if (frequency === 'yearly') {
    dt.setFullYear(dt.getFullYear() + 1);
  }
  return toISODate(dt);
}

export function getMonthShortName(monthIndex: number): string {
  return IT_MONTHS_SHORT[monthIndex] ?? '';
}

export async function sha256Pin(pin: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`siki-budget-pin:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash if non-secure context
  let h = 2166136261;
  const str = `siki-budget-pin:${pin}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
