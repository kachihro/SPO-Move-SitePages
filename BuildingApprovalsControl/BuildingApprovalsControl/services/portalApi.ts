/**
 * Raw Power Pages `/_api/` helpers. Used when context.webAPI cannot carry a payload shape
 * (notably lookup binds: CDS requires nav-property `@odata.bind` / `/$ref`, while writing
 * `_xxx_value` yields 0x80060888, and the PCF webAPI polyfill strips `@odata.bind` keys).
 */

declare global {
  interface Window {
    shell?: { getTokenDeferred?: () => Promise<string> };
  }
}

async function requestVerificationToken(): Promise<string | undefined> {
  try {
    const fromShell = await window.shell?.getTokenDeferred?.();
    if (fromShell) return fromShell;
  } catch {
    /* fall through */
  }

  const input = document.querySelector<HTMLInputElement>(
    'input[name="__RequestVerificationToken"], input[name="__requestverificationtoken"]'
  );
  return input?.value ?? undefined;
}

async function portalApiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const token = await requestVerificationToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
  };
  // Only on requests that actually carry a body — a bodyless DELETE declaring a JSON
  // content type is a needless 415 risk.
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.__RequestVerificationToken = token;

  const url = `${window.location.origin.replace(/\/$/, "")}/_api/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = (await res.json()) as {
        error?: { message?: string; innererror?: { message?: string } };
        message?: string;
      };
      detail =
        json.error?.innererror?.message ?? json.error?.message ?? json.message ?? detail;
    } catch {
      /* keep status text */
    }
    throw new Error(`Portal /_api/ ${method} ${path} failed: ${detail}`);
  }
  return res;
}

/**
 * Read a JSON body defensively: Power Pages sometimes answers 200 with an empty body, which
 * throws inside `res.json()`. Read text first, parse only when there is something to parse.
 */
async function readJson<T>(res: Response): Promise<T | undefined> {
  if (res.status === 204 || res.headers.get("Content-Length") === "0") return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

export async function portalApiPatch(entitySetPath: string, body: Record<string, unknown>): Promise<void> {
  await portalApiRequest("PATCH", entitySetPath, body);
}

export async function portalApiGet<T>(path: string): Promise<T | undefined> {
  return readJson<T>(await portalApiRequest("GET", path));
}

/**
 * Create a record and return its id. Power Pages answers 204 with the id only in the
 * `OData-EntityId` header — readable here because the request is same-origin (no CORS
 * header filtering). `idField` is the fallback for hosts that return a representation.
 */
export async function portalApiPost(
  entitySetPath: string,
  body: Record<string, unknown>,
  idField?: string
): Promise<string | undefined> {
  const res = await portalApiRequest("POST", entitySetPath, body);

  const header = res.headers.get("OData-EntityId") ?? res.headers.get("odata-entityid");
  const fromHeader = header ? /\(([0-9a-fA-F-]{36})\)/.exec(header)?.[1] : undefined;
  if (fromHeader) return fromHeader;

  const json = await readJson<Record<string, unknown>>(res);
  const value = idField ? json?.[idField] : undefined;
  return typeof value === "string" ? value : undefined;
}

export async function portalApiDelete(entitySetPath: string): Promise<void> {
  await portalApiRequest("DELETE", entitySetPath);
}

/**
 * Associate a single-valued lookup via OData reference (never writes `_xxx_value`).
 * Tries PUT then POST on /_api/{entitySet}({id})/{navProp}/$ref.
 */
export async function portalApiBindLookup(
  entitySet: string,
  recordId: string,
  navigationProperty: string,
  targetEntitySet: string,
  targetId: string
): Promise<void> {
  const base = `${window.location.origin.replace(/\/$/, "")}/_api`;
  const path = `${entitySet}(${recordId})/${navigationProperty}/$ref`;
  const body = { "@odata.id": `${base}/${targetEntitySet}(${targetId})` };

  try {
    await portalApiRequest("PUT", path, body);
  } catch (putErr: unknown) {
    try {
      await portalApiRequest("POST", path, body);
    } catch (postErr: unknown) {
      const putMsg = putErr instanceof Error ? putErr.message : String(putErr);
      const postMsg = postErr instanceof Error ? postErr.message : String(postErr);
      throw new Error(`/$ref bind failed (PUT: ${putMsg}; POST: ${postMsg})`);
    }
  }
}
