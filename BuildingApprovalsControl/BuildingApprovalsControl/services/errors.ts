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
  // Typical when the portal returns a non-JSON body (often 404 because Table Permissions are
  // missing, or the table isn't in this environment) — see docs/open-questions.md item 9.
  return "Dataverse request failed with no error details. Check the Network tab for a 404/403 on cr137_buildingactivityapplications (often missing Table Permissions).";
}
