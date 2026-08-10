import {
  ApplicationStatus,
  BUILDING_APPROVAL_ID_FIELD,
  BuildingApprovalEntity,
  BuildingApprovalRecord,
} from "../types/BuildingApproval";

/**
 * Shared entity <-> record mapping used by both WebApiClient and PortalRestClient, so the real
 * Dataverse column names (docs/open-questions.md item 4) only need updating in one place.
 */
export function mapToRecord(entity: BuildingApprovalEntity): BuildingApprovalRecord {
  return {
    id: entity[BUILDING_APPROVAL_ID_FIELD] ?? "",
    baNumber: entity.cr137_buildingactivitynumber,
    status: entity.cr137_applicationstatus ?? ApplicationStatus.Draft,
    requestDate: entity.cr137_applicationdate,
    portalUserId: entity._cr137_portaluser_value,
    applicant: {
      name: entity.cr137_applicantname,
      postalAddress: entity.cr137_applicantpostaladdress,
      contactPerson: entity.cr137_applicantcontactperson,
      email: entity.cr137_applicantemail,
      telephone: entity.cr137_applicanttelephone,
    },
    owner: {
      name: entity.cr137_ownername,
      postalAddress: entity.cr137_ownerpostaladdress,
      contactPerson: entity.cr137_ownercontactperson,
      email: entity.cr137_owneremail,
      telephone: entity.cr137_ownertelephone,
    },
    locationOfWorks: entity.cr137_worklocation,
    buildingContractor: {
      name: entity.cr137_buildingcontractornamw,
    },
    estimatedValueOfBuildingActivity: entity.cr137_estimatedbuildingactivityvalue,
    feeAmountType: entity.cr137_feeamounttype,
    checklist: [],
    attachedDocuments: entity.cr137_supportingdocuments,
  };
}

export function mapFromRecord(data: Partial<BuildingApprovalRecord>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.status !== undefined) payload.cr137_applicationstatus = data.status;
  if (data.applicant) {
    if (data.applicant.name !== undefined) payload.cr137_applicantname = data.applicant.name;
    if (data.applicant.postalAddress !== undefined) payload.cr137_applicantpostaladdress = data.applicant.postalAddress;
    if (data.applicant.contactPerson !== undefined) payload.cr137_applicantcontactperson = data.applicant.contactPerson;
    if (data.applicant.email !== undefined) payload.cr137_applicantemail = data.applicant.email;
    if (data.applicant.telephone !== undefined) payload.cr137_applicanttelephone = data.applicant.telephone;
  }
  if (data.owner) {
    if (data.owner.name !== undefined) payload.cr137_ownername = data.owner.name;
    if (data.owner.postalAddress !== undefined) payload.cr137_ownerpostaladdress = data.owner.postalAddress;
    if (data.owner.contactPerson !== undefined) payload.cr137_ownercontactperson = data.owner.contactPerson;
    if (data.owner.email !== undefined) payload.cr137_owneremail = data.owner.email;
    if (data.owner.telephone !== undefined) payload.cr137_ownertelephone = data.owner.telephone;
  }
  if (data.locationOfWorks !== undefined) payload.cr137_worklocation = data.locationOfWorks;
  if (data.buildingContractor?.name !== undefined) payload.cr137_buildingcontractornamw = data.buildingContractor.name;
  if (data.estimatedValueOfBuildingActivity !== undefined) payload.cr137_estimatedbuildingactivityvalue = data.estimatedValueOfBuildingActivity;
  if (data.feeAmountType !== undefined) payload.cr137_feeamounttype = data.feeAmountType;
  if (data.attachedDocuments !== undefined) payload.cr137_supportingdocuments = data.attachedDocuments;
  return payload;
}
