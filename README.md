# PAC-APP — Adelaide Airport Partner Portal

Custom PCF (Power Apps Component Framework) components for the Adelaide Airport Partner Portal
(Power Pages). See [`docs/open-questions.md`](docs/open-questions.md) for what's confirmed vs. still
assumed before this can go live.

## Layout

- `BuildingApprovalsControl/` — the Building Approvals PCF control: a React grid (list/add/edit/delete,
  with edit/delete only available on Draft submissions) plus the full multi-step Add/Edit wizard, replacing
  the native Power Pages Multistep Form. Page header/hero/footer stay native Power Pages.
- `solutions/BuildingApprovalsSolution/` — the shared Dataverse solution (publisher prefix `cr137`, matching
  the existing tenant's customization prefix) holding this and future PCF controls for the portal.
- `docs/open-questions.md` — items to confirm against the real Dataverse schema / live site before this is
  production-ready.

## Local development

```powershell
cd BuildingApprovalsControl
npm install
npm run build      # or: npm run start   to preview with pcf-start's test harness
```

`npm run start` uses PCF's local test harness with mock data — it does **not** exercise the real
`WebApiClient`/`PortalRestClient` Dataverse calls, since there's no Power Pages host or authenticated
contact in that harness. Verifying real CRUD requires `pac pcf push` into a connected dev environment and
loading the control on an actual Power Pages page (see the plan's Verification section) — this needs an
interactive `pac auth create` login and has not been done as part of this scaffold.

## Solution deployment

```powershell
pac auth create --environment <dev-environment-url>
cd BuildingApprovalsControl
pac pcf push --publisher-prefix cr137
```

`--solution-unique-name BuildingApprovalsSolution` only works once that solution has actually been
imported into the target environment (this repo's `solutions/BuildingApprovalsSolution` is just the local
source project — `pac solution init` doesn't create anything in Dataverse by itself). Until that solution
is imported, use `--publisher-prefix cr137` — `pac pcf push` creates/updates a temporary
`PowerAppsToolsTemp_cr137` solution wrapper for fast dev iteration instead.

Pushed successfully to `poc-cli` (`orga3a7d35b.crm6.dynamics.com`) as a verification spike. Note: Fluent UI
is declared as a `platform-library` in `ControlManifest.Input.xml` pinned to **9.46.2** — the
npm-installed 9.68.0 was rejected on import ("not supported by the platform") by that environment; see
`docs/open-questions.md` item 3 if a different target environment rejects 9.46.2 too.
