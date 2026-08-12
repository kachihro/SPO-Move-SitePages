# Site Pages — Move to Folder

SPFx **List View Command Set** that adds a **Move to folder** action to the Site Pages library. Select a modern page (`.aspx`), pick a destination site and folder, and move the page with PnPjs — same-site via `moveByPath`, cross-site via copy + selected metadata + delete source.

| | |
| --- | --- |
| **Author** | [Kachihro](https://www.kachihro.com) |
| **Website** | [www.kachihro.com](https://www.kachihro.com) |
| **SPFx** | 1.23.0 |
| **Node** | `>=22.14.0 < 23.0.0` |
| **UI** | Fluent UI React v9 |
| **Data** | PnPjs (`@pnp/sp`) |

![version](https://img.shields.io/badge/SPFx-1.23.0-green.svg)
![node](https://img.shields.io/badge/node-22.x-blue.svg)

---

## Screenshot

![Move page to folder dialog](./assets/move-page-to-folder-dialog.png)

*Move page to folder dialog — site picker, searchable Site Pages folder tree, destination summary, Move / Cancel actions.*

---

## Functional

### Purpose

Give content owners and site authors a first-class way to **reorganize Site Pages into folders** (same site or another site) without leaving the Site Pages library.

### End-user journey

1. Open the site **Site Pages** library (any view that shows list items).
2. Select **one** modern page (`.aspx`).
3. Choose **Move to folder** from the command bar or context menu.
4. In the dialog:
   - Review the page name in the title.
   - Optionally **search and select a destination site** (defaults to This site).
   - Optionally **search** folders by name.
   - Browse the destination site’s **Site Pages** folder tree (including the library root).
   - For **cross-site** moves, choose which **matching metadata columns** to copy (matched by internal name).
   - Confirm the **Destination site / folder** summary.
5. Click **Move**.
6. On success, the view **reloads**.

### Functional rules

| Area | Behavior |
| --- | --- |
| Scope | Source must be Site Pages (list URL ends with `/SitePages`) |
| Selection | Single selected page (first selected row) |
| Eligible items | Files ending in `.aspx`; folders are ignored |
| Excluded items | Pages under `/SitePages/Templates/` |
| Same-site destination | Any eligible folder under the current Site Pages library, including the root |
| Cross-site destination | Another site’s Site Pages library (must exist) |
| Same folder | Same site + same folder blocked with an inline status message |
| Same-site move | `moveByPath` (all metadata preserved; no metadata picker) |
| Cross-site move | Copy page → apply selected matching fields → recycle source |
| Metadata matching | Writable, non-hidden columns present on both libraries with the same InternalName and type |
| System folders | `Forms` and root-level `Templates` are not shown as destinations |
| Failure | Load/move errors surface in the dialog; user can cancel or retry |

### When the command appears

The **Move to folder** command is **hidden by default** and only becomes visible when all of the following are true:

| Condition | Rule |
| --- | --- |
| Library | Current list server-relative URL ends with `/SitePages` |
| Selection | At least one eligible page row is selected |
| Item type | Not a folder (`FSObjType` / `FileSystemObjectType` ≠ `1`) |
| File type | `FileLeafRef` ends with `.aspx` |
| Templates | Path must **not** contain `/SitePages/Templates/` |

If any check fails, the command stays hidden.

---

## Features / Benefits

| Feature | Benefit |
| --- | --- |
| **In-library Move to folder command** | Reorganize pages without switching tools or leaving SharePoint |
| **Site picker** | Move within This site or to another site’s Site Pages |
| **Searchable folder tree** | Find deep destinations quickly in large Site Pages hierarchies |
| **Selective metadata copy (cross-site)** | Choose which matching columns to bring across by InternalName |
| **Same-site moveByPath** | Fast in-library moves with full metadata preserved |
| **Site Pages root as a destination** | Move pages back to the library root in one step |
| **Prefetched folder cache** | Dialog opens faster after the first valid selection |
| **Same-folder guard** | Prevents no-op moves and confusing “success” with no change |
| **System folder filtering** | Hides `Forms` / `Templates` so authors only see real content folders |
| **Inline load & move errors** | Clear feedback without cryptic browser failures |
| **Fluent UI v9 dialog** | Familiar Microsoft 365 look and feel |
| **Tenant-friendly packaging** | `skipFeatureDeployment` supports App Catalog / tenant-wide rollout |
| **Focused eligibility rules** | Command only appears when a real Site Page can be moved |

**Who benefits**

- **Site owners / content managers** — keep page IA tidy as sites grow, including across sites.
- **Authors** — fix “wrong folder” or “wrong site” mistakes without IT or PowerShell.
- **Admins / developers** — drop-in SPFx extension with clear boundaries and PnPjs move/copy semantics.

---

## Technical

### Stack

| Layer | Technology |
| --- | --- |
| Platform | SharePoint Framework **1.23.0** (Heft web build rig) |
| Extension type | **List View Command Set** (`MovePageToFolderCommandSet`) |
| UI | React 17 + **Fluent UI React Components v9** + `@microsoft/sp-dialog` |
| SharePoint data | **PnPjs** `@pnp/sp` (folders, search, `moveByPath`, `copyByPath`) |
| Runtime | Node **22.x** for build; browser against SharePoint Online |
| Package | `.sppkg` via `heft package-solution` |

### Architecture

```text
List view selection change
        │
        ▼
┌───────────────────────────┐
│ Update command visibility │
│ Prefetch folder tree      │  (cached; one in-flight request)
└─────────────┬─────────────┘
              │ user clicks "Move to folder"
              ▼
┌───────────────────────────┐
│ Open MovePageToFolderDialog│
│ Pick site + folder        │
│ (cross-site: metadata)    │
└─────────────┬─────────────┘
              │ Move
              ▼
        ┌─────┴─────┐
        │           │
   same site   cross site
        │           │
   moveByPath  copyByPath
        │      + metadata
        │      + recycle source
        └─────┬─────┘
              │ success
              ▼
        Reload page
```

### Components

| Component | File | Role |
| --- | --- | --- |
| Command set | `src/extensions/movePageToFolder/MovePageToFolderCommandSet.ts` | Visibility, selection parsing, dialog orchestration, post-move reload |
| Dialog | `src/extensions/movePageToFolder/dialogs/MovePageToFolderDialog.tsx` | Site picker, folder tree, metadata checklist, move/cancel |
| Folder service | `src/extensions/movePageToFolder/services/SitePagesFolderService.ts` | Folder tree cache, same-site move, cross-site copy/metadata/delete, field matching |
| Site search | `src/extensions/movePageToFolder/services/SiteSearchService.ts` | Searchable destination sites + Site Pages library resolution |
| Types | `src/extensions/movePageToFolder/types.ts` | Folders, sites, metadata fields, move request |
| Strings | `src/extensions/movePageToFolder/loc/` | Localized UI labels |
| Manifest | `MovePageToFolderCommandSet.manifest.json` | Command id `MOVE_TO_FOLDER`, icon |

### Command set logic

- Subscribes to `listViewStateChangedEvent` and toggles command visibility.
- Builds `ISelectedPageInfo` from `FileLeafRef`, `FileRef`, optional `ID`, and folder object type fields.
- Prefetches the current site’s folder tree when a valid page is selected.
- Ensures only one dialog instance is active.
- On Move: same site → `movePageSameSite`; otherwise → `movePageCrossSite`.
- On successful move (`dialog.didMove`), calls `window.location.reload()`.

### Service logic

**Same-site**

`getFileByServerRelativePath(source).moveByPath(destinationFileUrl, true)`

**Cross-site**

1. Read selected source field values (by InternalName).
2. `copyByPath` into the destination Site Pages folder.
3. Update the destination item with selected matching fields.
4. Recycle the source file. If recycle fails after a successful copy, surface `CrossSiteDeleteFailedError`.

**Metadata matching**

- Intersect source and destination Site Pages fields by InternalName + type.
- Exclude hidden, read-only, system, canvas/body, and complex field types (user/lookup/taxonomy).
- Default: all eligible matching fields selected in the picker.

**Folder exclusions**

| Depth | Excluded names |
| --- | --- |
| Root (`Site Pages`) | `Forms`, `Templates` |
| Nested folders | `Forms` |

### Dialog logic

- Destination site Combobox (This site by default; SharePoint Search for other sites).
- Synthetic **Site Pages** root node for moves to the library root.
- Search filters by folder name and keeps ancestors of matches.
- Metadata checklist appears only for cross-site destinations.
- Blocks same-folder moves on the current site; disables dismiss while moving.
- Includes a Tabster compatibility patch for SPFx + Fluent UI v9 dialog hosting ([sp-dev-docs #10876](https://github.com/SharePoint/sp-dev-docs/issues/10876)).

### Solution layout

```text
src/extensions/movePageToFolder/
├── MovePageToFolderCommandSet.ts          # Command visibility + orchestration
├── MovePageToFolderCommandSet.manifest.json
├── types.ts                               # Folders, sites, metadata, move request
├── icons/move-to-folder.svg
├── loc/                                   # Localized strings
├── dialogs/MovePageToFolderDialog.tsx     # Site + folder + metadata UI
└── services/
    ├── SitePagesFolderService.ts          # Folders + move/copy/metadata
    └── SiteSearchService.ts               # Site search + Site Pages resolve
```

### Package identity

| | |
| --- | --- |
| Solution id | `40489416-24b2-459f-974a-4c09f186d144` |
| Component id | `9059cbd7-7e32-4692-9bfc-7898d89ffaf7` |
| Command id | `MOVE_TO_FOLDER` |
| Debug location | `ClientSideExtension.ListViewCommandSet.ContextMenu` (`config/serve.json`) |

---

## Prerequisites

- Node.js **22.x** (see `engines` in `package.json`)
- A Microsoft 365 developer / work tenant with SharePoint Online
- Permissions to deploy SPFx packages (App Catalog) and use Site Pages
- For cross-site moves: contribute access on the destination Site Pages library
- For local debugging: ability to load scripts from `https://localhost:4321`

---

## Minimal path to awesome

```bash
# Install dependencies
npm install

# Trust the SPFx local cert (first time only, globally)
npx gulp trust-dev-cert
# or, with Heft tooling as used by this project, follow your SPFx 1.23 local HTTPS setup

# Start local serve (debug against Site Pages)
npm start
```

Update `config/serve.json` `pageUrl` to your tenant’s Site Pages view if needed (default targets `.../SitePages/Forms/ByAuthor.aspx`).

### Build package

```bash
npm run build
```

This runs production tests/build and packages the `.sppkg` under `sharepoint/solution/` (see `config/package-solution.json`).

### Deploy

1. Upload the `.sppkg` to the tenant (or site) **App Catalog**.
2. Deploy / trust the package (`skipFeatureDeployment` is enabled — tenant-wide deployment friendly).
3. Add the app to the site (if not tenant-deployed), or ensure the List View Command Set is associated with Site Pages.
4. Open **Site Pages**, select a page, and use **Move to folder**.

Debug serve configuration registers the extension as a **context menu** command set. Adjust deployment elements if you also want command-bar placement.

---

## Notes & limitations

- **Single selection** — designed for one page at a time.
- **Source Site Pages only** — command does not appear in other libraries.
- **Templates excluded** — pages under `SitePages/Templates` cannot be moved with this command.
- **Same-folder move** — blocked in the UI on the current site; choose a different destination.
- **Cross-site metadata** — only matching writable simple columns are offered; user/lookup/taxonomy fields are excluded.
- **Overwrite** — move/copy APIs use overwrite `true`; colliding file names at the destination follow SharePoint overwrite behavior.
- **Reload after move** — a full page reload refreshes the list view after success.

---

## Version history

| Version | Date | Comments |
| --- | --- | --- |
| 1.0.0.0 | 2026 | Initial public release |
| 1.1.0.0 | 2026 | Cross-site move with site picker and selective metadata copy |

---

## Author

**Kachihro**  
Website: [https://www.kachihro.com](https://www.kachihro.com)

---

## Disclaimer

**THIS CODE IS PROVIDED _AS IS_ WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.**

---

## References

- [SharePoint Framework overview](https://docs.microsoft.com/sharepoint/dev/spfx/sharepoint-framework-overview)
- [List View Command Set extensions](https://docs.microsoft.com/sharepoint/dev/spfx/extensions/get-started/building-simple-cmdset-with-dialog-api)
- [PnPjs](https://pnp.github.io/pnpjs/)
- [Fluent UI React v9](https://react.fluentui.dev/)
- [Microsoft 365 Patterns and Practices](https://aka.ms/m365pnp)
- [Heft documentation](https://heft.rushstack.io/)
