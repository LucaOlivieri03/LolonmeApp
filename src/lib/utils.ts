import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS_SHORT_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const MONTHS_LONG_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Formats an ISO date string (YYYY-MM-DD) into a readable Spanish label (e.g., "12 abr 2026").
 */
export function formatDateEs(isoDate: string, options?: { omitYear?: boolean }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthName = MONTHS_SHORT_ES[monthIdx] ?? match[2];
  return options?.omitYear ? `${day} ${monthName}` : `${day} ${monthName} ${year}`;
}

/**
 * Formats a YYYY-MM key into a Spanish month heading (e.g., "Abril 2026").
 */
export function formatMonthKeyEs(yyyyMm: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm.trim());
  if (!match) return yyyyMm;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const monthName = MONTHS_LONG_ES[monthIdx] ?? match[2];
  return `${monthName} ${year}`;
}

/**
 * Formats an Argentine Peso amount cleanly without decimals.
 */
export function formatArs(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const formatted = Math.abs(Math.round(amount)).toLocaleString("es-AR");
  return `${sign}$${formatted}`;
}

/**
 * Returns today's ISO date (YYYY-MM-DD) in Argentina timezone (America/Argentina/Buenos_Aires).
 */
export function getTodayIsoAr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
