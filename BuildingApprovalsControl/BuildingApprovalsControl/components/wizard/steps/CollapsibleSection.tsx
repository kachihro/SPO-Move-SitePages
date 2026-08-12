import * as React from "react";
import { mergeClasses } from "@fluentui/react-components";
import { useStepStyles } from "./stepStyles";

export interface CollapsibleSectionProps {
  title: string;
  /** Defaults to expanded. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  children,
}) => {
  const styles = useStepStyles();
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.sectionTitleButton}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className={styles.sectionTitleText}>{title}</h3>
        <span
          className={mergeClasses(styles.chevron, !open && styles.chevronCollapsed)}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open && <div className={styles.fieldStack}>{children}</div>}
    </section>
  );
};
