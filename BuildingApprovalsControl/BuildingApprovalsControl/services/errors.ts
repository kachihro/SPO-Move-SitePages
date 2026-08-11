/**
 * Power Pages' webAPI polyfill rejects with whatever it received while parsing the failed
 * response, which is `undefined` when the body isn't the JSON OData error it expects (e.g. an
 * HTML 404 page) — so callers can't assume a rejection is an `Error` with a `.message`.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  // Typical when the portal returns a non-JSON body (404 HTML). On poc-aal-pcf the table,
  // Webapi/*/enabled+fields, and Table Permission "PCF" already exist — so also try Clear
  // cache, confirm the signed-in contact has the Authenticated Users web role, and check
  // Network for the real status on /_api/cr137_buildingactivityapplications.
  return "Dataverse request failed with no error details. Check Network for /_api/cr137_buildingactivityapplications (status + response). If 404: clear Power Pages cache, confirm Web API + Table Permissions, and that your contact has Authenticated Users.";
}
