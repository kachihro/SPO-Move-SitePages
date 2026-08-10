import { DataverseClient } from "./DataverseClient";
import {
  ApplicationStatus,
  BUILDING_APPROVAL_ENTITY_SET,
  BuildingApprovalEntity,
  BuildingApprovalRecord,
} from "../types/BuildingApproval";

/**
 * Implementation using context.webAPI (the same interface a model-driven-app PCF gets).
 * See docs/open-questions.md item 1 — confirm this actually works against a Power Pages-hosted PCF
 * before relying on it; fall back to PortalRestClient if it doesn't.
 *
 * Field mapping below uses placeholder Dataverse column names — replace once the real schema is
 * confirmed (docs/open-questions.md item 4). Keeping the mapping isolated here means SubmissionsGrid /
 * ApprovalWizard never need to know real column names, only the BuildingApprovalRecord shape.
 */
export class WebApiClient implements DataverseClient {
  constructor(private readonly webAPI: ComponentFramework.WebApi) {}

  public async retrieveMultiple(contactId: string): Promise<BuildingApprovalRecord[]> {
    // TODO: replace _cr137_contact_value with the real lookup column once confirmed — this filter is
    // also the fix for the "list shows everyone's applications" bug (must be scoped per-contact).
    const options = `?$filter=_cr137_contact_value eq ${contactId}&$orderby=createdon desc`;
    const result = await this.webAPI.retrieveMultipleRecords(BUILDING_APPROVAL_ENTITY_SET, options);
    return result.entities.map(mapToRecord);
  }

  public async retrieve(id: string): Promise<BuildingApprovalRecord> {
    const entity = await this.webAPI.retrieveRecord(BUILDING_APPROVAL_ENTITY_SET, id);
    return mapToRecord(entity);
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

function mapToRecord(entity: ComponentFramework.WebApi.Entity): BuildingApprovalRecord {
  const e = entity as unknown as BuildingApprovalEntity;
  return {
    id: e.cr137_buildingapprovalid ?? "",
    baNumber: e.cr137_banumber,
    status: e.cr137_applicationstatus ?? ApplicationStatus.Draft,
    requestDate: e.createdon,
    applicant: {
      name: e.cr137_applicantname,
      postalAddress: e.cr137_applicantpostaladdress,
      contactPerson: e.cr137_applicantcontactperson,
      email: e.cr137_applicantemail,
      telephone: e.cr137_applicanttelephone,
    },
    lessee: {
      name: e.cr137_lesseename,
      postalAddress: e.cr137_lesseepostaladdress,
      contactPerson: e.cr137_lesseecontactperson,
      email: e.cr137_lesseeemail,
      telephone: e.cr137_lesseetelephone,
    },
    locationOfWorks: e.cr137_locationofworks,
    buildingContractor: {
      name: e.cr137_buildingcontractorname,
    },
    estimatedValueOfBuildingActivity: e.cr137_estimatedvalue,
    feeAmountType: e.cr137_feeamounttype,
    checklist: [],
    attachedDocuments: e.cr137_attacheddocuments,
    confirmed: e.cr137_confirmed,
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
