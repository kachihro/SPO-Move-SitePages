// Real schema, pulled via `pac modelbuilder build --entitynamesfilter cr137_buildingactivityapplication`
// against poc-cli (orga3a7d35b.crm6.dynamics.com) — see docs/open-questions.md item 4 for how this was
// obtained and what's still unconfirmed (the Step 2 checklist section: this table has ~100 trade-specific
// fields — electrical, water, excavation, cranes, antennas, security, customs, traffic management,
// landscaping, etc. — far more than the single "Electrical" placeholder StepFeeAndChecklist.tsx models
// today; that step needs a scoping pass before it can cover the real form).

export const BUILDING_APPROVAL_ENTITY_SET = "cr137_buildingactivityapplications";
export const BUILDING_APPROVAL_ENTITY_LOGICAL_NAME = "cr137_buildingactivityapplication";
export const BUILDING_APPROVAL_ID_FIELD = "cr137_buildingactivityapplicationid";

/** Confirmed real choice values (cr137_applicationstatus option set). */
export enum ApplicationStatus {
  Draft = 466860000,
  Submitted = 466860001,
  Processing = 466860002,
  Approved = 466860003,
  Denied = 466860004,
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
 * Local component-state shape for the wizard. `owner` corresponds to the UI's "Lessee Details (If Not
 * Applicant)" section — the real Dataverse columns are named cr137_owner*, not cr137_lessee* as
 * originally guessed; kept as a separate field name here (`owner`, not `lessee`) so it stays honest
 * about what the underlying table actually calls it.
 */
export interface BuildingApprovalFormData {
  applicant: Applicant;
  owner: Applicant;
  locationOfWorks?: string;
  buildingContractor: BuildingContractor;
  estimatedValueOfBuildingActivity?: number;
  feeAmountType?: number;
  checklist: ChecklistTrade[];
  attachedDocuments?: string;
  confirmed?: boolean;
}

export interface BuildingApprovalRecord extends BuildingApprovalFormData {
  id: string;
  baNumber?: string;
  status: ApplicationStatus;
  requestDate?: string;
  /** contact record id backing cr137_portaluser — TODO: confirm the lookup's target table is `contact` (see docs/open-questions.md item 4b). */
  portalUserId?: string;
}

/**
 * Raw Dataverse column shape for the confirmed real fields we map today. The table has ~140 columns
 * total (see docs/open-questions.md item 5) — only the ones StepApplicantAndActivity/StepFeeAndChecklist
 * actually use are listed here; add more as the wizard grows to cover the real checklist section.
 */
export interface BuildingApprovalEntity {
  cr137_buildingactivityapplicationid?: string;
  cr137_buildingactivitynumber?: string;
  cr137_applicationstatus?: ApplicationStatus;
  cr137_applicationdate?: string;
  cr137_applicantname?: string;
  cr137_applicantpostaladdress?: string;
  cr137_applicantcontactperson?: string;
  cr137_applicantemail?: string;
  cr137_applicanttelephone?: string;
  cr137_ownername?: string;
  cr137_ownerpostaladdress?: string;
  cr137_ownercontactperson?: string;
  cr137_owneremail?: string;
  cr137_ownertelephone?: string;
  cr137_worklocation?: string;
  // Typo ("Namw" not "Name") is in the real Dataverse column — preserved intentionally.
  cr137_buildingcontractornamw?: string;
  cr137_estimatedbuildingactivityvalue?: number;
  cr137_feeamounttype?: number;
  cr137_supportingdocuments?: string;
  _cr137_portaluser_value?: string;
}

export function emptyFormData(): BuildingApprovalFormData {
  return {
    applicant: {},
    owner: {},
    buildingContractor: {},
    checklist: [],
  };
}

/** cr137_buildingactivityapplication_cr137_feeamounttype option set (confirmed real values). */
export const FEE_AMOUNT_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "$350 (Value under $10000)" },
  { value: 2, label: "$500 (Value between $10,000 and $50,000)" },
  { value: 3, label: "$700 (Value between $50,000 and $100,000)" },
  { value: 4, label: "$1000 + 0.15% (Value of the balance in excess of $100,000)" },
  { value: 5, label: "AAL project" },
];
