import * as React from "react";
import { Card, CardHeader, Field, Input } from "@fluentui/react-components";
import { BuildingApprovalFormData } from "../../../types/BuildingApproval";

export interface StepProps {
  formData: BuildingApprovalFormData;
  onChange: (data: BuildingApprovalFormData) => void;
  readOnly: boolean;
}

const twoColumn: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };

export const StepApplicantAndActivity: React.FC<StepProps> = ({ formData, onChange, readOnly }) => {
  const set = (path: (data: BuildingApprovalFormData) => void) => {
    const next = JSON.parse(JSON.stringify(formData)) as BuildingApprovalFormData;
    path(next);
    onChange(next);
  };

  return (
    <div>
      <div style={twoColumn}>
        <Card>
          <CardHeader header={<b>Applicant Details</b>} />
          <Field label="Name">
            <Input
              value={formData.applicant.name ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.name = d.value))}
            />
          </Field>
          <Field label="Postal Address">
            <Input
              value={formData.applicant.postalAddress ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.postalAddress = d.value))}
            />
          </Field>
          <Field label="Contact Person">
            <Input
              value={formData.applicant.contactPerson ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.contactPerson = d.value))}
            />
          </Field>
          <Field label="Email">
            <Input
              value={formData.applicant.email ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.email = d.value))}
            />
          </Field>
          <Field label="Telephone">
            <Input
              value={formData.applicant.telephone ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.applicant.telephone = d.value))}
            />
          </Field>
        </Card>

        <Card>
          <CardHeader header={<b>Lessee Details (If Not Applicant)</b>} />
          <Field label="Name">
            <Input
              value={formData.owner.name ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.name = d.value))}
            />
          </Field>
          <Field label="Postal Address">
            <Input
              value={formData.owner.postalAddress ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.postalAddress = d.value))}
            />
          </Field>
          <Field label="Contact Person">
            <Input
              value={formData.owner.contactPerson ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.contactPerson = d.value))}
            />
          </Field>
          <Field label="Email">
            <Input
              value={formData.owner.email ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.email = d.value))}
            />
          </Field>
          <Field label="Telephone">
            <Input
              value={formData.owner.telephone ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.owner.telephone = d.value))}
            />
          </Field>
        </Card>
      </div>

      <div style={{ ...twoColumn, marginTop: "16px" }}>
        <Card>
          <CardHeader header={<b>Building Activity</b>} />
          <Field label="Location of Works">
            <Input
              value={formData.locationOfWorks ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.locationOfWorks = d.value))}
            />
          </Field>
        </Card>

        <Card>
          <CardHeader header={<b>Building Contractor</b>} />
          <Field label="Building Contractor Name">
            <Input
              value={formData.buildingContractor.name ?? ""}
              disabled={readOnly}
              onChange={(_, d) => set((f) => (f.buildingContractor.name = d.value))}
            />
          </Field>
        </Card>
      </div>
    </div>
  );
};
