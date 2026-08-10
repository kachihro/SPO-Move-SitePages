import * as React from "react";
import { Card, CardHeader, Checkbox, Field, Input, Option, Dropdown, Textarea } from "@fluentui/react-components";
import { BuildingApprovalFormData, ChecklistTrade, FEE_AMOUNT_TYPE_OPTIONS } from "../../../types/BuildingApproval";
import { StepProps } from "./StepApplicantAndActivity";

// TODO: only "Electrical" is confirmed from the design doc screenshot — the real table has ~100
// trade-specific checklist columns (water, excavation, cranes, antennas, security, customs, traffic
// management, landscaping, etc., see docs/open-questions.md item 5) that this step doesn't cover yet.
const KNOWN_TRADES = ["Electrical"];

export const StepFeeAndChecklist: React.FC<StepProps> = ({ formData, onChange, readOnly }) => {
  const update = (mutate: (data: BuildingApprovalFormData) => void) => {
    const next = JSON.parse(JSON.stringify(formData)) as BuildingApprovalFormData;
    mutate(next);
    onChange(next);
  };

  const tradeFor = (trade: string): ChecklistTrade =>
    formData.checklist.find((c) => c.trade === trade) ?? { trade };

  const updateTrade = (trade: string, mutate: (t: ChecklistTrade) => void) => {
    update((f) => {
      const existing = f.checklist.find((c) => c.trade === trade);
      const target = existing ?? { trade };
      mutate(target);
      if (!existing) f.checklist.push(target);
    });
  };

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
        <CardHeader header={<b>Checklist</b>} />
        {KNOWN_TRADES.map((trade) => {
          const t = tradeFor(trade);
          return (
            <div key={trade} style={{ marginBottom: "16px" }}>
              <b>{trade}</b>
              <Field label="New supply required">
                <Checkbox
                  checked={!!t.newSupplyRequired}
                  disabled={readOnly}
                  onChange={(_, d) => updateTrade(trade, (x) => (x.newSupplyRequired = !!d.checked))}
                />
              </Field>
              {t.newSupplyRequired && (
                <div style={{ background: "#fff9c4", padding: "12px", borderRadius: "4px" }}>
                  <Field label="Voltage">
                    <Input
                      value={t.voltage ?? ""}
                      disabled={readOnly}
                      onChange={(_, d) => updateTrade(trade, (x) => (x.voltage = d.value))}
                    />
                  </Field>
                  <Field label="Increased supply required">
                    <Checkbox
                      checked={!!t.increasedSupplyRequired}
                      disabled={readOnly}
                      onChange={(_, d) => updateTrade(trade, (x) => (x.increasedSupplyRequired = !!d.checked))}
                    />
                  </Field>
                  {t.increasedSupplyRequired && (
                    <>
                      <Field label="Present Supply rating">
                        <Input
                          value={t.presentSupplyRating ?? ""}
                          disabled={readOnly}
                          onChange={(_, d) => updateTrade(trade, (x) => (x.presentSupplyRating = d.value))}
                        />
                      </Field>
                      <Field label="Requested Supply rating">
                        <Input
                          value={t.requestedSupplyRating ?? ""}
                          disabled={readOnly}
                          onChange={(_, d) => updateTrade(trade, (x) => (x.requestedSupplyRating = d.value))}
                        />
                      </Field>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <Field label="Attached Documents (please list all supporting documents below)">
          <Textarea
            value={formData.attachedDocuments ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.attachedDocuments = d.value))}
          />
        </Field>

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
