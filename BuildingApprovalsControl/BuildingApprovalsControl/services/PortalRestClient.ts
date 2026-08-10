import { DataverseClient } from "./DataverseClient";
import {
  ApplicationStatus,
  BUILDING_APPROVAL_ENTITY_SET,
  BuildingApprovalEntity,
  BuildingApprovalRecord,
} from "../types/BuildingApproval";

interface ODataListResponse {
  value: BuildingApprovalEntity[];
}

declare global {
  interface Window {
    // Power Pages injects a "shell" object exposing token retrieval on most portal releases.
    // TODO: confirm this against the live site — Microsoft has changed the mechanism across
    // portal releases (see docs/open-questions.md item 2). If `shell` isn't present, look for a
    // `__RequestVerificationToken` value embedded in a hidden form field or meta tag instead.
    shell?: { getTokenDeferred?: () => Promise<string> };
  }
}

/**
 * Fallback implementation for when context.webAPI is unavailable/unreliable inside a Power
 * Pages-hosted PCF (see docs/open-questions.md item 1). Calls the portal's own Web API surface
 * (`/_api/<entitysetname>`), which is distinct from the raw Dataverse Web API and is scoped by the
 * signed-in contact's Table Permissions automatically.
 */
export class PortalRestClient implements DataverseClient {
  constructor(private readonly siteBaseUrl: string) {}

  public async retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]> {
    // TODO: replace _cr137_contact_value with the real lookup column once confirmed.
    const query = `?$filter=_cr137_contact_value eq ${contactId}&$orderby=createdon desc`;
    const res = await this.request("GET", `${BUILDING_APPROVAL_ENTITY_SET}${query}`);
    const json = (await res.json()) as ODataListResponse;
    return (json.value ?? []).map(mapToRecord);
  }

  public async retrieve(id: string): Promise<BuildingApprovalRecord> {
    const res = await this.request("GET", `${BUILDING_APPROVAL_ENTITY_SET}(${id})`);
    const json = (await res.json()) as BuildingApprovalEntity;
    return mapToRecord(json);
  }

  public async create(data: Partial<BuildingApprovalRecord>): Promise<string> {
    const res = await this.request("POST", BUILDING_APPROVAL_ENTITY_SET, mapFromRecord(data));
    const location = res.headers.get("OData-EntityId") ?? "";
    const match = /\(([0-9a-fA-F-]+)\)/.exec(location);
    if (!match) {
      throw new Error("Portal REST create did not return an OData-EntityId header with a record id.");
    }
    return match[1];
  }

  public async update(id: string, data: Partial<BuildingApprovalRecord>): Promise<void> {
    await this.request("PATCH", `${BUILDING_APPROVAL_ENTITY_SET}(${id})`, mapFromRecord(data));
  }

  public async deleteRecord(id: string): Promise<void> {
    await this.request("DELETE", `${BUILDING_APPROVAL_ENTITY_SET}(${id})`);
  }

  private async getToken(): Promise<string | undefined> {
    return window.shell?.getTokenDeferred?.();
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (token) headers.__RequestVerificationToken = token;

    const res = await fetch(`${this.siteBaseUrl.replace(/\/$/, "")}/_api/${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Portal REST ${method} ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res;
  }
}

function mapToRecord(entity: BuildingApprovalEntity): BuildingApprovalRecord {
  return {
    id: entity.cr137_buildingapprovalid ?? "",
    baNumber: entity.cr137_banumber,
    status: entity.cr137_applicationstatus ?? ApplicationStatus.Draft,
    requestDate: entity.createdon,
    applicant: {
      name: entity.cr137_applicantname,
      postalAddress: entity.cr137_applicantpostaladdress,
      contactPerson: entity.cr137_applicantcontactperson,
      email: entity.cr137_applicantemail,
      telephone: entity.cr137_applicanttelephone,
    },
    lessee: {
      name: entity.cr137_lesseename,
      postalAddress: entity.cr137_lesseepostaladdress,
      contactPerson: entity.cr137_lesseecontactperson,
      email: entity.cr137_lesseeemail,
      telephone: entity.cr137_lesseetelephone,
    },
    locationOfWorks: entity.cr137_locationofworks,
    buildingContractor: {
      name: entity.cr137_buildingcontractorname,
    },
    estimatedValueOfBuildingActivity: entity.cr137_estimatedvalue,
    feeAmountType: entity.cr137_feeamounttype,
    checklist: [],
    attachedDocuments: entity.cr137_attacheddocuments,
    confirmed: entity.cr137_confirmed,
  };
}

function mapFromRecord(data: Partial<BuildingApprovalRecord>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.status !== undefined) payload.cr137_applicationstatus = data.status;
  if (data.applicant) {
    if (data.applicant.name !== undefined) payload.cr137_applicantname = data.applicant.name;
    if (data.applicant.postalAddress !== undefined) payload.cr137_applicantpostaladdress = data.applicant.postalAddress;
    if (data.applicant.contactPerson !== undefined) payload.cr137_applicantcontactperson = data.applicant.contactPerson;
    if (data.applicant.email !== undefined) payload.cr137_applicantemail = data.applicant.email;
    if (data.applicant.telephone !== undefined) payload.cr137_applicanttelephone = data.applicant.telephone;
  }
  if (data.lessee) {
    if (data.lessee.name !== undefined) payload.cr137_lesseename = data.lessee.name;
    if (data.lessee.postalAddress !== undefined) payload.cr137_lesseepostaladdress = data.lessee.postalAddress;
    if (data.lessee.contactPerson !== undefined) payload.cr137_lesseecontactperson = data.lessee.contactPerson;
    if (data.lessee.email !== undefined) payload.cr137_lesseeemail = data.lessee.email;
    if (data.lessee.telephone !== undefined) payload.cr137_lesseetelephone = data.lessee.telephone;
  }
  if (data.locationOfWorks !== undefined) payload.cr137_locationofworks = data.locationOfWorks;
  if (data.buildingContractor?.name !== undefined) payload.cr137_buildingcontractorname = data.buildingContractor.name;
  if (data.estimatedValueOfBuildingActivity !== undefined) payload.cr137_estimatedvalue = data.estimatedValueOfBuildingActivity;
  if (data.feeAmountType !== undefined) payload.cr137_feeamounttype = data.feeAmountType;
  if (data.attachedDocuments !== undefined) payload.cr137_attacheddocuments = data.attachedDocuments;
  if (data.confirmed !== undefined) payload.cr137_confirmed = data.confirmed;
  return payload;
}
