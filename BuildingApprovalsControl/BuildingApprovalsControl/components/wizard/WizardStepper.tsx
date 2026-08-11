import * as React from "react";
import { makeStyles, mergeClasses } from "@fluentui/react-components";
import { heroButtonGradient } from "../theme";

const useStyles = makeStyles({
  list: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    alignItems: "center",
  },
  step: {
    border: "none",
    borderRadius: "999px",
    minWidth: "88px",
    height: "36px",
    paddingLeft: "18px",
    paddingRight: "18px",
    fontWeight: 600,
    fontSize: "14px",
    fontFamily: "inherit",
    cursor: "pointer",
    backgroundColor: "#E8E4DE",
    color: "#5C574F",
    boxShadow: "none",
    ":hover": {
      backgroundColor: "#DDD8D0",
    },
  },
  active: {
    backgroundColor: "transparent",
    backgroundImage: heroButtonGradient,
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(194, 38, 114, 0.3)",
    ":hover": {
      backgroundImage: heroButtonGradient,
      color: "#ffffff",
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
