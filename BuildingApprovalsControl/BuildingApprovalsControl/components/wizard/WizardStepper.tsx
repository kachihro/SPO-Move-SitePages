import * as React from "react";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { heroButtonGradient } from "../theme";

const useStyles = makeStyles({
  list: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  step: {
    border: "none",
    borderRadius: "999px",
    padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalL}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    fontFamily: tokens.fontFamilyBase,
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  active: {
    backgroundImage: heroButtonGradient,
    color: "#ffffff",
    ":hover": {
      backgroundImage: heroButtonGradient,
    },
  },
});

export interface WizardStepperProps {
  current: number;
  labels: string[];
  onSelect?: (step: number) => void;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({ current, labels, onSelect }) => {
  const styles = useStyles();
  return (
    <div className={styles.list} role="tablist">
      {labels.map((label, index) => {
        const step = index + 1;
        const isActive = step === current;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={mergeClasses(styles.step, isActive && styles.active)}
            onClick={() => onSelect?.(step)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
