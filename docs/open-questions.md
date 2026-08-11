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
     field, now used in both clients' `retrieveMultiple` (`_cr137_portaluser_value eq <id>`). **4b. Still
     unconfirmed: the lookup's target table** (assumed `contact`, since portal users are almost always
     contacts under Table Permissions — needs confirming before `create()` ever needs to
     `@odata.bind` this field).
   - This table has **~140 columns total** — only the ones the current two wizard steps use are modeled
     in `BuildingApprovalEntity`; add more as the wizard grows (see item 5).
5. **Step 2's real checklist scope is much bigger than assumed.** The table has close to 100
   trade/discipline-specific columns beyond Electrical: water (domestic/recycled/fire/sewerage),
   excavation, structural setbacks, cranes/lifting, antennas/telecom (band, transmission power),
   security/customs-controlled areas, traffic management, landscaping, waste management, asbestos,
   heavy plant, etc. `StepFeeAndChecklist.tsx` still only models "Electrical" — this needs a scoping
   conversation (which trades/fields actually need UI in v1 vs. later) before building further, not
   guessing field-by-field.
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
- **Full checklist coverage** per item 5 above — needs scoping first.
- **Hide the native Basic Form Submit button/CAPTCHA chrome** on the live page — our control has its own
  Save Draft/Next/Submit buttons, so the form's native Submit is redundant (CAPTCHA was already turned
  off). Likely a small custom CSS rule scoped to the Approvals page.
- **Debug loop**: plan to use the PCF Dev Harness with a resource override (pointing the local harness's
  bundle at the real environment / swapping in the live bundle for local debugging) to iterate faster than
  a full `pac pcf push` per change.
- Confirm `cr137_portaluser`'s lookup target entity (item 4b) before wiring `create()` to set it.
- Anchor field's actual saved schema name — confirmed different from the `cr137_pcfanchor` originally
  suggested (the publisher-prefix picker defaulted elsewhere); doesn't matter functionally (see chat), but
  worth writing down here once known for future reference.

## Upcoming build features (flagged 2026-08-11)
1. **Prove form branching logic (Yes/No reveal further questions).** `StepFeeAndChecklist.tsx` already has
   a working example of this pattern for the "Electrical" trade (the "New supply required" checkbox reveals
   Voltage/Increased-supply-required, which itself reveals Present/Requested Supply rating) — needs
   confirming this is the pattern to replicate, and then applying it across the ~100 other trade columns
   once item 5's scoping happens, plus to the newer fields visible in the shared mockups (Description of
   Works, Purpose of Works, Estimated Start/Completion Date) that aren't modeled in
   `types/BuildingApproval.ts` yet — **don't guess real column names for these, confirm against the schema
   first**, same rule as item 4.
2. **Finalise 'Draft' functionality for users to continue applications.** Largely already implemented:
   `ApprovalWizard`'s `persist()` is create-once-then-always-update via explicit `recordId` state (fixes
   the duplicate-draft bug below), and edit/view mode loads the record via `client.retrieve(recordId)` on
   mount. "Finalise" likely means end-to-end verification against the real environment (a `pac pcf push` +
   live resume test), not new code — confirm with the user before assuming further build work is needed
   here.
3. **Workflow connected to the 'Submit' button for form data transfer.** `handleSubmit()` already persists
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
