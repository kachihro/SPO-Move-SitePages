/**
 * Australian date display. Formatting is pinned to DD/MM/YYYY rather than the browser locale —
 * the app runs on machines set to en-US, which would otherwise render 8/14/2026 style dates.
 */

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `DD/MM/YYYY` — empty string when the value is missing or unparseable. */
export function formatDate(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `DD/MM/YYYY HH:MM` (24-hour) — empty string when the value is missing or unparseable. */
export function formatDateTimeShort(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `DD/MM/YYYY, h:mm:ss am/pm` — empty string when the value is missing or unparseable. */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? "am" : "pm";
  return `${formatDate(date)}, ${hours12}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${suffix}`;
}
