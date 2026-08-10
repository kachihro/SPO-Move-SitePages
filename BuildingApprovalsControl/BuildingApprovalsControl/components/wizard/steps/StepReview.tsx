import * as React from "react";
import { Field, Input } from "@fluentui/react-components";

export interface StepReviewProps {
  baNumber?: string;
}

/**
 * Step 3 per the confirmed live screenshot is just a read-only BA Number display — the record's
 * autonumber isn't assigned until create, so this shows "(assigned on save)" until a recordId exists.
 */
export const StepReview: React.FC<StepReviewProps> = ({ baNumber }) => (
  <Field label="BA Number">
    <Input value={baNumber ?? "(assigned on save)"} readOnly />
  </Field>
);
