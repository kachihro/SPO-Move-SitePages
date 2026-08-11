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

function toDateOnly(value?: string): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

export function normalizeGuid(id: string): string {
  return id.replace(/[{}]/g, "").trim();
}

/**
 * Lookup payloads for cr137_portaluser → contact.
 *
 * - powerPages: Power Pages' PCF webAPI polyfill strips keys containing `@odata.bind` before
 *   createRecord/updateRecord. Use `_logicalname_value: /logicalname(guid)` instead (entity
 *   logical name, not entity-set plural).
 * - odata: Standard Web API / PortalRestClient `/_api/` bind using the navigation property
 *   (ReferencingEntityNavigationPropertyName = cr137_PortalUser).
 */
export function portalUserLookupPayloads(portalUserId: string): {
  /** Preferred for PCF context.webAPI under Power Pages (polyfill strips @odata.bind). */
  powerPages: Record<string, string>;
  /** Alternate Power Pages shape some polyfills accept. */
  powerPagesBare: Record<string, string>;
  /** Standard OData for PortalRestClient /_api/. */
  odata: Record<string, string>;
} {
  const id = normalizeGuid(portalUserId);
  return {
    powerPages: { _cr137_portaluser_value: `/contact(${id})` },
    powerPagesBare: { _cr137_portaluser_value: id },
    odata: { "cr137_PortalUser@odata.bind": `/contacts(${id})` },
  };
}

/** Prefer the PK column; fall back to GUID in @odata.id when Power Pages omits the PK field. */
export function entityPrimaryKey(entity: BuildingApprovalEntity): string {
  const direct = normalizeGuid(entity[BUILDING_APPROVAL_ID_FIELD] ?? "");
  if (direct) return direct;
  const odataId = (entity as BuildingApprovalEntity & { "@odata.id"?: string })["@odata.id"];
  if (typeof odataId === "string") {
    const match = /\(([0-9a-fA-F-]{36})\)/.exec(odataId);
    if (match) return normalizeGuid(match[1]);
  }
  return "";
}

export function mapToRecord(entity: BuildingApprovalEntity): BuildingApprovalRecord {
  return {
    id: entityPrimaryKey(entity),
    baNumber: entity.cr137_buildingactivitynumber,
    status: entity.cr137_applicationstatus ?? ApplicationStatus.Draft,
    requestDate: toDateOnly(entity.cr137_applicationdate),
    portalUserId: entity._cr137_portaluser_value,
    applicant: {
      name: entity.cr137_applicantname,
      postalAddress: entity.cr137_applicantpostaladdress,
      contactPerson: entity.cr137_applicantcontactperson,
      email: entity.cr137_applicantemail,
      telephone: entity.cr137_applicanttelephone,
      facsimile: entity.cr137_applicantfacsimile,
    },
    owner: {
      name: entity.cr137_ownername,
      postalAddress: entity.cr137_ownerpostaladdress,
      contactPerson: entity.cr137_ownercontactperson,
      email: entity.cr137_owneremail,
      telephone: entity.cr137_ownertelephone,
      facsimile: entity.cr137_ownerfacsimile,
    },
    locationOfWorks: entity.cr137_worklocation,
    descriptionOfWorks: entity.cr137_workdescription,
    purposeOfWorks: entity.cr137_workpurpose,
    estimatedStartDate: toDateOnly(entity.cr137_estimatedstartdate),
    estimatedCompletionDate: toDateOnly(entity.cr137_estimatedcompletiondate),
    buildingContractor: {
      name: entity.cr137_buildingcontractornamw,
      // "Building Contractor" postal/contact/email/phone/fax are real cr137_consultant* columns.
      postalAddress: entity.cr137_consultantpostaladdress,
      contactPerson: entity.cr137_consultantcontactperson,
      email: entity.cr137_consultantemail,
      telephone: entity.cr137_consultanttelephone,
      facsimile: entity.cr137_consultantfacsimile,
    },
    estimatedValueOfBuildingActivity: entity.cr137_estimatedbuildingactivityvalue,
    feeAmountType: entity.cr137_feeamounttype,
    worksComplyWith: {
      masterplanReference: entity.cr137_masterplanreference,
      environmentalStrategy: entity.cr137_environmentalstrategy,
      mdpDetails: entity.cr137_mdpdetails,
    },
    signature: entity.cr137_applicantsignature,
    signatureDate: toDateOnly(entity.cr137_signaturedate),
    checklist: {
      electrical: {
        supplyApplicationRequired: entity.cr137_electricalsupplyapplicationrequir,
        meterProvided: entity.cr137_meterprovided,
        ampsPerPhase: entity.cr137_ampsperphase,
        totalPowerDemand: entity.cr137_totalpowerdemand,
        maximumDemandAndSupplyDetails: entity.cr137_electricalmaximumdemandandsupply,
      },
      hydraulics: {
        domesticWater: {
          connectionRequired: entity.cr137_domesticwaterconnectionrequired,
          meterProvided: entity.cr137_domesticwatermeterprovided,
          demand: entity.cr137_domesticwaterdemand,
        },
        recycledWater: {
          connectionRequired: entity.cr137_recycledwaterconnectionrequired,
          meterProvided: entity.cr137_recycledwatermeterprovided,
          demand: entity.cr137_recycledwaterdemand,
        },
        sewerage: {
          connectionRequired: entity.cr137_sewerageconnectionrequired,
          demand: entity.cr137_seweragedemand,
        },
        fireWater: {
          connectionRequired: entity.cr137_firewaterconnectionrequired,
          demand: entity.cr137_firewaterdemand,
        },
        backflowPreventionConfirmed: entity.cr137_backflowpreventiondeviceconfirmat,
      },
      security: {
        securityRestrictedArea: entity.cr137_securityrestrictedarea,
        customsControlledArea: entity.cr137_customscontrolledarea,
        sterileArea: entity.cr137_sterilearea,
        airsideFenceChangeRequired: entity.cr137_airsidefencechangerequired,
        securityDesignDetails: entity.cr137_securitydesigndetails,
      },
    },
    attachedDocuments: entity.cr137_supportingdocuments,
  };
}

export function mapFromRecord(data: Partial<BuildingApprovalRecord>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.status !== undefined) payload.cr137_applicationstatus = data.status;
  if (data.baNumber !== undefined) payload.cr137_buildingactivitynumber = data.baNumber;
  if (data.requestDate !== undefined) payload.cr137_applicationdate = toDateOnly(data.requestDate);
  // portalUserId is applied by each client — Power Pages webAPI strips @odata.bind keys, while
  // raw Portal /_api/ needs the navigation-property bind. See portalUserLookupPayloads().
  if (data.applicant) {
    if (data.applicant.name !== undefined) payload.cr137_applicantname = data.applicant.name;
    if (data.applicant.postalAddress !== undefined) payload.cr137_applicantpostaladdress = data.applicant.postalAddress;
    if (data.applicant.contactPerson !== undefined) payload.cr137_applicantcontactperson = data.applicant.contactPerson;
    if (data.applicant.email !== undefined) payload.cr137_applicantemail = data.applicant.email;
    if (data.applicant.telephone !== undefined) payload.cr137_applicanttelephone = data.applicant.telephone;
    if (data.applicant.facsimile !== undefined) payload.cr137_applicantfacsimile = data.applicant.facsimile;
  }
  if (data.owner) {
    if (data.owner.name !== undefined) payload.cr137_ownername = data.owner.name;
    if (data.owner.postalAddress !== undefined) payload.cr137_ownerpostaladdress = data.owner.postalAddress;
    if (data.owner.contactPerson !== undefined) payload.cr137_ownercontactperson = data.owner.contactPerson;
    if (data.owner.email !== undefined) payload.cr137_owneremail = data.owner.email;
    if (data.owner.telephone !== undefined) payload.cr137_ownertelephone = data.owner.telephone;
    if (data.owner.facsimile !== undefined) payload.cr137_ownerfacsimile = data.owner.facsimile;
  }
  if (data.locationOfWorks !== undefined) payload.cr137_worklocation = data.locationOfWorks;
  if (data.descriptionOfWorks !== undefined) payload.cr137_workdescription = data.descriptionOfWorks;
  if (data.purposeOfWorks !== undefined) payload.cr137_workpurpose = data.purposeOfWorks;
  if (data.estimatedStartDate !== undefined) payload.cr137_estimatedstartdate = toDateOnly(data.estimatedStartDate);
  if (data.estimatedCompletionDate !== undefined) payload.cr137_estimatedcompletiondate = toDateOnly(data.estimatedCompletionDate);
  if (data.buildingContractor) {
    if (data.buildingContractor.name !== undefined) payload.cr137_buildingcontractornamw = data.buildingContractor.name;
    if (data.buildingContractor.postalAddress !== undefined) payload.cr137_consultantpostaladdress = data.buildingContractor.postalAddress;
    if (data.buildingContractor.contactPerson !== undefined) payload.cr137_consultantcontactperson = data.buildingContractor.contactPerson;
    if (data.buildingContractor.email !== undefined) payload.cr137_consultantemail = data.buildingContractor.email;
    if (data.buildingContractor.telephone !== undefined) payload.cr137_consultanttelephone = data.buildingContractor.telephone;
    if (data.buildingContractor.facsimile !== undefined) payload.cr137_consultantfacsimile = data.buildingContractor.facsimile;
  }
  if (data.estimatedValueOfBuildingActivity !== undefined) payload.cr137_estimatedbuildingactivityvalue = data.estimatedValueOfBuildingActivity;
  if (data.feeAmountType !== undefined) payload.cr137_feeamounttype = data.feeAmountType;
  if (data.worksComplyWith) {
    if (data.worksComplyWith.masterplanReference !== undefined) payload.cr137_masterplanreference = data.worksComplyWith.masterplanReference;
    if (data.worksComplyWith.environmentalStrategy !== undefined) payload.cr137_environmentalstrategy = data.worksComplyWith.environmentalStrategy;
    if (data.worksComplyWith.mdpDetails !== undefined) payload.cr137_mdpdetails = data.worksComplyWith.mdpDetails;
  }
  if (data.signature !== undefined) payload.cr137_applicantsignature = data.signature;
  if (data.signatureDate !== undefined) payload.cr137_signaturedate = toDateOnly(data.signatureDate);
  if (data.checklist) {
    const { electrical, hydraulics, security } = data.checklist;
    if (electrical) {
      if (electrical.supplyApplicationRequired !== undefined) payload.cr137_electricalsupplyapplicationrequir = electrical.supplyApplicationRequired;
      if (electrical.meterProvided !== undefined) payload.cr137_meterprovided = electrical.meterProvided;
      if (electrical.ampsPerPhase !== undefined) payload.cr137_ampsperphase = electrical.ampsPerPhase;
      if (electrical.totalPowerDemand !== undefined) payload.cr137_totalpowerdemand = electrical.totalPowerDemand;
      if (electrical.maximumDemandAndSupplyDetails !== undefined) payload.cr137_electricalmaximumdemandandsupply = electrical.maximumDemandAndSupplyDetails;
    }
    if (hydraulics) {
      if (hydraulics.domesticWater?.connectionRequired !== undefined) payload.cr137_domesticwaterconnectionrequired = hydraulics.domesticWater.connectionRequired;
      if (hydraulics.domesticWater?.meterProvided !== undefined) payload.cr137_domesticwatermeterprovided = hydraulics.domesticWater.meterProvided;
      if (hydraulics.domesticWater?.demand !== undefined) payload.cr137_domesticwaterdemand = hydraulics.domesticWater.demand;
      if (hydraulics.recycledWater?.connectionRequired !== undefined) payload.cr137_recycledwaterconnectionrequired = hydraulics.recycledWater.connectionRequired;
      if (hydraulics.recycledWater?.meterProvided !== undefined) payload.cr137_recycledwatermeterprovided = hydraulics.recycledWater.meterProvided;
      if (hydraulics.recycledWater?.demand !== undefined) payload.cr137_recycledwaterdemand = hydraulics.recycledWater.demand;
      if (hydraulics.sewerage?.connectionRequired !== undefined) payload.cr137_sewerageconnectionrequired = hydraulics.sewerage.connectionRequired;
      if (hydraulics.sewerage?.demand !== undefined) payload.cr137_seweragedemand = hydraulics.sewerage.demand;
      if (hydraulics.fireWater?.connectionRequired !== undefined) payload.cr137_firewaterconnectionrequired = hydraulics.fireWater.connectionRequired;
      if (hydraulics.fireWater?.demand !== undefined) payload.cr137_firewaterdemand = hydraulics.fireWater.demand;
      if (hydraulics.backflowPreventionConfirmed !== undefined) payload.cr137_backflowpreventiondeviceconfirmat = hydraulics.backflowPreventionConfirmed;
    }
    if (security) {
      if (security.securityRestrictedArea !== undefined) payload.cr137_securityrestrictedarea = security.securityRestrictedArea;
      if (security.customsControlledArea !== undefined) payload.cr137_customscontrolledarea = security.customsControlledArea;
      if (security.sterileArea !== undefined) payload.cr137_sterilearea = security.sterileArea;
      if (security.airsideFenceChangeRequired !== undefined) payload.cr137_airsidefencechangerequired = security.airsideFenceChangeRequired;
      if (security.securityDesignDetails !== undefined) payload.cr137_securitydesigndetails = security.securityDesignDetails;
    }
  }
  if (data.attachedDocuments !== undefined) payload.cr137_supportingdocuments = data.attachedDocuments;
  return payload;
}
