import { DataverseClient } from "./DataverseClient";
import {
  BUILDING_APPROVAL_ENTITY_LOGICAL_NAME,
  BUILDING_APPROVAL_ENTITY_SET,
  BUILDING_APPROVAL_GRID_SELECT,
  BUILDING_APPROVAL_ID_FIELD,
  BUILDING_APPROVAL_WEBAPI_SELECT,
  BuildingApprovalEntity,
  BuildingApprovalRecord,
} from "../types/BuildingApproval";
import { getErrorMessage } from "./errors";
import { entityPrimaryKey, mapFromRecord, mapToRecord, normalizeGuid, portalUserLookupPayloads } from "./mapping";

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
      const options = `?$select=${BUILDING_APPROVAL_GRID_SELECT}&$orderby=cr137_applicationdate desc`;
      const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, options);
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
      const binds = portalUserLookupPayloads(portalUserId);

      // Prefer Power Pages `_…_value` form — the polyfill strips `@odata.bind` keys silently.
      const result = await this.webAPI.createRecord(BUILDING_APPROVAL_ENTITY_SET, {
        ...mapFromRecord(data),
        ...binds.powerPages,
      });
      const id = normalizeGuid(result.id);

      if (!(await this.hasPortalUser(id, portalUserId))) {
        await this.trySetPortalUser(id, binds);
      }

      if (!(await this.hasPortalUser(id, portalUserId))) {
        throw new Error(
          "Created the application but Portal User (cr137_portaluser) did not stick. " +
            "Check Table Permissions: Write on Building Activity Application including cr137_portaluser, " +
            "and Append/Append To between it and Contact."
        );
      }

      return id;
    });
  }

  public async update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void> {
    return this.wrap("update", async () => {
      const payload = mapFromRecord(data);
      if (data.portalUserId) {
        const binds = portalUserLookupPayloads(data.portalUserId);
        Object.assign(payload, binds.powerPages);
        await this.webAPI.updateRecord(BUILDING_APPROVAL_ENTITY_SET, normalizeGuid(id), payload);
        // If the preferred shape didn't stick, retry alternates (lookup-only — don't rewrite other fields).
        if (!(await this.hasPortalUser(id, data.portalUserId))) {
          await this.trySetPortalUser(id, binds);
        }
        return;
      }
      await this.webAPI.updateRecord(BUILDING_APPROVAL_ENTITY_SET, normalizeGuid(id), payload);
    });
  }

  /** Confirm _cr137_portaluser_value matches the contact we tried to bind. */
  private async hasPortalUser(recordId: string, portalUserId: string): Promise<boolean> {
    const want = normalizeGuid(portalUserId).toLowerCase();
    const select = `?$select=${BUILDING_APPROVAL_ID_FIELD},_cr137_portaluser_value`;
    try {
      const filtered = await this.webAPI.retrieveMultipleRecords(
        BUILDING_APPROVAL_ENTITY_SET,
        `${select}&$filter=${BUILDING_APPROVAL_ID_FIELD} eq ${normalizeGuid(recordId)}`
      );
      const row = filtered.entities?.[0] as BuildingApprovalEntity | undefined;
      const got = normalizeGuid(row?._cr137_portaluser_value ?? "").toLowerCase();
      if (got && got === want) return true;
    } catch {
      /* fall through to unfiltered scan */
    }

    try {
      const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, select);
      const row = result.entities.find(
        (e) => entityPrimaryKey(e as unknown as BuildingApprovalEntity).toLowerCase() === normalizeGuid(recordId).toLowerCase()
      ) as BuildingApprovalEntity | undefined;
      const got = normalizeGuid(row?._cr137_portaluser_value ?? "").toLowerCase();
      return !!got && got === want;
    } catch {
      return false;
    }
  }

  private async trySetPortalUser(
    recordId: string,
    binds: ReturnType<typeof portalUserLookupPayloads>
  ): Promise<void> {
    const id = normalizeGuid(recordId);
    for (const payload of [binds.powerPages, binds.powerPagesBare, binds.odata]) {
      try {
        await this.webAPI.updateRecord(BUILDING_APPROVAL_ENTITY_SET, id, payload);
      } catch {
        /* try next shape */
      }
    }
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
