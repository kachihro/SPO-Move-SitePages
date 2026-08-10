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
pac pcf push --publisher-prefix cr137 --solution-unique-name BuildingApprovalsSolution
```

Not run as part of this scaffold — requires an interactive login against the real Adelaide Airport
Dataverse environment.
