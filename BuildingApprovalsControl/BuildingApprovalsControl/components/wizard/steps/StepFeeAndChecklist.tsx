import * as React from "react";
import { Card, CardHeader, Checkbox, Field, Input, Option, Dropdown, Textarea } from "@fluentui/react-components";
import { BuildingApprovalFormData, FEE_AMOUNT_TYPE_OPTIONS } from "../../../types/BuildingApproval";
import { StepProps } from "./StepApplicantAndActivity";
import { YesNoField } from "./YesNoField";

const twoColumn: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };

export const StepFeeAndChecklist: React.FC<StepProps> = ({ formData, onChange, readOnly }) => {
  const update = (mutate: (data: BuildingApprovalFormData) => void) => {
    const next = JSON.parse(JSON.stringify(formData)) as BuildingApprovalFormData;
    mutate(next);
    onChange(next);
  };

  const { electrical, hydraulics, security } = formData.checklist;

  return (
    <div>
      <Card>
        <CardHeader header={<b>Application Fee</b>} />
        <Field label="Estimated Value of Building Activity">
          <Input
            value={formData.estimatedValueOfBuildingActivity?.toString() ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.estimatedValueOfBuildingActivity = d.value === "" ? undefined : Number(d.value)))}
          />
        </Field>
        <Field label="Fee Amount Type">
          <Dropdown
            value={FEE_AMOUNT_TYPE_OPTIONS.find((o) => o.value === formData.feeAmountType)?.label ?? ""}
            disabled={readOnly}
            onOptionSelect={(_, d) => update((f) => (f.feeAmountType = d.optionValue !== undefined ? Number(d.optionValue) : undefined))}
          >
            {FEE_AMOUNT_TYPE_OPTIONS.map((opt) => (
              <Option key={opt.value} value={String(opt.value)}>
                {opt.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </Card>

      <Card style={{ marginTop: "16px" }}>
        <CardHeader header={<b>Works Comply With</b>} />
        <Field label="Masterplan">
          <Input
            value={formData.worksComplyWith.masterplanReference ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.worksComplyWith.masterplanReference = d.value))}
          />
        </Field>
        <Field label="Environmental Strategy">
          <Input
            value={formData.worksComplyWith.environmentalStrategy ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.worksComplyWith.environmentalStrategy = d.value))}
          />
        </Field>
        <Field label="MDP (as applicable)">
          <Input
            value={formData.worksComplyWith.mdpDetails ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.worksComplyWith.mdpDetails = d.value))}
          />
        </Field>
      </Card>

      <Card style={{ marginTop: "16px" }}>
        <CardHeader header={<b>Checklist</b>} />

        <div style={{ marginBottom: "20px" }}>
          <b>5. Electrical</b>
          <YesNoField
            label="Application for electrical supply required"
            value={electrical.supplyApplicationRequired}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.electrical.supplyApplicationRequired = v))}
          />
          {electrical.supplyApplicationRequired && (
            <>
              <YesNoField
                label="Meter provided"
                value={electrical.meterProvided}
                disabled={readOnly}
                onChange={(v) => update((f) => (f.checklist.electrical.meterProvided = v))}
              />
              <div style={twoColumn}>
                <Field label="Amps Per Phase">
                  <Input
                    value={electrical.ampsPerPhase?.toString() ?? ""}
                    disabled={readOnly}
                    onChange={(_, d) => update((f) => (f.checklist.electrical.ampsPerPhase = d.value === "" ? undefined : Number(d.value)))}
                  />
                </Field>
                <Field label="Total Power Demand (kwh)">
                  <Input
                    value={electrical.totalPowerDemand?.toString() ?? ""}
                    disabled={readOnly}
                    onChange={(_, d) => update((f) => (f.checklist.electrical.totalPowerDemand = d.value === "" ? undefined : Number(d.value)))}
                  />
                </Field>
              </div>
              <Field label="Electrical Maximum Demand & Supply — other details (incl. Number of Phases)">
                <Textarea
                  value={electrical.maximumDemandAndSupplyDetails ?? ""}
                  disabled={readOnly}
                  onChange={(_, d) => update((f) => (f.checklist.electrical.maximumDemandAndSupplyDetails = d.value))}
                />
              </Field>
            </>
          )}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <b>8. Hydraulics</b>

          <div style={{ marginTop: "8px" }}>
            <i>Domestic water</i>
            <YesNoField
              label="Connection required"
              value={hydraulics.domesticWater.connectionRequired}
              disabled={readOnly}
              onChange={(v) => update((f) => (f.checklist.hydraulics.domesticWater.connectionRequired = v))}
            />
            {hydraulics.domesticWater.connectionRequired && (
              <>
                <YesNoField
                  label="Meter provided"
                  value={hydraulics.domesticWater.meterProvided}
                  disabled={readOnly}
                  onChange={(v) => update((f) => (f.checklist.hydraulics.domesticWater.meterProvided = v))}
                />
                <Field label="Demand (size of supply or flow rate)">
                  <Input
                    value={hydraulics.domesticWater.demand?.toString() ?? ""}
                    disabled={readOnly}
                    onChange={(_, d) => update((f) => (f.checklist.hydraulics.domesticWater.demand = d.value === "" ? undefined : Number(d.value)))}
                  />
                </Field>
              </>
            )}
          </div>

          <div style={{ marginTop: "16px" }}>
            <i>Recycled water</i>
            <YesNoField
              label="Connection required"
              value={hydraulics.recycledWater.connectionRequired}
              disabled={readOnly}
              onChange={(v) => update((f) => (f.checklist.hydraulics.recycledWater.connectionRequired = v))}
            />
            {hydraulics.recycledWater.connectionRequired && (
              <>
                <YesNoField
                  label="Meter provided"
                  value={hydraulics.recycledWater.meterProvided}
                  disabled={readOnly}
                  onChange={(v) => update((f) => (f.checklist.hydraulics.recycledWater.meterProvided = v))}
                />
                <Field label="Demand (size of supply or flow rate)">
                  <Input
                    value={hydraulics.recycledWater.demand?.toString() ?? ""}
                    disabled={readOnly}
                    onChange={(_, d) => update((f) => (f.checklist.hydraulics.recycledWater.demand = d.value === "" ? undefined : Number(d.value)))}
                  />
                </Field>
              </>
            )}
          </div>

          <div style={{ marginTop: "16px" }}>
            <i>Sewerage</i>
            <YesNoField
              label="Connection required"
              value={hydraulics.sewerage.connectionRequired}
              disabled={readOnly}
              onChange={(v) => update((f) => (f.checklist.hydraulics.sewerage.connectionRequired = v))}
            />
            {hydraulics.sewerage.connectionRequired && (
              <Field label="Demand (size of supply or flow rate)">
                <Input
                  value={hydraulics.sewerage.demand?.toString() ?? ""}
                  disabled={readOnly}
                  onChange={(_, d) => update((f) => (f.checklist.hydraulics.sewerage.demand = d.value === "" ? undefined : Number(d.value)))}
                />
              </Field>
            )}
          </div>

          <div style={{ marginTop: "16px" }}>
            <i>Fire water</i>
            <YesNoField
              label="Connection required"
              value={hydraulics.fireWater.connectionRequired}
              disabled={readOnly}
              onChange={(v) => update((f) => (f.checklist.hydraulics.fireWater.connectionRequired = v))}
            />
            {hydraulics.fireWater.connectionRequired && (
              <Field label="Demand (size of supply or flow rate)">
                <Input
                  value={hydraulics.fireWater.demand?.toString() ?? ""}
                  disabled={readOnly}
                  onChange={(_, d) => update((f) => (f.checklist.hydraulics.fireWater.demand = d.value === "" ? undefined : Number(d.value)))}
                />
              </Field>
            )}
          </div>

          <YesNoField
            label="Confirmation that backflow prevention devices are to be installed on all water supply pipe work within a tenancy"
            value={hydraulics.backflowPreventionConfirmed}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.hydraulics.backflowPreventionConfirmed = v))}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <b>14. Security</b>
          <YesNoField
            label="Is the project located in a Security Restricted Area?"
            value={security.securityRestrictedArea}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.security.securityRestrictedArea = v))}
          />
          <YesNoField
            label="Is the project located in a Customs Controlled Area?"
            value={security.customsControlledArea}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.security.customsControlledArea = v))}
          />
          <YesNoField
            label="Is the project located in a Sterile Area?"
            value={security.sterileArea}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.security.sterileArea = v))}
          />
          <YesNoField
            label="Will the project require a change to the Airside fence?"
            value={security.airsideFenceChangeRequired}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.security.airsideFenceChangeRequired = v))}
          />
          <Field label="Details of fencing, security in design, bollards, CCTV, access control, etc.">
            <Textarea
              value={security.securityDesignDetails ?? ""}
              disabled={readOnly}
              onChange={(_, d) => update((f) => (f.checklist.security.securityDesignDetails = d.value))}
            />
          </Field>
        </div>

        <Field label="Attached Documents (please list all supporting documents below)">
          <Textarea
            value={formData.attachedDocuments ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.attachedDocuments = d.value))}
          />
        </Field>
      </Card>

      <Card style={{ marginTop: "16px" }}>
        <CardHeader header={<b>Signature of Owner or Agent</b>} />
        <div style={twoColumn}>
          <Field label="Signature">
            <Input
              value={formData.signature ?? ""}
              disabled={readOnly}
              onChange={(_, d) => update((f) => (f.signature = d.value))}
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={formData.signatureDate ?? ""}
              disabled={readOnly}
              onChange={(_, d) => update((f) => (f.signatureDate = d.value))}
            />
          </Field>
        </div>
        <Checkbox
          label="I confirm in the capacity of owner or agent that the information above is correct to the best of my knowledge"
          checked={!!formData.confirmed}
          disabled={readOnly}
          onChange={(_, d) => update((f) => (f.confirmed = !!d.checked))}
        />
      </Card>
    </div>
  );
};
