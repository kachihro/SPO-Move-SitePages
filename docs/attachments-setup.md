# Supporting documents — Dataverse + Power Pages + SharePoint setup

Step 3 of the wizard uploads supporting documents as Dataverse **Notes (`annotation`)** regarding
the Building Activity Application record. The control code is done; the items below are maker/admin
configuration and **must be in place before the feature works on a live portal**.

Code entry points: `services/PortalAnnotationClient.ts`, `services/fileEncoding.ts`,
`components/wizard/steps/AttachmentsGrid.tsx`, `types/Attachment.ts`.

## 0. Pre-flight — Notes must be enabled on the table

If "Notes (includes attachments)" was not ticked when `cr137_buildingactivityapplication` was
created, the `cr137_buildingactivityapplication_Annotations` relationship does not exist and none
of this works. Check:

```
GET https://orga3a7d35b.crm6.dynamics.com/api/data/v9.2/EntityDefinitions(LogicalName='cr137_buildingactivityapplication')?$select=HasNotes
```

Maker portal → Table → Properties → Advanced → Enable attachments. It can only be turned **on**,
never off, so ticking it is safe but irreversible.

## 1. Site Settings (Power Pages Management → Site Settings)

| Name | Value |
|---|---|
| `Webapi/annotation/enabled` | `true` |
| `Webapi/annotation/fields` | `annotationid,subject,notetext,filename,mimetype,documentbody,filesize,isdocument,objectid,createdon` |
| `Webapi/error/innererror` | `true` — temporarily, while testing |

`objectid` **must** be in the field list or the `@odata.bind` on create is rejected. Use the explicit
list rather than `*`, matching the project's existing `$select` convention and avoiding wider
`documentbody` exposure.

## 2. Table Permissions

On the same web role that already carries the existing Building Activity Application permission:

1. **New permission** — table `annotation`, **Access type = Parent**, relationship
   `cr137_buildingactivityapplication_Annotations` (confirm the exact schema name in the maker
   portal), parent = the existing contact-scoped application permission.
   Privileges: **Read, Create, Write, Delete, Append**.
2. **Edit the existing application permission** — add **Append To**.

Direction rule: `Append` goes on the record being attached (the note); `Append To` goes on the
record it is attached to (the application). They are different privileges and both are required.
`Append To` on Contact is already present for the `cr137_portaluser` bind.

**This Parent-scoped permission is the only thing preventing any authenticated portal contact from
reading any note body in the org**, because `documentbody` is in the Web API field allowlist. Run
the cross-contact test in §5 before going live.

## 3. Size limits

`Organization.MaxUploadFileSize` (Settings → Email → Attachments) defaults to 5 MB, which is what
`MAX_ATTACHMENT_BYTES` in `types/Attachment.ts` is set to — no environment change needed. If it is
ever raised, raise the constant to match, but note the ceilings compound:

- the org setting applies to decoded bytes;
- base64 inflates the payload ~33% on the wire;
- a single web-service call is capped at 16 MB;
- the browser holds the File, the base64 string and the JSON body at once (~3× file size).

~11 MB per file is the practical hard ceiling regardless of the org setting.

## 4. Power Automate — "Mirror submitted application documents to SharePoint"

Target: `https://demoplanb.sharepoint.com/sites/AALBuildingApprovals`, library
"Building Activity Application".

**Trigger** — Dataverse *When a row is added, modified or deleted*:
- Change type **Modified**
- Table **Building Activity Applications**, Scope **Organization**
- **Select columns = `cr137_applicationstatus`** — this is what stops any write-back re-firing the flow
- **Filter rows = `cr137_applicationstatus eq 466860001`** (Submitted)

**Actions:**
1. Compose the folder name from `cr137_buildingactivitynumber` (e.g. `BA-2026-A1B2C3`), falling back
   to the application GUID when the BA number is empty.
2. SharePoint **Create new folder**. It errors when the folder already exists — set *Configure run
   after* on the next action to `is successful` **or** `has failed` so a re-submit isn't fatal.
3. Dataverse **List rows** on **Notes**:
   `$filter=_objectid_value eq <trigger record id> and isdocument eq true`,
   `$select=annotationid,filename,mimetype,documentbody`.
4. **Apply to each** with concurrency **off** (avoids SharePoint throttling and folder races) →
   SharePoint **Create file**, File Name = `filename`, File Content =
   `base64ToBinary(items('Apply_to_each')?['documentbody'])`.
5. **Update file properties** — stamp `AnnotationId` and `ApplicationId` onto the SharePoint item.
   Worth doing now even though deletes aren't synced: it's the mapping any future live-sync flow
   needs, and it's free here.

**Idempotency:** re-submits re-run the flow, but `Create file` overwrites same-named files, so it
converges rather than duplicating. `sanitizeFileName()` in the control guarantees stable names, so
the flow never has to rename anything.

**Deletes are deliberately not synced.** Pre-submit deletes never reached SharePoint, and the grid
is read-only once submitted, so no portal delete can orphan a mirrored file. (A Dataverse *Deleted*
trigger only yields the primary key — `_objectid_value` is not reliably populated — so the target
folder couldn't be determined from the trigger anyway. If live sync is ever added, drive deletes off
the `AnnotationId` column stamped in step 5.)

**Never write back to `annotation` from a note-triggered flow** — it loops forever. If a "documents
synced" indicator is wanted, add a datetime column on the *application* and patch it from this flow
only; that is safe precisely because this trigger's Select columns is scoped to
`cr137_applicationstatus`.

## 5. Live test script

1. New application → Next → Next → Step 3, Upload enabled.
2. On a fresh application, click "Step 3" directly from Step 1 → the wizard now saves first
   (`handleStepSelect` in `ApprovalWizard.tsx`); if the save fails you should see the
   "Save this application before attaching documents" warning rather than a broken grid.
3. Upload a small PDF → `POST /_api/annotations` → **204** with an `OData-EntityId` response header.
4. **Refresh, re-open the draft, return to Step 3 → the row is still listed.** This is the test that
   proves both the `_objectid_value` filter and the Parent table permission. Most likely to fail.
5. Select 3 files at once → three sequential POSTs, one spinner each.
6. 6 MB file → rejected client-side with **zero** network requests. `.exe` → rejected. Duplicate
   name → rejected.
7. Delete → inline "Delete? Yes/No" → `DELETE /_api/annotations(<id>)` → 204 → row disappears.
8. Submit → reopen in **view** mode → no Upload, no Delete, filename still downloads. **Open the
   downloaded file** — a corrupt PDF means the base64 round trip is broken.
9. **Security test (mandatory)** — sign in as a different portal contact and run in the console:
   ```js
   fetch("/_api/annotations?$select=annotationid,filename&$filter=_objectid_value eq <other user's app guid>")
     .then(r => r.json()).then(console.log)
   ```
   Must return `{value: []}`. Anything else means the Parent-scoped permission is misconfigured.
10. Advanced Find on Notes regarding the application: `filesize`, `mimetype`, `isdocument=true`,
    `notetext = *WEB*` all populated.
11. Flow: submit → the SharePoint folder appears with the right files; re-submit → no duplicates.

## Known gaps / deliberate deferrals

- **No upload progress bar.** `fetch` has no upload progress event; a real one needs
  `portalApiRequest` rewritten on `XMLHttpRequest`.
- **Cascade delete.** Annotation relationships are parental, so deleting an application deletes its
  notes — mirrored SharePoint files remain. Treating SharePoint as the archive of record.
- **`cr137_supportingdocuments`** (String, 100) is no longer bound to any UI field. The column and
  any existing data are untouched; the attachment grid is now the source of truth.
