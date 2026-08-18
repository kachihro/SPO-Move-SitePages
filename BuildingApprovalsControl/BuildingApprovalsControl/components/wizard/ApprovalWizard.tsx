import * as React from "react";
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";
import { generateBaNumber } from "../../services/baNumber";
import { useDataverseClient } from "../../services/DataverseClientContext";
import { getErrorMessage } from "../../services/errors";
import {
  MISSING_CONTACT_ID_MESSAGE,
  resolvePortalContactId,
  resolvePortalContactName,
} from "../../services/portalContactId";
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
    maxWidth: "1288px",
    marginLeft: "auto",
    marginRight: "auto",
    padding: "12px 24px 48px",
    backgroundColor: "#F5F5F2",
    color: "#1B1B29",
  },
  pageHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
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
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#66247F",
  },
  title: {
    margin: 0,
    fontSize: "44px",
    fontWeight: 700,
    color: "#1B1B29",
    lineHeight: 1.12,
    letterSpacing: "-0.01em",
  },
  blurb: {
    margin: 0,
    marginTop: "4px",
    fontSize: "16px",
    color: "#5C5E6B",
    lineHeight: 1.55,
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
  footerBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginTop: "28px",
    paddingTop: "8px",
  },
  confirmBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px 20px",
    borderRadius: "16px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E2DA",
    boxShadow: "0 4px 18px rgba(40, 30, 20, 0.06)",
  },
  confirmLabel: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "#1B1B1B",
    lineHeight: 1.45,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerActions: {
    display: "flex",
    gap: "10px",
  },
  allSteps: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
});

export type WizardMode = "new" | "edit" | "view";

/** Which footer action is currently running — only that button shows a spinner. */
type BusyAction = "next" | "prev" | "step" | "draft" | "submit";

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
  const [busyAction, setBusyAction] = React.useState<BusyAction | undefined>(undefined);
  const [draftSavedOpen, setDraftSavedOpen] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  /** Documents are uploaded straight to Dataverse — don't let the footer unmount mid-POST. */
  const [attachmentsBusy, setAttachmentsBusy] = React.useState(false);
  const [contactName, setContactName] = React.useState(() => resolvePortalContactName());
  const confirmed = !!formData.confirmed;

  // Re-resolve when reaching step 3 — header / Liquid may not be ready on first paint.
  React.useEffect(() => {
    if (readOnly || step !== STEP_LABELS.length) return;
    setContactName(resolvePortalContactName());
  }, [readOnly, step]);


  React.useEffect(() => {
    if (mode === "new") return;

    const id = (initialRecordId ?? "").replace(/[{}]/g, "").trim();
    if (!id) {
      setError("Missing application id — cannot load this draft.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    void client
      .retrieve(id)
      .then((record) => {
        if (cancelled) return undefined;
        const blank = emptyFormData();
        setFormData({
          ...blank,
          ...record,
          applicant: { ...blank.applicant, ...record.applicant },
          owner: { ...blank.owner, ...record.owner },
          buildingContractor: { ...blank.buildingContractor, ...record.buildingContractor },
          worksComplyWith: { ...blank.worksComplyWith, ...record.worksComplyWith },
          checklist: {
            electrical: { ...blank.checklist.electrical, ...record.checklist?.electrical },
            hydraulics: {
              domesticWater: {
                ...blank.checklist.hydraulics.domesticWater,
                ...record.checklist?.hydraulics?.domesticWater,
              },
              recycledWater: {
                ...blank.checklist.hydraulics.recycledWater,
                ...record.checklist?.hydraulics?.recycledWater,
              },
              sewerage: { ...blank.checklist.hydraulics.sewerage, ...record.checklist?.hydraulics?.sewerage },
              fireWater: { ...blank.checklist.hydraulics.fireWater, ...record.checklist?.hydraulics?.fireWater },
              backflowPreventionConfirmed: record.checklist?.hydraulics?.backflowPreventionConfirmed,
            },
            security: { ...blank.checklist.security, ...record.checklist?.security },
          },
        });
        setBaNumber(record.baNumber);
        setRecordId(record.id || id);
        return undefined;
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, initialRecordId, mode]);

  /**
   * Save-once-then-always-update: this is the fix for the known "duplicate draft" / "record recreated
   * on next page" bugs in the current native multistep form. `recordId` is tracked explicitly in
   * component state and is the single source of truth for whether this is a create or an update — never
   * re-derive it from the step or re-create on every save.
   */
  const persist = async (status?: ApplicationStatus, baNumberOverride?: string): Promise<string> => {
    const payload =
      status !== undefined
        ? { ...formData, status, ...(baNumberOverride ? { baNumber: baNumberOverride } : {}) }
        : formData;
    // Re-read from the page at save time — resourceOverride / early updateView can leave the prop empty
    // even when #aal-portal-contact-id already has the signed-in contact GUID.
    const portalUserId = resolvePortalContactId(contactId);
    if (recordId) {
      // Always re-bind Portal User on update so rows created before the Power Pages lookup fix get tagged.
      await client.update(recordId, {
        ...payload,
        ...(portalUserId ? { portalUserId } : {}),
      });
      return recordId;
    }
    if (!portalUserId) {
      throw new Error(MISSING_CONTACT_ID_MESSAGE);
    }
    const newId = await client.create({
      ...payload,
      status: status ?? ApplicationStatus.Draft,
      portalUserId,
      requestDate: todayDateOnly(),
    });
    setRecordId(newId);
    return newId;
  };

  const handleSaveDraft = async () => {
    setBusyAction("draft");
    setError(undefined);
    try {
      await persist();
      // Hold the wizard open behind the confirmation — leaving happens when it is dismissed.
      setDraftSavedOpen(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusyAction(undefined);
    }
  };

  const handleNext = async () => {
    setBusyAction("next");
    setError(undefined);
    try {
      await persist();
      setStep((s) => Math.min(s + 1, STEP_LABELS.length));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyAction(undefined);
    }
  };

  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  /**
   * Jumping forward via the stepper must save first, exactly like Next — otherwise a brand-new
   * application can land on step 3 with no `recordId`, and step 3's attachments have nothing to
   * attach to. Jumping backwards is free.
   */
  const handleStepSelect = async (target: number) => {
    if (target <= step) {
      setStep(target);
      return;
    }
    setBusyAction("step");
    setError(undefined);
    try {
      await persist();
      setStep(target);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyAction(undefined);
    }
  };

  const handleSubmit = async () => {
    if (!formData.confirmed) {
      setError("Please confirm that this form has been completed to the best of your knowledge before submitting.");
      return;
    }
    setBusyAction("submit");
    setError(undefined);
    try {
      // Existing draft: assign BA in the same update as status. Brand-new submit: create first,
      // then PATCH BA.
      const existingBa = baNumber?.trim();
      if (recordId && !existingBa) {
        const generated = generateBaNumber();
        await persist(ApplicationStatus.Submitted, generated);
        setBaNumber(generated);
      } else if (recordId) {
        await persist(ApplicationStatus.Submitted);
      } else {
        const newId = await persist(ApplicationStatus.Submitted);
        if (!existingBa) {
          const generated = generateBaNumber();
          const portalUserId = resolvePortalContactId(contactId);
          await client.update(newId, {
            baNumber: generated,
            ...(portalUserId ? { portalUserId } : {}),
          });
          setBaNumber(generated);
        }
      }
      onSaved({ draft: false });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusyAction(undefined);
    }
  };

  if (loading) {
    return (
      <div className={mergeClasses(styles.root, "aal-ba-shell")}>
        <Spinner label="Loading application..." />
      </div>
    );
  }

  // Uploads write straight to Dataverse, so leaving the wizard mid-upload would drop an in-flight POST.
  const busy = busyAction !== undefined || attachmentsBusy || draftSavedOpen;

  const title =
    mode === "new" ? "New application" : mode === "view" ? "View application" : "Continue your application";
  const blurb =
    mode === "new"
      ? "Complete the steps below. Your draft is saved against this submission — finish the remaining steps when you are ready."
      : mode === "view"
        ? "Review the details of this submission below."
        : "Pick up where you left off. Your draft is saved against this submission — finish the remaining steps when you are ready.";

  return (
    <div className={mergeClasses(styles.root, "aal-ba-shell")}>
      <div className={styles.pageHeader}>
        <Link className={styles.breadcrumb} onClick={onCancel}>
          ← All Submissions
        </Link>
        <p className={styles.eyebrow}>Building Approvals</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.blurb}>{blurb}</p>
        {!readOnly && (
          <p className={styles.tip}>
            Tip: Use <span className={styles.tipStrong}>Next</span> to continue. Use{" "}
            <span className={styles.tipStrong}>Save Draft</span> to save progress and leave. Use{" "}
            <span className={styles.tipStrong}>Cancel</span> to leave without saving this step. On the last step, use{" "}
            <span className={styles.tipStrong}>Submit</span> to send your application.
          </p>
        )}
      </div>

      {!readOnly && (
        <WizardStepper
          current={step}
          labels={STEP_LABELS}
          onSelect={(target) => void handleStepSelect(target)}
        />
      )}

      {error && (
        <MessageBar intent="error" style={{ margin: "12px 0" }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {readOnly ? (
        <div className={styles.allSteps}>
          <StepApplicantAndActivity formData={formData} onChange={setFormData} readOnly />
          <StepFeeAndChecklist formData={formData} onChange={setFormData} readOnly />
          <StepReview formData={formData} onChange={setFormData} readOnly recordId={recordId} />
        </div>
      ) : (
        <>
          {step === 1 && <StepApplicantAndActivity formData={formData} onChange={setFormData} readOnly={false} />}
          {step === 2 && <StepFeeAndChecklist formData={formData} onChange={setFormData} readOnly={false} />}
          {step === 3 && (
            <StepReview
              formData={formData}
              onChange={setFormData}
              readOnly={false}
              recordId={recordId}
              onAttachmentsBusyChange={setAttachmentsBusy}
            />
          )}
        </>
      )}

      <div className={styles.footerBlock}>
        {!readOnly && step === STEP_LABELS.length && (
          <div className={styles.confirmBlock}>
            <p className={styles.confirmLabel}>
              I confirm that this form has been completed to the best of my knowledge
            </p>
            <Checkbox
              label={`I, ${contactName}, confirm in the capacity of owner or agent that this information above is correct.`}
              checked={confirmed}
              onChange={(_, d) => setFormData((prev) => ({ ...prev, confirmed: !!d.checked }))}
            />
          </div>
        )}
        <div className={styles.footer}>
          <HeroButton onClick={onCancel} disabled={busy}>
            {readOnly ? "Back" : "Cancel"}
          </HeroButton>
          {!readOnly && (
            <div className={styles.footerActions}>
              {step > 1 && (
                <HeroButton onClick={handlePrev} disabled={busy}>
                  Prev
                </HeroButton>
              )}
              {step < STEP_LABELS.length && (
                <HeroButton onClick={() => void handleNext()} disabled={busy} loading={busyAction === "next"}>
                  {busyAction === "next" ? "Saving..." : "Next"}
                </HeroButton>
              )}
              {step === STEP_LABELS.length && (
                <HeroButton
                  onClick={() => void handleSubmit()}
                  disabled={busy || !confirmed}
                  loading={busyAction === "submit"}
                >
                  {busyAction === "submit" ? "Submitting..." : "Submit"}
                </HeroButton>
              )}
              <HeroButton onClick={() => void handleSaveDraft()} disabled={busy} loading={busyAction === "draft"}>
                {busyAction === "draft" ? "Saving..." : "Save Draft"}
              </HeroButton>
            </div>
          )}
        </div>
      </div>

      <Dialog open={draftSavedOpen} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Draft Saved</DialogTitle>
            <DialogContent>
              Your application has been saved as a draft. You can continue it anytime from the submissions list.
            </DialogContent>
            <DialogActions>
              <HeroButton
                onClick={() => {
                  setDraftSavedOpen(false);
                  onSaved({ draft: true });
                }}
              >
                OK
              </HeroButton>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
