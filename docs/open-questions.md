# Open questions

Tracked from the implementation plan (`we-want-to-have-structured-treasure.md`). Confirm these before/while
building further — do not guess at real values in code.

1. **Does `context.webAPI` work inside this tenant's Power Pages-hosted PCF, and does the signed-in CIAM
   contact resolve correctly through it?** Do the verification spike first, against
   `https://site-df48x.powerappsportals.com/`, logged in via the real CIAM external identity flow (not as
   admin). `index.ts` currently uses `WebApiClient`; if the spike shows `context.webAPI` doesn't work,
   swap to `PortalRestClient` (already implemented, unused pending this decision).
2. **Anti-forgery token retrieval mechanism** for the live site, if the REST fallback is needed.
   `PortalRestClient.getToken()` currently assumes `window.shell.getTokenDeferred()` — confirm this is
   still how the deployed portal exposes it, or find the actual mechanism (meta tag / hidden field).
3. ~~Bundled React version~~ — **resolved**: React 16.14.0, Fluent UI 9.68.0, both loaded as PCF
   `platform-library` resources (not bundled), per the scaffolded `ControlManifest.Input.xml`.
4. **Real Dataverse table logical name.** Prefix `cr137` and the `cr137_applicationstatus` column are
   confirmed from the design doc; the table name and every other field's logical name in
   `types/BuildingApproval.ts` / `services/WebApiClient.ts` / `services/PortalRestClient.ts` are
   placeholders. Re-pull `pac pages download-website` including forms/lists, or check
   `make.powerapps.com`, then update `BUILDING_APPROVAL_ENTITY_SET` and the `cr137_*` field names
   throughout.
5. **Full list of per-trade conditional checklist panels on Step 2.** Only "Electrical" is confirmed from
   the design-doc screenshot (`StepFeeAndChecklist.tsx`'s `KNOWN_TRADES`). Confirm the rest (Plumbing,
   Mechanical, etc.) and any Step 1 fields below the fold not captured in the screenshots.
6. **Who owns the Draft-only-edit enforcement plugin.** The grid/wizard only gate Edit/Delete
   client-side today (`SubmissionsGrid`, `ApprovalWizard`'s `mode="view"`) — a Dataverse plugin on
   Update/Delete is required for actual server-side enforcement and hasn't been built.
7. **Whether re-pulling the code-site export changes any embedding assumptions.** The
   `aal-sandbox-current` export provided only contains the default "Blank Template" scaffold — no
   Building Approvals web page/form/list. Confirm the Liquid/Basic Form wiring steps once that's pulled.
8. **Existing Adelaide Airport ALM/pipeline tooling, if any.** None found in this repo — confirm with
   their platform team before assuming a specific CI mechanism.

## Known bugs in the native implementation this rebuild is meant to fix
- Duplicate draft record created on Save Draft.
- Draft not reloading correctly on resume (and portal user/contact link not persisted).
- Moving to the next page appearing to create a new record.
- Grid column misalignment (Status column position).
- Submissions list showing everyone's applications, not just the signed-in user's.

`ApprovalWizard.tsx`'s `persist()` (create-once-then-always-update via an explicit `recordId` in
component state) targets the first three. `WebApiClient.retrieveMultiple` / `PortalRestClient.retrieveMultiple`
filtering by `contactId` targets the last one — but only once the real lookup column name (currently a
`_cr137_contact_value` placeholder) is confirmed per item 4 above.
