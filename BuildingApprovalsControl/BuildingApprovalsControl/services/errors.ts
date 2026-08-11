/**
 * Power Pages' webAPI polyfill rejects with whatever it received while parsing the failed
 * response, which is `undefined` when the body isn't the JSON OData error it expects (e.g. an
 * HTML 404 page) — so callers can't assume a rejection is an `Error` with a `.message`.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.length > 0) return err;

  const fromObject = extractODataMessage(err);
  if (fromObject) return fromObject;

  // Typical when the portal returns a non-JSON body (404 HTML). On poc-aal-pcf the table,
  // Webapi/*/enabled+fields, and Table Permission "PCF" already exist — so also try Clear
  // cache, confirm the signed-in contact has the Authenticated Users web role, and check
  // Network for the real status on /_api/cr137_buildingactivityapplications.
  return "Dataverse request failed with no error details. Check Network for /_api/cr137_buildingactivityapplications (status + response). If 404: clear Power Pages cache, confirm Web API + Table Permissions, and that your contact has Authenticated Users.";
}

function extractODataMessage(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as {
    message?: unknown;
    error?: { message?: unknown; innererror?: { message?: unknown }; code?: unknown };
    innererror?: { message?: unknown };
  };

  const candidates = [
    o.error?.innererror?.message,
    o.innererror?.message,
    o.error?.message,
    o.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return undefined;
}
