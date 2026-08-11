/**
 * Power Pages does not reliably populate context.userSettings.userId (that's a model-driven
 * convention). Prefer a Liquid-rendered hidden field on the page, then fall back to userSettings.
 *
 * Add this to the Submissions page (content snippet / web template / page copy):
 *   <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" />
 */

const DOM_SELECTORS = [
  "#aal-portal-contact-id",
  "#contactId",
  'input[name="aal-portal-contact-id"]',
  "[data-aal-portal-contact-id]",
];

function normalizeGuid(value: string): string {
  return value.replace(/[{}]/g, "").trim();
}

function isGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function readFromDom(): string | undefined {
  if (typeof document === "undefined") return undefined;

  for (const selector of DOM_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;

    const inputValue = (el as HTMLInputElement).value;
    const attrValue = el.getAttribute("value");
    const dataValue = el.getAttribute("data-aal-portal-contact-id");
    const textValue = el.textContent;
    const raw = inputValue ?? attrValue ?? dataValue ?? textValue ?? "";
    const id = normalizeGuid(raw);
    if (isGuid(id)) return id;
  }

  return undefined;
}

export function resolvePortalContactId(userSettingsUserId?: string | null): string {
  const fromDom = readFromDom();
  if (fromDom) return fromDom;

  const fromContext = normalizeGuid(userSettingsUserId ?? "");
  if (isGuid(fromContext)) return fromContext;

  return "";
}

export const MISSING_CONTACT_ID_MESSAGE =
  'Signed-in contact id is missing. On the Power Pages Submissions page add: <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" /> then clear the portal cache.';
