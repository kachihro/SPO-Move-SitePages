import * as React from "react";
import { Button, MessageBar, MessageBarBody, Spinner } from "@fluentui/react-components";
import { useDataverseClient } from "../../services/DataverseClientContext";
import { ApplicationStatus, BuildingApprovalFormData, emptyFormData } from "../../types/BuildingApproval";
import { WizardStepper } from "./WizardStepper";
import { StepApplicantAndActivity } from "./steps/StepApplicantAndActivity";
import { StepFeeAndChecklist } from "./steps/StepFeeAndChecklist";
import { StepReview } from "./steps/StepReview";

export type WizardMode = "new" | "edit" | "view";

export interface ApprovalWizardProps {
  mode: WizardMode;
  recordId: string | null;
  contactId: string;
  onCancel: () => void;
  onSaved: () => void;
}

const STEP_LABELS = ["Step 1", "Step 2", "Step 3"];

export const ApprovalWizard: React.FC<ApprovalWizardProps> = ({ mode, recordId: initialRecordId, contactId, onCancel, onSaved }) => {
  const client = useDataverseClient();
  const readOnly = mode === "view";

  const [recordId, setRecordId] = React.useState<string | null>(initialRecordId);
  const [baNumber, setBaNumber] = React.useState<string | undefined>(undefined);
  const [formData, setFormData] = React.useState<BuildingApprovalFormData>(emptyFormData());
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(mode !== "new");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (mode === "new" || !initialRecordId) return;
    setLoading(true);
    void client
      .retrieve(initialRecordId)
      .then((record) => {
        setFormData(record);
        setBaNumber(record.baNumber);
        return undefined;
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [client, initialRecordId, mode]);

  /**
   * Save-once-then-always-update: this is the fix for the known "duplicate draft" / "record recreated
   * on next page" bugs in the current native multistep form. `recordId` is tracked explicitly in
   * component state and is the single source of truth for whether this is a create or an update — never
   * re-derive it from the step or re-create on every save.
   */
  const persist = async (status?: ApplicationStatus): Promise<string> => {
    const payload = status !== undefined ? { ...formData, status } : formData;
    if (recordId) {
      await client.update(recordId, payload);
      return recordId;
    }
    const newId = await client.create({ ...payload, status: status ?? ApplicationStatus.Draft });
    setRecordId(newId);
    return newId;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await persist();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await persist();
      setStep((s) => Math.min(s + 1, STEP_LABELS.length));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await persist(ApplicationStatus.Submitted);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner label="Loading application..." />;
  }

  return (
    <div>
      <p>
        <b>Tip:</b> Use <i>Next</i> to continue. Use <i>Save Draft</i> to save progress and leave. Use{" "}
        <i>Cancel</i> to leave without saving this step. On the last step, use <i>Submit</i> to send your
        application.
      </p>

      <WizardStepper current={step} labels={STEP_LABELS} onSelect={setStep} />

      {error && (
        <MessageBar intent="error" style={{ margin: "12px 0" }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div style={{ background: "white", padding: "24px", marginTop: "12px" }}>
        {step === 1 && <StepApplicantAndActivity formData={formData} onChange={setFormData} readOnly={readOnly} />}
        {step === 2 && <StepFeeAndChecklist formData={formData} onChange={setFormData} readOnly={readOnly} />}
        {step === 3 && <StepReview baNumber={baNumber} />}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
          <Button appearance="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <div style={{ display: "flex", gap: "8px" }}>
            {step > 1 && (
              <Button appearance="secondary" onClick={handlePrev} disabled={saving}>
                Prev
              </Button>
            )}
            {!readOnly && (
              <Button appearance="secondary" onClick={() => void handleSaveDraft()} disabled={saving}>
                Save Draft
              </Button>
            )}
            {!readOnly && step < STEP_LABELS.length && (
              <Button appearance="primary" onClick={() => void handleNext()} disabled={saving}>
                Next
              </Button>
            )}
            {!readOnly && step === STEP_LABELS.length && (
              <Button appearance="primary" onClick={() => void handleSubmit()} disabled={saving}>
                Submit
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
