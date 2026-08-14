import * as React from "react";
import { AttachmentsGrid } from "./AttachmentsGrid";
import { CollapsibleSection } from "./CollapsibleSection";
import { StepProps } from "./StepApplicantAndActivity";
import { useStepStyles } from "./stepStyles";

/**
 * Step 3 — Supporting documents. Confirmation checkbox lives in the wizard footer.
 * BA number is still assigned on submit (shown in the grid), not displayed here.
 *
 * Files are stored as Dataverse Notes against the application, so this step needs the saved
 * record id — hence its own props type rather than the shared `StepProps`.
 */
export interface StepReviewProps extends StepProps {
  recordId: string | null;
  onAttachmentsBusyChange?: (busy: boolean) => void;
}

export const StepReview: React.FC<StepReviewProps> = ({ readOnly, recordId, onAttachmentsBusyChange }) => {
  const styles = useStepStyles();

  return (
    <div className={styles.stack}>
      <CollapsibleSection title="Attached Documents">
        <AttachmentsGrid recordId={recordId} readOnly={readOnly} onBusyChange={onAttachmentsBusyChange} />
      </CollapsibleSection>
    </div>
  );
};
