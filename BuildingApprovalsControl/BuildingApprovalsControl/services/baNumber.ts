/**
 * BA Number is the submission timestamp, prefixed: `BA-YYYYMMDD-HHMMSS` (local time).
 * Replaces the earlier `BA-{year}-{guid suffix}` form — existing records keep whatever
 * number they were stamped with, this only applies to numbers generated from now on.
 */

const BA_NUMBER_PREFIX = "BA-";

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function generateBaNumber(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${BA_NUMBER_PREFIX}${date}-${time}`;
}
