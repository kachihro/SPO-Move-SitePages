/**
 * BA Number format matches legacy portal HTML (`submissions-page-content.html`):
 * `BA-{year}-{suffix}` where suffix is the last 6 hex chars of the record GUID.
 */

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => ("0" + b.toString(16)).slice(-2))
      .join("")
      .toUpperCase();
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function generateBaNumber(recordId: string): string {
  const year = String(new Date().getFullYear());
  const idSrc = String(recordId || "").replace(/[{}-]/g, "");
  const suffix = idSrc.length >= 6 ? idSrc.slice(-6).toUpperCase() : randomSuffix();
  return `BA-${year}-${suffix}`;
}
