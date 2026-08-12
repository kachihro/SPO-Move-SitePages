import * as React from "react";
import { Field, Input, Textarea } from "@fluentui/react-components";
import { BuildingApprovalFormData } from "../../../types/BuildingApproval";
import { useStepStyles } from "./stepStyles";

export interface StepProps {
  formData: BuildingApprovalFormData;
  onChange: (data: BuildingApprovalFormData) => void;
  readOnly: boolean;
}

const TELEPHONE_PLACEHOLDER = "Provide a telephone number";

export const StepApplicantAndActivity: React.FC<StepProps> = ({ formData, onChange, readOnly }) => {
  const styles = useStepStyles();

  const set = (path: (data: BuildingApprovalFormData) => void) => {
    const next = JSON.parse(JSON.stringify(formData)) as BuildingApprovalFormData;
    path(next);
    onChange(next);
  };

  return (
    <div className={styles.grid}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Applicant Details</h3>
        <div className={styles.fieldStack}>
          <Field label="Name">
            <Input
              className={styles.input}
              value={formData.applicant.name ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.name = d.value))}
            />
          </Field>
          <Field label="Postal Address">
            <Input
              className={styles.input}
              value={formData.applicant.postalAddress ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.postalAddress = d.value))}
            />
          </Field>
          <Field label="Contact Person">
            <Input
              className={styles.input}
              value={formData.applicant.contactPerson ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.contactPerson = d.value))}
            />
          </Field>
          <Field label="Email">
            <Input
              className={styles.input}
              value={formData.applicant.email ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.email = d.value))}
            />
          </Field>
          <Field label="Telephone">
            <Input
              className={styles.input}
              value={formData.applicant.telephone ?? ""}
              placeholder={TELEPHONE_PLACEHOLDER}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.telephone = d.value))}
            />
          </Field>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Lessee Details (If Not Applicant)</h3>
        <div className={styles.fieldStack}>
          <Field label="Name">
            <Input
              className={styles.input}
              value={formData.owner.name ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.name = d.value))}
            />
          </Field>
          <Field label="Postal Address">
            <Input
              className={styles.input}
              value={formData.owner.postalAddress ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.postalAddress = d.value))}
            />
          </Field>
          <Field label="Contact Person">
            <Input
              className={styles.input}
              value={formData.owner.contactPerson ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.contactPerson = d.value))}
            />
          </Field>
          <Field label="Email">
            <Input
              className={styles.input}
              value={formData.owner.email ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.email = d.value))}
            />
          </Field>
          <Field label="Telephone">
            <Input
              className={styles.input}
              value={formData.owner.telephone ?? ""}
              placeholder={TELEPHONE_PLACEHOLDER}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.telephone = d.value))}
            />
          </Field>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Building Activity</h3>
        <div className={styles.fieldStack}>
          <Field label="Location of Works">
            <Input
              className={styles.input}
              value={formData.locationOfWorks ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.locationOfWorks = d.value))}
            />
          </Field>
          <Field label="Description of Works">
            <Textarea
              className={styles.textarea}
              value={formData.descriptionOfWorks ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.descriptionOfWorks = d.value))}
            />
          </Field>
          <Field label="Purpose of Works">
            <Input
              className={styles.input}
              value={formData.purposeOfWorks ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.purposeOfWorks = d.value))}
            />
          </Field>
          <Field label="Estimated Start Date">
            <Input
              className={styles.input}
              type="date"
              value={formData.estimatedStartDate ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.estimatedStartDate = d.value))}
            />
          </Field>
          <Field label="Estimated Completion Date">
            <Input
              className={styles.input}
              type="date"
              value={formData.estimatedCompletionDate ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.estimatedCompletionDate = d.value))}
            />
          </Field>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Building Contractor</h3>
        <div className={styles.fieldStack}>
          <Field label="Building Contractor Name">
            <Input
              className={styles.input}
              value={formData.buildingContractor.name ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.buildingContractor.name = d.value))}
            />
          </Field>
          <Field label="Postal Address">
            <Input
              className={styles.input}
              value={formData.buildingContractor.postalAddress ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.buildingContractor.postalAddress = d.value))}
            />
          </Field>
          <Field label="Contact Person">
            <Input
              className={styles.input}
              value={formData.buildingContractor.contactPerson ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.buildingContractor.contactPerson = d.value))}
            />
          </Field>
          <Field label="Email">
            <Input
              className={styles.input}
              value={formData.buildingContractor.email ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.buildingContractor.email = d.value))}
            />
          </Field>
          <Field label="Telephone">
            <Input
              className={styles.input}
              value={formData.buildingContractor.telephone ?? ""}
              placeholder={TELEPHONE_PLACEHOLDER}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.buildingContractor.telephone = d.value))}
            />
          </Field>
        </div>
      </section>
    </div>
  );
};
