/**
 * Power Pages does not reliably populate context.userSettings.userId (that's a model-driven
 * convention). Prefer a Liquid-rendered value on the host page, then fall back to userSettings /
 * sessionStorage.
 *
 * On the Submissions page (outside the Basic Form):
 *   {% if user %}
 *   <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" />
 *   <script>window.__aalPortalContactId = "{{ user.id }}";</script>
 *   {% endif %}
 *
 * Then clear the portal cache and confirm View Source shows a real GUID — not an empty value.
 */

const STORAGE_KEY = "aal-portal-contact-id";
const WINDOW_KEY = "__aalPortalContactId";

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

function asGuid(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const id = normalizeGuid(raw);
  return isGuid(id) ? id : undefined;
}

/** Documents the PCF can see — own frame, then parent/top when same-origin (Power Pages). */
function candidateDocuments(): Document[] {
  const docs: Document[] = [];
  const add = (doc: Document | null | undefined) => {
    if (doc && !docs.includes(doc)) docs.push(doc);
  };

  try {
    add(typeof document !== "undefined" ? document : undefined);
  } catch {
    /* ignore */
  }

  try {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      add(window.parent.document);
    }
  } catch {
    /* cross-origin */
  }

  try {
    if (typeof window !== "undefined" && window.top && window.top !== window) {
      add(window.top.document);
    }
  } catch {
    /* cross-origin */
  }

  return docs;
}

function candidateWindows(): Window[] {
  const windows: Window[] = [];
  const add = (w: Window | null | undefined) => {
    if (w && !windows.includes(w)) windows.push(w);
  };

  try {
    add(typeof window !== "undefined" ? window : undefined);
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== "undefined") add(window.parent);
  } catch {
    /* cross-origin */
  }
  try {
    if (typeof window !== "undefined") add(window.top);
  } catch {
    /* cross-origin */
  }

  return windows;
}

function readFromDom(): string | undefined {
  for (const doc of candidateDocuments()) {
    for (const selector of DOM_SELECTORS) {
      let el: Element | null = null;
      try {
        el = doc.querySelector(selector);
      } catch {
        continue;
      }
      if (!el) continue;

      const inputValue = (el as HTMLInputElement).value;
      const attrValue = el.getAttribute("value");
      const dataValue = el.getAttribute("data-aal-portal-contact-id");
      const textValue = el.textContent;
      const id = asGuid(inputValue ?? attrValue ?? dataValue ?? textValue ?? "");
      if (id) return id;
    }
  }

  return undefined;
}

function readFromWindowGlobal(): string | undefined {
  for (const w of candidateWindows()) {
    try {
      const id = asGuid((w as unknown as Record<string, unknown>)[WINDOW_KEY] as string | undefined);
      if (id) return id;
    } catch {
      /* cross-origin */
    }
  }
  return undefined;
}

function readFromSession(): string | undefined {
  for (const w of candidateWindows()) {
    try {
      const id = asGuid(w.sessionStorage?.getItem(STORAGE_KEY));
      if (id) return id;
    } catch {
      /* cross-origin / blocked */
    }
  }
  return undefined;
}

function stash(id: string): void {
  for (const w of candidateWindows()) {
    try {
      w.sessionStorage?.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    try {
      (w as unknown as Record<string, unknown>)[WINDOW_KEY] = id;
    } catch {
      /* ignore */
    }
  }
}

/** Optional Power Pages / portal globals some sites expose. */
function readFromPortalGlobals(): string | undefined {
  for (const w of candidateWindows()) {
    try {
      const portal = w as unknown as {
        Microsoft?: { Dynamic365?: { Portal?: { User?: { contactId?: string; id?: string } } } };
        shell?: { getContactId?: () => string };
      };

      const fromMs =
        asGuid(portal.Microsoft?.Dynamic365?.Portal?.User?.contactId) ??
        asGuid(portal.Microsoft?.Dynamic365?.Portal?.User?.id);
      if (fromMs) return fromMs;

      const fromShell = asGuid(portal.shell?.getContactId?.());
      if (fromShell) return fromShell;
    } catch {
      /* cross-origin */
    }
  }
  return undefined;
}

export function resolvePortalContactId(userSettingsUserId?: string | null): string {
  const fromDom = readFromDom();
  if (fromDom) {
    stash(fromDom);
    return fromDom;
  }

  const fromWindow = readFromWindowGlobal();
  if (fromWindow) {
    stash(fromWindow);
    return fromWindow;
  }

  const fromGlobals = readFromPortalGlobals();
  if (fromGlobals) {
    stash(fromGlobals);
    return fromGlobals;
  }

  const fromContext = asGuid(userSettingsUserId);
  if (fromContext) {
    stash(fromContext);
    return fromContext;
  }

  const fromSession = readFromSession();
  if (fromSession) return fromSession;

  return "";
}

export const MISSING_CONTACT_ID_MESSAGE =
  'Signed-in contact id is missing. On Submissions, View Source and confirm #aal-portal-contact-id has a real GUID (not empty). Use {% if user %}<input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" /><script>window.__aalPortalContactId="{{ user.id }}";</script>{% endif %} then clear portal cache. Sign in as a portal contact — maker preview / anonymous leaves user.id blank.';
