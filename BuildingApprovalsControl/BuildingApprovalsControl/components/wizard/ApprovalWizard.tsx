import * as React from "react";
import { Link, makeStyles, MessageBar, MessageBarBody, Spinner, tokens } from "@fluentui/react-components";
import { useDataverseClient } from "../../services/DataverseClientContext";
import { getErrorMessage } from "../../services/errors";
import { ApplicationStatus, BuildingApprovalFormData, emptyFormData } from "../../types/BuildingApproval";
import { HeroButton } from "../HeroButton";
import { WizardStepper } from "./WizardStepper";
import { StepApplicantAndActivity } from "./steps/StepApplicantAndActivity";
import { StepFeeAndChecklist } from "./steps/StepFeeAndChecklist";
import { StepReview } from "./steps/StepReview";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1100px",
    marginLeft: "auto",
    marginRight: "auto",
    padding: "40px 48px 48px",
    borderRadius: "20px",
    backgroundColor: "#FBF8F4",
    boxShadow: "0 8px 28px rgba(40, 30, 20, 0.08)",
    border: "1px solid rgba(40, 30, 20, 0.06)",
  },
  pageHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "20px",
  },
  breadcrumb: {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#9B2D6A",
    width: "fit-content",
    cursor: "pointer",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#8A8178",
  },
  title: {
    margin: 0,
    fontSize: "40px",
    fontWeight: 700,
    color: "#1B1B1B",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
  },
  blurb: {
    margin: 0,
    marginTop: "4px",
    fontSize: "16px",
    color: "#6B6560",
    lineHeight: 1.5,
    maxWidth: "720px",
  },
  tip: {
    margin: "8px 0 0",
    fontSize: "13px",
    fontStyle: "italic",
    color: "#9B2D6A",
    maxWidth: "820px",
    lineHeight: 1.45,
  },
  tipStrong: {
    fontWeight: 600,
    fontStyle: "normal",
  },
  formPanel: {
    marginTop: "4px",
    padding: "28px 32px",
    borderRadius: "16px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E2DA",
    boxShadow: "0 4px 18px rgba(40, 30, 20, 0.06)",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "28px",
    paddingTop: "8px",
  },
  footerActions: {
    display: "flex",
    gap: "10px",
  },
});

export type WizardMode = "new" | "edit" | "view";

export interface ApprovalWizardProps {
  mode: WizardMode;
  recordId: string | null;
  contactId: string;
  onCancel: () => void;
  onSaved: (result?: { draft?: boolean }) => void;
}

const STEP_LABELS = ["Step 1", "Step 2", "Step 3"];

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ApprovalWizard: React.FC<ApprovalWizardProps> = ({ mode, recordId: initialRecordId, contactId, onCancel, onSaved }) => {
  const styles = useStyles();
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
      .catch((err: unknown) => setError(getErrorMessage(err)))
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
    const newId = await client.create({
      ...payload,
      status: status ?? ApplicationStatus.Draft,
      portalUserId: contactId,
      requestDate: todayDateOnly(),
    });
    setRecordId(newId);
    return newId;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await persist();
      onSaved({ draft: true });
    } catch (err) {
      setError(getErrorMessage(err));
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
      setError(getErrorMessage(err));
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
      onSaved({ draft: false });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.root}>
        <Spinner label="Loading application..." />
      </div>
    );
  }

  const title = mode === "new" ? "New application" : "Continue your application";
  const blurb =
    mode === "new"
      ? "Complete the steps below. Your draft is saved against this submission — finish the remaining steps when you are ready."
      : "Pick up where you left off. Your draft is saved against this submission — finish the remaining steps when you are ready.";

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <Link className={styles.breadcrumb} onClick={onCancel}>
          ← All Submissions
        </Link>
        <p className={styles.eyebrow}>Building Approvals</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.blurb}>{blurb}</p>
        <p className={styles.tip}>
          Tip: Use <span className={styles.tipStrong}>Next</span> to continue. Use{" "}
          <span className={styles.tipStrong}>Save Draft</span> to save progress and leave. Use{" "}
          <span className={styles.tipStrong}>Cancel</span> to leave without saving this step. On the last step, use{" "}
          <span className={styles.tipStrong}>Submit</span> to send your application.
        </p>
      </div>

      <WizardStepper current={step} labels={STEP_LABELS} onSelect={setStep} />

      {error && (
        <MessageBar intent="error" style={{ margin: "12px 0" }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.formPanel}>
        {step === 1 && <StepApplicantAndActivity formData={formData} onChange={setFormData} readOnly={readOnly} />}
        {step === 2 && <StepFeeAndChecklist formData={formData} onChange={setFormData} readOnly={readOnly} />}
        {step === 3 && <StepReview baNumber={baNumber} />}
      </div>

      <div className={styles.footer}>
        <HeroButton onClick={onCancel} disabled={saving}>
          Cancel
        </HeroButton>
        <div className={styles.footerActions}>
          {step > 1 && (
            <HeroButton onClick={handlePrev} disabled={saving}>
              Prev
            </HeroButton>
          )}
          {!readOnly && step < STEP_LABELS.length && (
            <HeroButton onClick={() => void handleNext()} disabled={saving}>
              Next
            </HeroButton>
          )}
          {!readOnly && step === STEP_LABELS.length && (
            <HeroButton onClick={() => void handleSubmit()} disabled={saving}>
              Submit
            </HeroButton>
          )}
          {!readOnly && (
            <HeroButton onClick={() => void handleSaveDraft()} disabled={saving}>
              Save Draft
            </HeroButton>
          )}
        </div>
      </div>
    </div>
  );
};
