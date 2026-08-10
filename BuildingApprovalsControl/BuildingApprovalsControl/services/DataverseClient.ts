import { BuildingApprovalRecord } from "../types/BuildingApproval";

/**
 * Transport-agnostic CRUD interface for Building Approval records. Two implementations exist
 * (WebApiClient, PortalRestClient) — see docs/open-questions.md item 1 for why: it is not yet confirmed
 * whether context.webAPI works correctly for a PCF hosted inside Power Pages (vs. model-driven apps,
 * where it's guaranteed). Run the verification spike described in the plan before committing to one.
 */
export interface DataverseClient {
  retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]>;
  retrieve(id: string): Promise<BuildingApprovalRecord>;
  create(data: Partial<BuildingApprovalRecord>): Promise<string>;
  update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}
