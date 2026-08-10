import * as React from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { DataverseClient } from "../services/DataverseClient";
import { DataverseClientContext } from "../services/DataverseClientContext";
import { SubmissionsGrid } from "./grid/SubmissionsGrid";
import { ApprovalWizard, WizardMode } from "./wizard/ApprovalWizard";

export interface BuildingApprovalsAppProps {
  client: DataverseClient;
  contactId: string;
}

type View = { name: "grid" } | { name: "wizard"; mode: WizardMode; recordId: string | null };

export const BuildingApprovalsApp: React.FC<BuildingApprovalsAppProps> = ({ client, contactId }) => {
  const [view, setView] = React.useState<View>({ name: "grid" });
  const [refreshToken, setRefreshToken] = React.useState(0);

  const returnToGrid = () => {
    setRefreshToken((t) => t + 1);
    setView({ name: "grid" });
  };

  return (
    <FluentProvider theme={webLightTheme} style={{ background: "transparent" }}>
      <DataverseClientContext.Provider value={client}>
        {view.name === "grid" && (
          <SubmissionsGrid
            contactId={contactId}
            refreshToken={refreshToken}
            onCreate={() => setView({ name: "wizard", mode: "new", recordId: null })}
            onEdit={(id) => setView({ name: "wizard", mode: "edit", recordId: id })}
            onView={(id) => setView({ name: "wizard", mode: "view", recordId: id })}
          />
        )}
        {view.name === "wizard" && (
          <ApprovalWizard
            mode={view.mode}
            recordId={view.recordId}
            contactId={contactId}
            onCancel={returnToGrid}
            onSaved={returnToGrid}
          />
        )}
      </DataverseClientContext.Provider>
    </FluentProvider>
  );
};
