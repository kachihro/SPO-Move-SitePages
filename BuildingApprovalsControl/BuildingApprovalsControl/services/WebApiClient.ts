import { DataverseClient } from "./DataverseClient";
import {
  BUILDING_APPROVAL_ENTITY_LOGICAL_NAME,
  BUILDING_APPROVAL_ENTITY_SET,
  BUILDING_APPROVAL_GRID_SELECT,
  BUILDING_APPROVAL_GRID_SELECT_BASE,
  BUILDING_APPROVAL_ID_FIELD,
  BUILDING_APPROVAL_WEBAPI_SELECT,
  BuildingApprovalEntity,
  BuildingApprovalRecord,
} from "../types/BuildingApproval";
import { getErrorMessage } from "./errors";
import { entityPrimaryKey, mapFromRecord, mapToRecord, normalizeGuid, portalUserLookupPayloads } from "./mapping";
import { portalApiBindLookup, portalApiPatch } from "./portalApi";

/**
 * Implementation using context.webAPI (the same interface a model-driven-app PCF gets).
 * Confirmed working against a Power Pages-hosted PCF under real CIAM portal-contact auth (not just
 * admin/maker preview) — see docs/open-questions.md item 1.
 *
 * Power Pages' webAPI polyfill can reject with `undefined` (e.g. HTML 404 when Table Permissions
 * are missing). Every call is wrapped so callers always get a real Error.
 *
 * List/create/update use the entity *set* name (what Power Pages `/_api/` URLs expect). Single-record
 * retrieve prefers the logical name (PCF contract), then falls back to the working retrieveMultiple
 * path — retrieveRecord alone was leaving the wizard empty after Save Draft → Open.
 */
export class WebApiClient implements DataverseClient {
  constructor(private readonly webAPI: ComponentFramework.WebApi) {}

  public async retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]> {
    return this.wrap("retrieveMultiple", async () => {
      if (!contactId) {
        throw new Error(
          'Signed-in contact id is missing. Add <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" /> on the Submissions page.'
        );
      }
      // Grid-only $select (not the full form). Avoid lookup-value $filter; scope client-side.
      const query = (select: string) => `?$select=${select}&$orderby=cr137_applicationdate desc`;
      let result: ComponentFramework.WebApi.RetrieveMultipleResponse;
      try {
        result = await this.webAPI.retrieveMultipleRecords(
          BUILDING_APPROVAL_ENTITY_SET,
          query(BUILDING_APPROVAL_GRID_SELECT)
        );
      } catch (err: unknown) {
        // `createdon` may not be in the Webapi/…/fields site setting yet (90040101). The grid still
        // works without it — but Request Date then loses the time of day and falls back to the
        // Date Only column, which is the usual reason the grid shows a bare date.
        console.warn(
          `[AAL] createdon $select rejected — Request Date will show no time. Add 'createdon' to site setting Webapi/${BUILDING_APPROVAL_ENTITY_LOGICAL_NAME}/fields. ${getErrorMessage(err)}`
        );
        result = await this.webAPI.retrieveMultipleRecords(
          BUILDING_APPROVAL_ENTITY_SET,
          query(BUILDING_APPROVAL_GRID_SELECT_BASE)
        );
      }
      const records = result.entities.map((e) => mapToRecord(e as unknown as BuildingApprovalEntity));
      const normalized = normalizeGuid(contactId).toLowerCase();
      return records.filter((r) => normalizeGuid(r.portalUserId ?? "").toLowerCase() === normalized);
    });
  }

  public async retrieve(id: string): Promise<BuildingApprovalRecord> {
    return this.wrap("retrieve", async () => {
      const normalizedId = normalizeGuid(id);
      if (!normalizedId) {
        throw new Error("Missing application id — cannot load this draft.");
      }

      const select = `?$select=${BUILDING_APPROVAL_WEBAPI_SELECT}`;
      const idLower = normalizedId.toLowerCase();

      // Power Pages can resolve retrieveRecord with {} / no PK — that maps to a blank wizard.
      // Only accept a payload when the primary key matches the requested id.
      const acceptRetrieve = (raw: ComponentFramework.WebApi.Entity | undefined): BuildingApprovalRecord | undefined => {
        if (!raw || typeof raw !== "object") return undefined;
        const entity = raw as unknown as BuildingApprovalEntity;
        const pk = entityPrimaryKey(entity).toLowerCase();
        if (!pk || pk !== idLower) return undefined;
        return mapToRecord(entity);
      };

      // 1) PCF contract: logical name + retrieveRecord
      try {
        const mapped = acceptRetrieve(
          await this.webAPI.retrieveRecord(BUILDING_APPROVAL_ENTITY_LOGICAL_NAME, normalizedId, select)
        );
        if (mapped) return mapped;
      } catch {
        // Power Pages polyfill is inconsistent — try the list path next.
      }

      // 2) Entity-set retrieveRecord (matches create/list naming used elsewhere)
      try {
        const mapped = acceptRetrieve(
          await this.webAPI.retrieveRecord(BUILDING_APPROVAL_ENTITY_SET, normalizedId, select)
        );
        if (mapped) return mapped;
      } catch {
        // continue
      }

      // 3) Same path as the working grid: retrieveMultiple, then match by id.
      // Prefer a PK $filter; if Power Pages rejects it, fall back to an unfiltered list scan.
      const pick = (entities: ComponentFramework.WebApi.Entity[]): BuildingApprovalEntity | undefined => {
        const match = entities.find((e) => {
          const row = e as unknown as BuildingApprovalEntity;
          return entityPrimaryKey(row).toLowerCase() === idLower;
        });
        return match as unknown as BuildingApprovalEntity | undefined;
      };

      try {
        const filtered = await this.webAPI.retrieveMultipleRecords(
          BUILDING_APPROVAL_ENTITY_SET,
          `${select}&$filter=${BUILDING_APPROVAL_ID_FIELD} eq ${normalizedId}`
        );
        const entity = pick(filtered.entities);
        if (entity) return mapToRecord(entity);
      } catch {
        // continue to unfiltered scan
      }

      const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, select);
      const entity = pick(result.entities);
      if (!entity) {
        throw new Error(`Application ${normalizedId} was not found or is not readable.`);
      }
      return mapToRecord(entity);
    });
  }

  public async create(data: Partial<BuildingApprovalRecord>): Promise<string> {
    return this.wrap("create", async () => {
      if (!data.portalUserId) {
        throw new Error(
          'Cannot create Building Activity Application without Portal User (contact). Add <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" /> on the Submissions page.'
        );
      }
      const portalUserId = normalizeGuid(data.portalUserId);

      // Scalars via webAPI; lookup via /_api/ (see ensurePortalUser).
      const result = await this.webAPI.createRecord(BUILDING_APPROVAL_ENTITY_SET, mapFromRecord(data));
      const id = normalizeGuid(result.id);
      if (!id) {
        throw new Error("Dataverse create returned no record id.");
      }

      await this.ensurePortalUser(id, portalUserId);
      return id;
    });
  }

  public async update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void> {
    return this.wrap("update", async () => {
      const payload = mapFromRecord(data);
      // Never put `_cr137_portaluser_value` or @odata.bind on webAPI.updateRecord —
      // direct ER write → 0x80060888; @odata.bind is stripped by the Power Pages polyfill.
      await this.webAPI.updateRecord(BUILDING_APPROVAL_ENTITY_SET, normalizeGuid(id), payload);
      if (data.portalUserId) {
        await this.ensurePortalUser(id, data.portalUserId);
      }
    });
  }

  /**
   * Confirm _cr137_portaluser_value on *this* record matches the contact.
   * Always matches by primary key — never trust entities[0] from a $filter alone (Power Pages
   * can ignore/mis-apply $filter, which previously false-positived and skipped the bind).
   */
  private async hasPortalUser(recordId: string, portalUserId: string): Promise<boolean> {
    const want = normalizeGuid(portalUserId).toLowerCase();
    const id = normalizeGuid(recordId).toLowerCase();
    const select = `?$select=${BUILDING_APPROVAL_ID_FIELD},_cr137_portaluser_value`;

    const portalUserOn = (row: BuildingApprovalEntity | undefined): boolean => {
      if (!row) return false;
      if (entityPrimaryKey(row).toLowerCase() !== id) return false;
      const got = normalizeGuid(row._cr137_portaluser_value ?? "").toLowerCase();
      return !!got && got === want;
    };

    try {
      const filtered = await this.webAPI.retrieveMultipleRecords(
        BUILDING_APPROVAL_ENTITY_SET,
        `${select}&$filter=${BUILDING_APPROVAL_ID_FIELD} eq '${normalizeGuid(recordId)}'`
      );
      for (const e of filtered.entities ?? []) {
        if (portalUserOn(e as unknown as BuildingApprovalEntity)) return true;
      }
    } catch {
      /* fall through */
    }

    try {
      const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, select);
      for (const e of result.entities ?? []) {
        if (portalUserOn(e as unknown as BuildingApprovalEntity)) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  /** Bind Portal User and fail the save if it does not stick on this record. */
  private async ensurePortalUser(recordId: string, portalUserId: string): Promise<void> {
    const id = normalizeGuid(recordId);
    const contactId = normalizeGuid(portalUserId);
    if (await this.hasPortalUser(id, contactId)) return;

    const errors: string[] = [];
    const navProps = ["cr137_PortalUser", "cr137_portaluser"];

    for (const nav of navProps) {
      try {
        await portalApiBindLookup(BUILDING_APPROVAL_ENTITY_SET, id, nav, "contacts", contactId);
        if (await this.hasPortalUser(id, contactId)) return;
        errors.push(`/${nav}/$ref returned OK but lookup still blank`);
      } catch (err: unknown) {
        errors.push(`/${nav}/$ref: ${getErrorMessage(err)}`);
      }
    }

    for (const nav of navProps) {
      try {
        await portalApiPatch(`${BUILDING_APPROVAL_ENTITY_SET}(${id})`, {
          [`${nav}@odata.bind`]: `/contacts(${contactId})`,
        });
        if (await this.hasPortalUser(id, contactId)) return;
        errors.push(`PATCH ${nav}@odata.bind returned OK but lookup still blank`);
      } catch (err: unknown) {
        errors.push(`PATCH ${nav}@odata.bind: ${getErrorMessage(err)}`);
      }
    }

    // Keep mapping helper in sync for PortalRestClient; attempt its shape last.
    try {
      await portalApiPatch(`${BUILDING_APPROVAL_ENTITY_SET}(${id})`, portalUserLookupPayloads(contactId).odata);
      if (await this.hasPortalUser(id, contactId)) return;
    } catch (err: unknown) {
      errors.push(getErrorMessage(err));
    }

    throw new Error(
      "Portal User (cr137_portaluser) did not stick on this application. " +
        "Check Table Permissions: Write + Append on Building Activity Application for cr137_portaluser, " +
        "Append To on Contact, and that Contact is Web API enabled. Attempts: " +
        errors.join(" | ")
    );
  }

  public async deleteRecord(id: string): Promise<void> {
    return this.wrap("delete", async () => {
      await this.webAPI.deleteRecord(BUILDING_APPROVAL_ENTITY_SET, normalizeGuid(id));
    });
  }

  private async wrap<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      const detail = getErrorMessage(err);
      throw new Error(`Dataverse ${operation} on ${BUILDING_APPROVAL_ENTITY_SET} failed: ${detail}`);
    }
  }
}
