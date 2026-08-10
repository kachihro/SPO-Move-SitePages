import * as React from "react";
import { TabList, Tab } from "@fluentui/react-components";

export interface WizardStepperProps {
  current: number;
  labels: string[];
  onSelect?: (step: number) => void;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({ current, labels, onSelect }) => (
  <TabList
    selectedValue={String(current)}
    onTabSelect={(_, data) => onSelect?.(Number(data.value))}
  >
    {labels.map((label, index) => (
      <Tab key={label} value={String(index + 1)}>
        {label}
      </Tab>
    ))}
  </TabList>
);
