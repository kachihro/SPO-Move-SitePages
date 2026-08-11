// Real schema, pulled via `pac modelbuilder build --entitynamesfilter cr137_buildingactivityapplication`
// against poc-cli (orga3a7d35b.crm6.dynamics.com) — see docs/open-questions.md item 4 for how this was
// obtained. The 2026-08-11 pull (item 5) resolved the full checklist column list against the source PDF
// (`APPLICATION FOR BUILDING ACTIVITY CONSENT`); this file currently models the Applicant/Lessee/Building
// Activity/Building Contractor/Fee/Works-Comply-With/Signature fields plus three checklist categories
// (Electrical, Hydraulics, Security) — the other ~20 checklist categories from the PDF are pulled and
// documented in docs/open-questions.md but not yet modeled here.

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
  facsimile?: string;
}

/**
 * UI label is "Building Contractor" but the real Dataverse columns are a mix: Name is the confirmed
 * `cr137_buildingcontractornamw` (typo kept intentionally), while Postal Address/Contact Person/Email/
 * Telephone/Facsimile are actually `cr137_consultant*` columns, not `cr137_buildingcontractor*` — see
 * docs/open-questions.md item 5.
 */
export interface BuildingContractor {
  name?: string;
  postalAddress?: string;
  contactPerson?: string;
  email?: string;
  telephone?: string;
  facsimile?: string;
}

/**
 * "Works Comply With" (page 2 of the PDF) is presented as Yes/Not Applicable checkboxes on paper, but
 * the real Dataverse columns (`cr137_masterplanreference`, `cr137_environmentalstrategy`,
 * `cr137_mdpdetails`) are all free-text `string` fields, not booleans — confirmed via
 * `pac modelbuilder build`, not guessed. Rendered as text inputs to match the real column type.
 */
export interface WorksComplyWith {
  masterplanReference?: string;
  environmentalStrategy?: string;
  mdpDetails?: string;
}

/** "Electrical" checklist category (PDF page 4, item 5). */
export interface ElectricalChecklist {
  supplyApplicationRequired?: boolean;
  meterProvided?: boolean;
  ampsPerPhase?: number;
  totalPowerDemand?: number;
  /**
   * The PDF also asks for "Number of Phases" (1/2/3) — no dedicated column exists for that in the real
   * schema (confirmed via pac modelbuilder, not an oversight in this mapping), so it's expected to be
   * captured here as free text alongside any other demand/supply detail.
   */
  maximumDemandAndSupplyDetails?: string;
}

/** One water-connection row shared by the Hydraulics category (PDF page 4, item 8). */
export interface WaterConnection {
  connectionRequired?: boolean;
  meterProvided?: boolean;
  demand?: number;
}

export interface HydraulicsChecklist {
  domesticWater: WaterConnection;
  recycledWater: WaterConnection;
  /** Sewerage has no "Meter provided" row in the PDF, and no matching Dataverse column either. */
  sewerage: Omit<WaterConnection, "meterProvided">;
  /** Fire water has no "Meter provided" row in the PDF, and no matching Dataverse column either. */
  fireWater: Omit<WaterConnection, "meterProvided">;
  backflowPreventionConfirmed?: boolean;
}

/** "Security" checklist category (PDF page 5, item 14). */
export interface SecurityChecklist {
  securityRestrictedArea?: boolean;
  customsControlledArea?: boolean;
  sterileArea?: boolean;
  airsideFenceChangeRequired?: boolean;
  /**
   * PDF shows this as a Yes/No/N/A row ("Details of fencing... provided") but the real column
   * (`cr137_securitydesigndetails`) is a free-text `string`, not a boolean — confirmed via schema pull.
   */
  securityDesignDetails?: string;
}

export interface ChecklistData {
  electrical: ElectricalChecklist;
  hydraulics: HydraulicsChecklist;
  security: SecurityChecklist;
}

export interface BuildingApprovalFormData {
  applicant: Applicant;
  owner: Applicant;
  locationOfWorks?: string;
  descriptionOfWorks?: string;
  purposeOfWorks?: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  buildingContractor: BuildingContractor;
  estimatedValueOfBuildingActivity?: number;
  feeAmountType?: number;
  worksComplyWith: WorksComplyWith;
  signature?: string;
  signatureDate?: string;
  checklist: ChecklistData;
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
 * Raw Dataverse column shape for the confirmed real fields this control models today. The table has
 * ~140 columns total (see docs/open-questions.md item 5) — the full field list (all ~150 logical names,
 * types, and descriptions) was pulled via `pac modelbuilder build` on 2026-08-11 and is documented there;
 * only the columns actually used by the wizard steps are listed here.
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
  cr137_applicantfacsimile?: string;
  cr137_ownername?: string;
  cr137_ownerpostaladdress?: string;
  cr137_ownercontactperson?: string;
  cr137_owneremail?: string;
  cr137_ownertelephone?: string;
  cr137_ownerfacsimile?: string;
  cr137_worklocation?: string;
  cr137_workdescription?: string;
  cr137_workpurpose?: string;
  cr137_estimatedstartdate?: string;
  cr137_estimatedcompletiondate?: string;
  // Typo ("Namw" not "Name") is in the real Dataverse column — preserved intentionally.
  cr137_buildingcontractornamw?: string;
  // "Building Contractor" postal/contact/email/phone/fax are real `cr137_consultant*` columns, not
  // `cr137_buildingcontractor*` — confirmed via pac modelbuilder, see types above.
  cr137_consultantpostaladdress?: string;
  cr137_consultantcontactperson?: string;
  cr137_consultantemail?: string;
  cr137_consultanttelephone?: string;
  cr137_consultantfacsimile?: string;
  cr137_estimatedbuildingactivityvalue?: number;
  cr137_feeamounttype?: number;
  cr137_masterplanreference?: string;
  cr137_environmentalstrategy?: string;
  cr137_mdpdetails?: string;
  cr137_applicantsignature?: string;
  cr137_signaturedate?: string;
  cr137_supportingdocuments?: string;
  _cr137_portaluser_value?: string;

  // Electrical
  cr137_electricalsupplyapplicationrequir?: boolean;
  cr137_meterprovided?: boolean;
  cr137_ampsperphase?: number;
  cr137_totalpowerdemand?: number;
  cr137_electricalmaximumdemandandsupply?: string;

  // Hydraulics
  cr137_domesticwaterconnectionrequired?: boolean;
  cr137_domesticwatermeterprovided?: boolean;
  cr137_domesticwaterdemand?: number;
  cr137_recycledwaterconnectionrequired?: boolean;
  cr137_recycledwatermeterprovided?: boolean;
  cr137_recycledwaterdemand?: number;
  cr137_sewerageconnectionrequired?: boolean;
  cr137_seweragedemand?: number;
  cr137_firewaterconnectionrequired?: boolean;
  cr137_firewaterdemand?: number;
  cr137_backflowpreventiondeviceconfirmat?: boolean;

  // Security
  cr137_securityrestrictedarea?: boolean;
  cr137_customscontrolledarea?: boolean;
  cr137_sterilearea?: boolean;
  cr137_airsidefencechangerequired?: boolean;
  cr137_securitydesigndetails?: string;
}

export function emptyFormData(): BuildingApprovalFormData {
  return {
    applicant: {},
    owner: {},
    buildingContractor: {},
    worksComplyWith: {},
    checklist: {
      electrical: {},
      hydraulics: { domesticWater: {}, recycledWater: {}, sewerage: {}, fireWater: {} },
      security: {},
    },
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
