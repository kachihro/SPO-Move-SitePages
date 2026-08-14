/**
 * Australian date display. Two things are deliberately taken away from the browser:
 *
 * - **Locale** — formatting is pinned to DD/MM/YYYY rather than the browser locale, because the app
 *   runs on machines set to en-US, which would otherwise render 8/14/2026 style dates.
 * - **Time zone** — Dataverse returns UTC (`createdon` is a full UTC timestamp), and the grid must
 *   read as Adelaide local time regardless of where the browser is. `Australia/Adelaide` is used
 *   rather than a fixed +09:30 offset so the ACST/ACDT switch is handled automatically.
 *
 * Date Only columns (e.g. `cr137_applicationdate`) arrive as `YYYY-MM-DD` and parse as UTC midnight;
 * Adelaide is ahead of UTC, so they still render on the same calendar day.
 */

const TIME_ZONE = "Australia/Adelaide";

interface DateParts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  second: string;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The instant's calendar/clock fields in Adelaide. Falls back to browser-local if tz data is absent. */
function adelaideParts(date: Date): DateParts {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const hour = get("hour");
    const year = get("year");
    if (!year) throw new Error("no parts");

    return {
      day: get("day"),
      month: get("month"),
      year,
      // Some engines emit "24" for midnight under hour12:false.
      hour: hour === "24" ? "00" : hour,
      minute: get("minute"),
      second: get("second"),
    };
  } catch {
    return {
      day: pad(date.getDate()),
      month: pad(date.getMonth() + 1),
      year: String(date.getFullYear()),
      hour: pad(date.getHours()),
      minute: pad(date.getMinutes()),
      second: pad(date.getSeconds()),
    };
  }
}

/** `DD/MM/YYYY` in Adelaide time — empty string when the value is missing or unparseable. */
export function formatDate(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const p = adelaideParts(date);
  return `${p.day}/${p.month}/${p.year}`;
}

/** `DD/MM/YYYY HH:MM` (24-hour, Adelaide) — empty string when the value is missing or unparseable. */
export function formatDateTimeShort(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const p = adelaideParts(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** `DD/MM/YYYY, h:mm:ss am/pm` (Adelaide) — empty string when the value is missing or unparseable. */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const p = adelaideParts(date);
  const hours24 = Number(p.hour);
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? "am" : "pm";
  return `${p.day}/${p.month}/${p.year}, ${hours12}:${p.minute}:${p.second} ${suffix}`;
}
