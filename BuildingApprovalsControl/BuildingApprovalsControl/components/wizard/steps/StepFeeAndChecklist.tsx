import * as React from "react";
import { Field, Input, Option, Dropdown, Textarea } from "@fluentui/react-components";
import { BuildingApprovalFormData, FEE_AMOUNT_TYPE_OPTIONS } from "../../../types/BuildingApproval";
import { CollapsibleSection } from "./CollapsibleSection";
import { StepProps } from "./StepApplicantAndActivity";
import { useStepStyles } from "./stepStyles";
import { YesNoField } from "./YesNoField";

export const StepFeeAndChecklist: React.FC<StepProps> = ({ formData, onChange, readOnly }) => {
  const styles = useStepStyles();

  const update = (mutate: (data: BuildingApprovalFormData) => void) => {
    const next = JSON.parse(JSON.stringify(formData)) as BuildingApprovalFormData;
    mutate(next);
    onChange(next);
  };

  const { electrical, hydraulics, security } = formData.checklist;

  return (
    <div className={styles.stack}>
      <CollapsibleSection title="Application Fee">
        <Field label="Estimated Value of Building Activity">
          <Input
            className={styles.input}
            value={formData.estimatedValueOfBuildingActivity?.toString() ?? ""}
            disabled={readOnly}
            onChange={(_, d) =>
              update((f) => (f.estimatedValueOfBuildingActivity = d.value === "" ? undefined : Number(d.value)))
            }
          />
        </Field>
        <Field label="Fee Amount Type">
          <Dropdown
            className={styles.input}
            value={FEE_AMOUNT_TYPE_OPTIONS.find((o) => o.value === formData.feeAmountType)?.label ?? ""}
            disabled={readOnly}
            onOptionSelect={(_, d) =>
              update((f) => (f.feeAmountType = d.optionValue !== undefined ? Number(d.optionValue) : undefined))
            }
          >
            {FEE_AMOUNT_TYPE_OPTIONS.map((opt) => (
              <Option key={opt.value} value={String(opt.value)}>
                {opt.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Works Comply With">
        <Field label="Masterplan">
          <Input
            className={styles.input}
            value={formData.worksComplyWith.masterplanReference ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.worksComplyWith.masterplanReference = d.value))}
          />
        </Field>
        <Field label="Environmental Strategy">
          <Input
            className={styles.input}
            value={formData.worksComplyWith.environmentalStrategy ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.worksComplyWith.environmentalStrategy = d.value))}
          />
        </Field>
        <Field label="MDP (as applicable)">
          <Input
            className={styles.input}
            value={formData.worksComplyWith.mdpDetails ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.worksComplyWith.mdpDetails = d.value))}
          />
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Checklist">
        <div className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Electrical</h4>
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
              <div className={styles.twoColumn}>
                <Field label="Amps Per Phase">
                  <Input
                    className={styles.input}
                    value={electrical.ampsPerPhase?.toString() ?? ""}
                    disabled={readOnly}
                    onChange={(_, d) =>
                      update((f) => (f.checklist.electrical.ampsPerPhase = d.value === "" ? undefined : Number(d.value)))
                    }
                  />
                </Field>
                <Field label="Total Power Demand (kwh)">
                  <Input
                    className={styles.input}
                    value={electrical.totalPowerDemand?.toString() ?? ""}
                    disabled={readOnly}
                    onChange={(_, d) =>
                      update(
                        (f) => (f.checklist.electrical.totalPowerDemand = d.value === "" ? undefined : Number(d.value))
                      )
                    }
                  />
                </Field>
              </div>
              <Field label="Electrical Maximum Demand & Supply — other details (incl. Number of Phases)">
                <Textarea
                  className={styles.textarea}
                  value={electrical.maximumDemandAndSupplyDetails ?? ""}
                  disabled={readOnly}
                  onChange={(_, d) => update((f) => (f.checklist.electrical.maximumDemandAndSupplyDetails = d.value))}
                />
              </Field>
            </>
          )}
        </div>

        <div className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Hydraulics - Domestic water</h4>
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
                  className={styles.input}
                  value={hydraulics.domesticWater.demand?.toString() ?? ""}
                  disabled={readOnly}
                  onChange={(_, d) =>
                    update(
                      (f) =>
                        (f.checklist.hydraulics.domesticWater.demand = d.value === "" ? undefined : Number(d.value))
                    )
                  }
                />
              </Field>
            </>
          )}
        </div>

        <div className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Hydraulics - Recycled water</h4>
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
                  className={styles.input}
                  value={hydraulics.recycledWater.demand?.toString() ?? ""}
                  disabled={readOnly}
                  onChange={(_, d) =>
                    update(
                      (f) =>
                        (f.checklist.hydraulics.recycledWater.demand = d.value === "" ? undefined : Number(d.value))
                    )
                  }
                />
              </Field>
            </>
          )}
        </div>

        <div className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Hydraulics - Sewerage</h4>
          <YesNoField
            label="Connection required"
            value={hydraulics.sewerage.connectionRequired}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.hydraulics.sewerage.connectionRequired = v))}
          />
          {hydraulics.sewerage.connectionRequired && (
            <Field label="Demand (size of supply or flow rate)">
              <Input
                className={styles.input}
                value={hydraulics.sewerage.demand?.toString() ?? ""}
                disabled={readOnly}
                onChange={(_, d) =>
                  update((f) => (f.checklist.hydraulics.sewerage.demand = d.value === "" ? undefined : Number(d.value)))
                }
              />
            </Field>
          )}
        </div>

        <div className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Hydraulics - Fire water</h4>
          <YesNoField
            label="Connection required"
            value={hydraulics.fireWater.connectionRequired}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.hydraulics.fireWater.connectionRequired = v))}
          />
          {hydraulics.fireWater.connectionRequired && (
            <Field label="Demand (size of supply or flow rate)">
              <Input
                className={styles.input}
                value={hydraulics.fireWater.demand?.toString() ?? ""}
                disabled={readOnly}
                onChange={(_, d) =>
                  update((f) => (f.checklist.hydraulics.fireWater.demand = d.value === "" ? undefined : Number(d.value)))
                }
              />
            </Field>
          )}

          <YesNoField
            label="Confirmation that backflow prevention devices are to be installed on all water supply pipe work within a tenancy"
            value={hydraulics.backflowPreventionConfirmed}
            disabled={readOnly}
            onChange={(v) => update((f) => (f.checklist.hydraulics.backflowPreventionConfirmed = v))}
          />
        </div>

        <div className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Security</h4>
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
              className={styles.textarea}
              value={security.securityDesignDetails ?? ""}
              disabled={readOnly}
              onChange={(_, d) => update((f) => (f.checklist.security.securityDesignDetails = d.value))}
            />
          </Field>
        </div>
      </CollapsibleSection>
    </div>
  );
};
