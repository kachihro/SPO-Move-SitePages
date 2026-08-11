import { DataverseClient } from "./DataverseClient";
import { BUILDING_APPROVAL_ENTITY_SET, BuildingApprovalEntity, BuildingApprovalRecord } from "../types/BuildingApproval";
import { getErrorMessage } from "./errors";
import { mapFromRecord, mapToRecord } from "./mapping";

/**
 * Implementation using context.webAPI (the same interface a model-driven-app PCF gets).
 * Confirmed working against a Power Pages-hosted PCF under real CIAM portal-contact auth (not just
 * admin/maker preview) — see docs/open-questions.md item 1.
 *
 * Power Pages' webAPI polyfill can reject with `undefined` (e.g. HTML 404 when Table Permissions
 * are missing). Every call is wrapped so callers always get a real Error.
 */
export class WebApiClient implements DataverseClient {
  constructor(private readonly webAPI: ComponentFramework.WebApi) {}

  public async retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]> {
    return this.wrap("retrieveMultiple", async () => {
      if (!contactId) {
        throw new Error(
          'Signed-in contact id is missing (filter would be "_cr137_portaluser_value eq "). Add <input type="hidden" id="aal-portal-contact-id" value="{{ user.id }}" /> on the Submissions page.'
        );
      }
      const options = `?$filter=_cr137_portaluser_value eq ${contactId}&$orderby=cr137_applicationdate desc`;
      const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, options);
      return result.entities.map((e) => mapToRecord(e as unknown as BuildingApprovalEntity));
    });
  }

  public async retrieve(id: string): Promise<BuildingApprovalRecord> {
    return this.wrap("retrieve", async () => {
      const entity = await this.webAPI.retrieveRecord(BUILDING_APPROVAL_ENTITY_SET, id);
      return mapToRecord(entity as unknown as BuildingApprovalEntity);
    });
  }

  public async create(data: Partial<BuildingApprovalRecord>): Promise<string> {
    return this.wrap("create", async () => {
      const result = await this.webAPI.createRecord(BUILDING_APPROVAL_ENTITY_SET, mapFromRecord(data));
      return result.id;
    });
  }

  public async update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void> {
    return this.wrap("update", async () => {
      await this.webAPI.updateRecord(BUILDING_APPROVAL_ENTITY_SET, id, mapFromRecord(data));
    });
  }

  public async deleteRecord(id: string): Promise<void> {
    return this.wrap("delete", async () => {
      await this.webAPI.deleteRecord(BUILDING_APPROVAL_ENTITY_SET, id);
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
