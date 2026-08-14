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

const NAME_STORAGE_KEY = "aal-portal-contact-name";
const NAME_WINDOW_KEY = "__aalPortalContactName";
const NAME_FALLBACK = "the undersigned";

const NAME_DOM_SELECTORS = [
  "#aal-portal-contact-name",
  'input[name="aal-portal-contact-name"]',
  "[data-aal-portal-contact-name]",
];

function asDisplayName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.toLowerCase() === NAME_FALLBACK) return undefined;
  return name;
}

function readNameFromDom(): string | undefined {
  for (const doc of candidateDocuments()) {
    for (const selector of NAME_DOM_SELECTORS) {
      let el: Element | null = null;
      try {
        el = doc.querySelector(selector);
      } catch {
        continue;
      }
      if (!el) continue;

      const inputValue = (el as HTMLInputElement).value;
      const attrValue = el.getAttribute("value");
      const dataValue = el.getAttribute("data-aal-portal-contact-name");
      const textValue = el.textContent;
      const name = asDisplayName(inputValue ?? attrValue ?? dataValue ?? textValue ?? "");
      if (name) return name;
    }
  }
  return undefined;
}

/**
 * Power Pages header shows "Signed in as Rick Astley".
 *
 * Scoped to our own header rather than scanned across document.body: Power Pages renders a
 * private-site banner above the page reading "Signed in as <maker>", which is a *different*
 * identity from the portal contact. A body-wide scan matched that banner first and named the
 * wrong person in the step 3 confirmation. Never widen this back to document.body.
 */
const SIGNED_IN_AS_SCOPES = [".aal-header .org-chip", "header.aal-header", ".aal-header"];

function readNameFromSignedInAs(): string | undefined {
  for (const doc of candidateDocuments()) {
    for (const selector of SIGNED_IN_AS_SCOPES) {
      let el: Element | null = null;
      try {
        el = doc.querySelector(selector);
      } catch {
        continue;
      }
      if (!el) continue;

      const text = (el as HTMLElement).innerText ?? el.textContent ?? "";
      const match = /Signed in as\s+([^\n\r|]+)/i.exec(text);
      const name = asDisplayName(match?.[1]);
      if (name) return name;
    }
  }
  return undefined;
}

function readNameFromPortalGlobals(): string | undefined {
  for (const w of candidateWindows()) {
    try {
      const portal = w as unknown as {
        Microsoft?: {
          Dynamic365?: {
            Portal?: {
              User?: {
                userName?: string;
                fullName?: string;
                fullname?: string;
                firstName?: string;
                lastName?: string;
              };
            };
          };
        };
      };
      const user = portal.Microsoft?.Dynamic365?.Portal?.User;
      if (!user) continue;

      const direct =
        asDisplayName(user.fullName) ??
        asDisplayName(user.fullname) ??
        asDisplayName(user.userName);
      if (direct) return direct;

      const composed = asDisplayName([user.firstName, user.lastName].filter(Boolean).join(" "));
      if (composed) return composed;
    } catch {
      /* cross-origin */
    }
  }
  return undefined;
}

function readNameFromWindowGlobal(): string | undefined {
  for (const w of candidateWindows()) {
    try {
      const name = asDisplayName((w as unknown as Record<string, unknown>)[NAME_WINDOW_KEY] as string | undefined);
      if (name) return name;
    } catch {
      /* cross-origin */
    }
  }
  return undefined;
}

function readNameFromSession(): string | undefined {
  for (const w of candidateWindows()) {
    try {
      const name = asDisplayName(w.sessionStorage?.getItem(NAME_STORAGE_KEY));
      if (name) return name;
    } catch {
      /* cross-origin / blocked */
    }
  }
  return undefined;
}

function stashName(name: string): void {
  for (const w of candidateWindows()) {
    try {
      w.sessionStorage?.setItem(NAME_STORAGE_KEY, name);
    } catch {
      /* ignore */
    }
    try {
      (w as unknown as Record<string, unknown>)[NAME_WINDOW_KEY] = name;
    } catch {
      /* ignore */
    }
  }
}

/**
 * Display name for the confirmation checkbox on step 3.
 * Prefer Liquid `#aal-portal-contact-name`, then "Signed in as …" portal chrome,
 * portal globals, window/session stash. Falls back to "the undersigned".
 */
export function resolvePortalContactName(): string {
  const fromDom = readNameFromDom();
  if (fromDom) {
    stashName(fromDom);
    return fromDom;
  }

  const fromSignedIn = readNameFromSignedInAs();
  if (fromSignedIn) {
    stashName(fromSignedIn);
    return fromSignedIn;
  }

  const fromGlobals = readNameFromPortalGlobals();
  if (fromGlobals) {
    stashName(fromGlobals);
    return fromGlobals;
  }

  const fromWindow = readNameFromWindowGlobal();
  if (fromWindow) {
    stashName(fromWindow);
    return fromWindow;
  }

  const fromSession = readNameFromSession();
  if (fromSession) return fromSession;

  return NAME_FALLBACK;
}
