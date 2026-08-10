import { DataverseClient } from "./DataverseClient";
import { BUILDING_APPROVAL_ENTITY_SET, BuildingApprovalEntity, BuildingApprovalRecord } from "../types/BuildingApproval";
import { mapFromRecord, mapToRecord } from "./mapping";

/**
 * Implementation using context.webAPI (the same interface a model-driven-app PCF gets).
 * Confirmed working against a Power Pages-hosted PCF under real CIAM portal-contact auth (not just
 * admin/maker preview) — see docs/open-questions.md item 1.
 */
export class WebApiClient implements DataverseClient {
  constructor(private readonly webAPI: ComponentFramework.WebApi) {}

  public async retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]> {
    const options = `?$filter=_cr137_portaluser_value eq ${contactId}&$orderby=cr137_applicationdate desc`;
    const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, options);
    return result.entities.map((e) => mapToRecord(e as unknown as BuildingApprovalEntity));
  }

  public async retrieve(id: string): Promise<BuildingApprovalRecord> {
    const entity = await this.webAPI.retrieveRecord(BUILDING_APPROVAL_ENTITY_SET, id);
    return mapToRecord(entity as unknown as BuildingApprovalEntity);
  }

  public async create(data: Partial<BuildingApprovalRecord>): Promise<string> {
    const result = await this.webAPI.createRecord(BUILDING_APPROVAL_ENTITY_SET, mapFromRecord(data));
    return result.id;
  }

  public async update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void> {
    await this.webAPI.updateRecord(BUILDING_APPROVAL_ENTITY_SET, id, mapFromRecord(data));
  }

  public async deleteRecord(id: string): Promise<void> {
    await this.webAPI.deleteRecord(BUILDING_APPROVAL_ENTITY_SET, id);
  }
}
