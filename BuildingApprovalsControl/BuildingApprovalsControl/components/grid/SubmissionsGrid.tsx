import * as React from "react";
import {
  Badge,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  MessageBar,
  MessageBarBody,
  Spinner,
  TableCellLayout,
  TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useDataverseClient } from "../../services/DataverseClientContext";
import { ApplicationStatus, BuildingApprovalRecord } from "../../types/BuildingApproval";

export interface SubmissionsGridProps {
  contactId: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  /** bumped by the parent after returning from the wizard, to force a refetch */
  refreshToken: number;
}

const statusLabel: Record<ApplicationStatus, string> = {
  [ApplicationStatus.Draft]: "Draft",
  [ApplicationStatus.Submitted]: "Submitted",
  [ApplicationStatus.Processing]: "Processing",
  [ApplicationStatus.Approved]: "Approved",
  [ApplicationStatus.Denied]: "Denied",
};

const statusColor: Record<ApplicationStatus, "subtle" | "informative" | "warning" | "success" | "danger"> = {
  [ApplicationStatus.Draft]: "subtle",
  [ApplicationStatus.Submitted]: "informative",
  [ApplicationStatus.Processing]: "warning",
  [ApplicationStatus.Approved]: "success",
  [ApplicationStatus.Denied]: "danger",
};

export const SubmissionsGrid: React.FC<SubmissionsGridProps> = ({ contactId, onCreate, onEdit, onView, refreshToken }) => {
  const client = useDataverseClient();
  const [records, setRecords] = React.useState<BuildingApprovalRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | undefined>(undefined);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(undefined);
    void client
      .retrieveMultiple(contactId)
      .then(setRecords)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [client, contactId]);

  React.useEffect(() => {
    load();
  }, [load, refreshToken]);

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await client.deleteRecord(pendingDeleteId);
      setPendingDeleteId(undefined);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumnDefinition<BuildingApprovalRecord>[] = [
    createTableColumn<BuildingApprovalRecord>({
      columnId: "baNumber",
      renderHeaderCell: () => "BA Number",
      renderCell: (item) => (
        <TableCellLayout>
          <Button appearance="transparent" onClick={() => onView(item.id)}>
            {item.baNumber ?? "(unassigned)"}
          </Button>
        </TableCellLayout>
      ),
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "contactPerson",
      renderHeaderCell: () => "Contact Person",
      renderCell: (item) => item.applicant.contactPerson ?? "",
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "email",
      renderHeaderCell: () => "Email",
      renderCell: (item) => item.applicant.email ?? "",
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "requestDate",
      renderHeaderCell: () => "Request Date",
      renderCell: (item) => (item.requestDate ? new Date(item.requestDate).toLocaleDateString() : ""),
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (item) => <Badge color={statusColor[item.status]}>{statusLabel[item.status] ?? "Unknown"}</Badge>,
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (item) => {
        const isDraft = item.status === ApplicationStatus.Draft;
        return (
          <TableCellLayout>
            {isDraft ? (
              <>
                <Button appearance="subtle" onClick={() => onEdit(item.id)}>
                  Edit
                </Button>
                <Button appearance="subtle" onClick={() => setPendingDeleteId(item.id)}>
                  Delete
                </Button>
              </>
            ) : (
              <Button appearance="subtle" onClick={() => onView(item.id)}>
                View
              </Button>
            )}
          </TableCellLayout>
        );
      },
    }),
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: tokens.spacingVerticalM }}>
        <Button appearance="primary" onClick={onCreate}>
          Create
        </Button>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {loading ? (
        <Spinner label="Loading submissions..." />
      ) : (
        <DataGrid items={records} columns={columns} getRowId={(item: BuildingApprovalRecord) => item.id} sortable>
          <DataGridHeader>
            <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
          </DataGridHeader>
          <DataGridBody<BuildingApprovalRecord>>
            {({ item, rowId }) => (
              <DataGridRow<BuildingApprovalRecord> key={rowId}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}

      <Dialog open={!!pendingDeleteId} onOpenChange={(_, data) => !data.open && setPendingDeleteId(undefined)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete draft application?</DialogTitle>
            <DialogContent>This cannot be undone.</DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary" disabled={deleting} onClick={() => void confirmDelete()}>
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
