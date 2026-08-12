import * as React from "react";
import { Field, Textarea } from "@fluentui/react-components";
import { BuildingApprovalFormData } from "../../../types/BuildingApproval";
import { CollapsibleSection } from "./CollapsibleSection";
import { StepProps } from "./StepApplicantAndActivity";
import { useStepStyles } from "./stepStyles";

/**
 * Step 3 — Supporting documents. Confirmation checkbox lives in the wizard footer.
 * BA number is still assigned on submit (shown in the grid), not displayed here.
 */
export const StepReview: React.FC<StepProps> = ({ formData, onChange, readOnly }) => {
  const styles = useStepStyles();

  const update = (mutate: (data: BuildingApprovalFormData) => void) => {
    const next = JSON.parse(JSON.stringify(formData)) as BuildingApprovalFormData;
    mutate(next);
    onChange(next);
  };

  return (
    <div className={styles.stack}>
      <CollapsibleSection title="Attached Documents">
        <Field label="Please list all supporting documents below">
          <Textarea
            className={styles.textarea}
            value={formData.attachedDocuments ?? ""}
            disabled={readOnly}
            onChange={(_, d) => update((f) => (f.attachedDocuments = d.value))}
          />
        </Field>
      </CollapsibleSection>
    </div>
  );
};
