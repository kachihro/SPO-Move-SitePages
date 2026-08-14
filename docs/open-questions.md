# Open questions

Tracked from the implementation plan (`we-want-to-have-structured-treasure.md`). Confirm these before/while
building further — do not guess at real values in code.

1. ~~Does `context.webAPI` work inside a Power Pages-hosted PCF, and does the signed-in CIAM contact
   resolve correctly through it?~~ — **resolved, yes.** Confirmed live on `poc-cli`
   (`orga3a7d35b.crm6.dynamics.com`): `WebApiClient` (bound via `index.ts`) successfully called
   `context.webAPI` from the actual published Approvals page while signed in as a real CIAM portal
   contact (not admin/maker preview) — the grid rendered and reached the Dataverse Web API. No need to
   fall back to `PortalRestClient` on this environment. Still worth re-verifying if this ever targets a
   different Power Pages environment/version.
2. **Anti-forgery token retrieval mechanism** for the live site — now lower priority since (1) resolved
   in favor of `WebApiClient`, but `PortalRestClient` is kept as a fallback. `getToken()` currently
   assumes `window.shell.getTokenDeferred()` — unconfirmed, only matters if `PortalRestClient` ever needs
   to be swapped in.
3. ~~Bundled React/Fluent version~~ — **resolved**: React 16.14.0 as a PCF `platform-library`. Fluent
   9.68.0 (npm-installed) was rejected on import ("not supported by the platform"); pinned to **9.46.2**,
   which imports and renders successfully. Bundling Fluent ourselves instead blows past PCF's 5MB
   bundle-size limit (~6.2MB) via `@fluentui/react-icons` — not worth it given the platform-library pin
   works.
4. ~~Real Dataverse table logical name~~ — **resolved**. Pulled via
   `pac modelbuilder build --entitynamesfilter cr137_buildingactivityapplication` against `poc-cli`:
   - Table: `cr137_buildingactivityapplication`, entity set `cr137_buildingactivityapplications`, PK
     `cr137_buildingactivityapplicationid`
   - BA Number: `cr137_buildingactivitynumber`; Application date: `cr137_applicationdate`
   - Status choice (`cr137_applicationstatus`) confirmed values: Draft=466860000, Submitted=466860001,
     Processing=466860002, Approved=466860003, Denied=466860004
   - **"Lessee Details" in the UI is actually `cr137_owner*` in the table** (`cr137_ownername`,
     `cr137_ownerpostaladdress`, `cr137_ownercontactperson`, `cr137_owneremail`, `cr137_ownertelephone`)
     — not `cr137_lessee*` as originally guessed. Code now uses `owner` (see
     `types/BuildingApproval.ts`), not `lessee`.
   - Building Contractor Name: `cr137_buildingcontractornamw` — **typo baked into the real column, kept
     intentionally** in code, don't "fix" it.
   - Location of Works → `cr137_worklocation`. Fee fields → `cr137_estimatedbuildingactivityvalue`
     (Money), `cr137_feeamounttype` (choice, values 1–5, see `FEE_AMOUNT_TYPE_OPTIONS`). Attached
     Documents → `cr137_supportingdocuments`.
   - **`cr137_portaluser`** is a lookup (`EntityReference`) — this is the real "my submissions" scoping
     field (client-side filter on `_cr137_portaluser_value`). **4b. resolved**: Target is `contact`.
     Writes must use `"cr137_PortalUser@odata.bind": "/contacts(<id>)"` (nav prop). Direct
     `_cr137_portaluser_value` updates → CDS `0x80060888`; path-in-`_value` → `0x80048d19`.
     Power Pages' PCF `webAPI` polyfill strips `@odata.bind`, so `WebApiClient` PATCHes the lookup
     via raw portal `/_api/` (`portalApi.ts`) after create/update of scalar fields.
   - This table has **~140 columns total** — only the ones the current wizard steps use are modeled in
     `BuildingApprovalEntity`; add more as the wizard grows (see item 5).
5. **Step 2's real checklist scope.** Resolved which columns exist (full pull below), but only a subset is
   built. The source PDF (`APPLICATION FOR BUILDING ACTIVITY CONSENT`, shared 2026-08-11) has 23 checklist
   categories; `pac modelbuilder build` against `poc-cli` on the same date confirmed the real column list
   for all of them. **Modeled today** (`types/BuildingApproval.ts`, `StepFeeAndChecklist.tsx`): Electrical
   (`cr137_electricalsupplyapplicationrequir`, `cr137_meterprovided`, `cr137_ampsperphase`,
   `cr137_totalpowerdemand`, `cr137_electricalmaximumdemandandsupply`), Hydraulics (per-utility
   `cr137_domesticwater*`/`cr137_recycledwater*`/`cr137_sewerage*`/`cr137_firewater*` fields plus
   `cr137_backflowpreventiondeviceconfirmat`), and Security (`cr137_securityrestrictedarea`,
   `cr137_customscontrolledarea`, `cr137_sterilearea`, `cr137_airsidefencechangerequired`,
   `cr137_securitydesigndetails`). **~20 categories not yet built** (Application Documentation,
   Development Details, Certificates, Site Services, Lighting, Communications, Stormwater, Fire
   Engineering, Gas, Ventilation, Radio Interference, Structure, DDA, Environment/Sustainability,
   Excavation, Waste Management, Asbestos, Dust/Fumes/Odours, Hazardous Materials, Construction Activity)
   — column names for these were also pulled and are known, just not wired into the type/mapping/UI yet.
   Notable findings from the pull, worth knowing before building the rest:
   - The PDF's Yes/No/N/A checkbox rows are **plain nullable `bool` columns**, not a three-state choice —
     "unanswered" (neither radio selected) stands in for N/A. See `YesNoField.tsx`.
   - Several rows that *look* like Yes/No/N/A on paper are actually **free-text `string` columns** in the
     real schema — confirmed, not a guess: `cr137_masterplanreference`, `cr137_environmentalstrategy`,
     `cr137_mdpdetails` (page 2 "Works Comply With"), and `cr137_securitydesigndetails` (Security's last
     row). Render these as text inputs, not Yes/No toggles.
   - The PDF's "Building Contractor" section fields (everything except Name) map to `cr137_consultant*`
     columns, not `cr137_buildingcontractor*` — same "UI label ≠ column name" quirk as Owner/Lessee.
   - **Gas** (category 11) uses generic, unprefixed column names — `cr137_connectionrequired`,
     `cr137_meterprovidedforconnection`, `cr137_demandforconnection` — while every other utility
     (domestic/recycled/sewerage/fire water) got its own prefixed columns. Confirmed by matching the
     PDF's field order/shape, not by a `cr137_gas*` name existing (it doesn't) — double-check this
     mapping against a live record before wiring Gas's UI.
   - The PDF's "Number of Phases" (1/2/3) under Electrical has **no dedicated column** — captured as free
     text inside `cr137_electricalmaximumdemandandsupply` instead (see the field's comment in
     `types/BuildingApproval.ts`).
   - `cr137_applicantsignature` + `cr137_signaturedate` back the page-2 "Signature of Owner or Agent"
     section — there's only one signature field (not separate applicant/owner signatures).
6. **Who owns the Draft-only-edit enforcement plugin.** Still not built — grid/wizard only gate
   Edit/Delete client-side today.
7. ~~Whether re-pulling the code-site export changes embedding assumptions~~ — **superseded**: turned out
   embedding doesn't go through Liquid/code-site files at all for this — it's a Basic Form ("PCF" form)
   with the `BuildingApprovalsControl` component attached to the `cr0e0_pcfanchor`/anchor field via the
   classic Dataverse form designer (or the modern Design Studio's "Enable code component field" toggle,
   which does the same thing), referenced by a Form component on the Approvals page. Confirmed working
   end-to-end live.
8. **Existing Adelaide Airport ALM/pipeline tooling, if any.** None found in this repo — confirm with
   their platform team before assuming a specific CI mechanism.
9. **404 on `cr137_buildingactivityapplications` against `poc-aal-pcf.powerappsportals.com`** (seen
   2026-08-11) — this is a *different* portal host than the one item 1 was confirmed against
   (`poc-cli`/`orga3a7d35b.crm6.dynamics.com`). Entity set name is correct per item 4, so this is almost
   certainly environment config on `poc-aal-pcf`, not a code bug: either the `cr137_buildingactivityapplication`
   table/solution hasn't been imported into that environment yet, or the table has no Table Permissions
   configured for it on that portal (Power Pages returns 404, not 403, when a table lacks Table
   Permissions — a common footgun). Confirm which before assuming the client code needs changes. Separately,
   `WebApiClient`'s promise sometimes rejected with `undefined` (not an `Error`) when this happened, which
   crashed the UI's own `catch` blocks and hid the real failure — fixed via `services/errors.ts`'s
   `getErrorMessage()`, now used in every `ApprovalWizard`/`SubmissionsGrid` catch site, independent of
   root-causing the 404 itself.
10. **Attachments (`annotation`) on `poc-aal-pcf`** — list and upload both failed 2026-08-14 with
    `Resource not found for the segment 'annotation'`. Not a code bug: the control correctly requests the
    entity *set* (`/_api/annotations`), but Power Pages' Web API resolves the segment to the *logical* name
    and only serves tables allow-listed by site settings — hence the singular name in the error.
    **Site settings added 2026-08-14** on the `poc-aal-pcf` website: `Webapi/annotation/enabled` = `true`,
    `Webapi/annotation/fields` (must include `documentbody` and `objectid`, or upload fails even once the
    segment resolves), `Webapi/error/innererror` = `true`. Still to confirm on that portal: a **Table
    Permission for Note (annotation)** with Create/Read/Write/Delete granted to the contacts' web role —
    ideally a child permission off the building-approval permission via the
    `cr137_buildingactivityapplication_Annotations` relationship, so a user only reaches notes on their own
    applications. Clear the site cache after both. If upload still fails once those are in place, the next
    suspect is the polymorphic bind `objectid_cr137_buildingactivityapplication@odata.bind`
    (`PortalAnnotationClient.upload`) — unconfirmed whether the portal Web API accepts type-suffixed
    polymorphic navigation binds; the fallback is creating the note through the child-relationship path.

## Still to do (next session)
- ~~**Styling**~~ — **done**: custom Fluent brand theme (`components/theme.ts`, magenta/pink ramp
  approximated from the target mockups) applied via `FluentProvider`; grid wrapped in a rounded/bordered
  card with a muted header row and colored status badges; BA Number rendered as a styled link; empty state
  added. All primary actions (Create, Cancel/Prev/Save Draft/Next/Submit, step tabs) now use a shared
  `HeroButton`/pill treatment (`components/HeroButton.tsx`) matching the full-flow mockups shared
  2026-08-11, which showed every wizard footer button and the step tabs as solid gradient pills, not just
  the primary action — confirmed via computed-style checks in the PCF test harness (`npm run start`), not
  just visually. Still worth a real-environment pass to confirm the brand hex values against any official
  design tokens if/when supplied. **Not** in this control's scope (native Power Pages page chrome per item
  7): the login/dashboard pages, the page eyebrow/title/breadcrumb text, and hiding the native Basic Form
  Submit button — those live outside this repo.
- **Full checklist coverage** per item 5 above — Electrical/Hydraulics/Security built 2026-08-11; ~20
  categories remain, column names already known from the same schema pull.
- **Hide the native Basic Form Submit button/CAPTCHA chrome** on the live page — our control has its own
  Save Draft/Next/Submit buttons, so the form's native Submit is redundant (CAPTCHA was already turned
  off). Likely a small custom CSS rule scoped to the Approvals page.
- **Hide the native "PCF Anchor" field label** (`<label id="cr0e0_pcfanchor_label">`) that the classic
  Basic Form renders above the control (per item 7, it's a Form/Design Studio field label, not something
  this repo's code renders or can reach). Same fix as the Submit button above — add to that page's Custom
  CSS in Power Pages Studio (Portal Management → the Approvals page → Advanced → Custom CSS, or the
  page's own web-page CSS content if it has one):
  ```css
  #cr0e0_pcfanchor_label { display: none; }
  ```
- **Debug loop**: plan to use the PCF Dev Harness with a resource override (pointing the local harness's
  bundle at the real environment / swapping in the live bundle for local debugging) to iterate faster than
  a full `pac pcf push` per change.
- Confirm `cr137_portaluser`'s lookup target entity (item 4b) before wiring `create()` to set it.
- Anchor field's actual saved schema name — confirmed different from the `cr137_pcfanchor` originally
  suggested (the publisher-prefix picker defaulted elsewhere); doesn't matter functionally (see chat), but
  worth writing down here once known for future reference.

## Upcoming build features (flagged 2026-08-11)
1. ~~**Prove form branching logic (Yes/No reveal further questions).**~~ — **demonstrated**:
   `StepFeeAndChecklist.tsx`'s Electrical section only reveals Meter Provided/Amps Per Phase/Total Power
   Demand/details once "Application for electrical supply required" is Yes, and Hydraulics only reveals
   each utility's Meter Provided/Demand once that utility's "Connection required" is Yes — verified
   working in the PCF test harness (radio toggle → fields appear), not just read from source. Applying
   the same pattern to the ~20 remaining checklist categories is just repetition of this pattern once each
   category's real fields are wired in (see item 5) — no further design questions here. Description of
   Works/Purpose of Works/Estimated Start-Completion Date are now modeled too
   (`cr137_workdescription`/`cr137_workpurpose`/`cr137_estimatedstartdate`/`cr137_estimatedcompletiondate`).
2. **Finalise 'Draft' functionality for users to continue applications.** Largely already implemented:
   `ApprovalWizard`'s `persist()` is create-once-then-always-update via explicit `recordId` state (fixes
   the duplicate-draft bug below), and edit/view mode loads the record via `client.retrieve(recordId)` on
   mount. "Finalise" likely means end-to-end verification against the real environment (a `pac pcf push` +
   live resume test), not new code — confirm with the user before assuming further build work is needed
   here.
3. ~~**Supporting document upload on step 3.**~~ — **built** (2026-08-14). Step 3's 100-char
   `cr137_supportingdocuments` textarea is replaced by a real upload grid backed by Dataverse Notes
   (`annotation`) regarding the application. Uploads go through raw `/_api/` (`PortalAnnotationClient`),
   **not** `context.webAPI` — the polyfill strips the `objectid_...@odata.bind` the note needs and would
   orphan it. `cr137_supportingdocuments` is left in the schema/mapping but is no longer bound to any UI
   field. Maker-side config (Site Settings, Table Permissions, the SharePoint sync flow) and the live test
   script are in `docs/attachments-setup.md` — **none of this works on a live portal until that is done**.
   Also fixed in passing: `WizardStepper`'s `onSelect` went straight to `setStep`, so a new application
   could reach step 3 with no saved record; it now persists before jumping forward.
4. **Workflow connected to the 'Submit' button for form data transfer.** `handleSubmit()` already persists
   the record with `ApplicationStatus.Submitted`. The actual downstream workflow (Power Automate flow or
   Dataverse plugin reacting to that status change) is server-side infrastructure outside this PCF
   control's code — needs a scoping conversation (what should happen on submit — notify staff? create a
   case? call an external system?) before any of it can be built.

## Known bugs in the native implementation this rebuild is meant to fix
- Duplicate draft record created on Save Draft.
- Draft not reloading correctly on resume (and portal user/contact link not persisted).
- Moving to the next page appearing to create a new record.
- Grid column misalignment (Status column position).
- Submissions list showing everyone's applications, not just the signed-in user's.

`ApprovalWizard.tsx`'s `persist()` (create-once-then-always-update via an explicit `recordId` in
component state) targets the first three. `WebApiClient.retrieveMultiple` filtering by `cr137_portaluser`
(now the real, confirmed lookup field) targets the last one.
