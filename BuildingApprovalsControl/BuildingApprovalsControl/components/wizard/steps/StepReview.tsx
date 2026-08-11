import * as React from "react";
import { Field, Input } from "@fluentui/react-components";

export interface StepReviewProps {
  baNumber?: string;
}

/**
 * Step 3 per the confirmed live screenshot is just a read-only BA Number display — the BA number
 * is assigned on submit, so this shows "(assigned on submit)" until then.
 */
export const StepReview: React.FC<StepReviewProps> = ({ baNumber }) => (
  <Field label="BA Number">
    <Input value={baNumber ?? "(assigned on submit)"} readOnly />
  </Field>
);
