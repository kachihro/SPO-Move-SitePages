import * as React from "react";
import { Field, Radio, RadioGroup } from "@fluentui/react-components";

export interface YesNoFieldProps {
  label: string;
  value?: boolean;
  onChange: (value: boolean | undefined) => void;
  disabled?: boolean;
}

/**
 * The PDF's Yes/No/N/A checkbox rows map to plain nullable-boolean Dataverse columns (confirmed via
 * pac modelbuilder, not a three-state choice column) — "unanswered" (neither radio selected) stands in
 * for N/A.
 */
export const YesNoField: React.FC<YesNoFieldProps> = ({ label, value, onChange, disabled }) => (
  <Field label={label}>
    <RadioGroup
      layout="horizontal"
      value={value === undefined ? "" : value ? "yes" : "no"}
      disabled={disabled}
      onChange={(_, data) => onChange(data.value === "yes" ? true : data.value === "no" ? false : undefined)}
    >
      <Radio value="yes" label="Yes" />
      <Radio value="no" label="No" />
    </RadioGroup>
  </Field>
);
