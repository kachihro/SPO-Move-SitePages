// Placeholder schema — the real Dataverse table logical name and most field logical names are NOT yet
// confirmed (see docs/open-questions.md, item 4). Only the `cr137` publisher prefix and the
// `cr137_applicationstatus` choice column are confirmed from the existing design doc. Re-pull the site
// with `pac pages download-website` (including forms/lists) or check make.powerapps.com before treating
// any other name here as real.

/** TODO: confirm the real table logical name (currently a placeholder). */
export const BUILDING_APPROVAL_ENTITY_SET = "cr137_buildingapprovals";

/** Confirmed real choice column name; values below are placeholders pending confirmation of the choice set. */
export enum ApplicationStatus {
  Draft = 100000000,
  Submitted = 100000001,
  Processing = 100000002,
  Approved = 100000003,
  Denied = 100000004,
}

export interface Applicant {
  name?: string;
  postalAddress?: string;
  contactPerson?: string;
  email?: string;
  telephone?: string;
}

export interface BuildingContractor {
  name?: string;
}

export interface ChecklistTrade {
  /** e.g. "Electrical" — full trade list is unconfirmed, see docs/open-questions.md item 5. */
  trade: string;
  newSupplyRequired?: boolean;
  increasedSupplyRequired?: boolean;
  voltage?: string;
  presentSupplyRating?: string;
  requestedSupplyRating?: string;
}

/**
 * Local component-state shape for the wizard. Field names here are working names, not confirmed
 * Dataverse logical names — the DataverseClient layer is responsible for mapping to/from real columns
 * once the schema is confirmed.
 */
export interface BuildingApprovalFormData {
  applicant: Applicant;
  lessee: Applicant;
  locationOfWorks?: string;
  buildingContractor: BuildingContractor;
  estimatedValueOfBuildingActivity?: string;
  feeAmountType?: string;
  checklist: ChecklistTrade[];
  attachedDocuments?: string;
  confirmed?: boolean;
}

export interface BuildingApprovalRecord extends BuildingApprovalFormData {
  id: string;
  baNumber?: string;
  status: ApplicationStatus;
  requestDate?: string;
}

/**
 * Raw Dataverse column shape (placeholder names, see the file-level comment). Used to type-narrow
 * `ComponentFramework.WebApi.Entity` / portal REST JSON responses without resorting to `any`.
 */
export interface BuildingApprovalEntity {
  cr137_buildingapprovalid?: string;
  cr137_banumber?: string;
  cr137_applicationstatus?: ApplicationStatus;
  createdon?: string;
  cr137_applicantname?: string;
  cr137_applicantpostaladdress?: string;
  cr137_applicantcontactperson?: string;
  cr137_applicantemail?: string;
  cr137_applicanttelephone?: string;
  cr137_lesseename?: string;
  cr137_lesseepostaladdress?: string;
  cr137_lesseecontactperson?: string;
  cr137_lesseeemail?: string;
  cr137_lesseetelephone?: string;
  cr137_locationofworks?: string;
  cr137_buildingcontractorname?: string;
  cr137_estimatedvalue?: string;
  cr137_feeamounttype?: string;
  cr137_attacheddocuments?: string;
  cr137_confirmed?: boolean;
}

export function emptyFormData(): BuildingApprovalFormData {
  return {
    applicant: {},
    lessee: {},
    buildingContractor: {},
    checklist: [],
  };
}
