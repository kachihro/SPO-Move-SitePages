import * as React from "react";
import {
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  mergeClasses,
  Spinner,
  TableCellLayout,
  TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useDataverseClient } from "../../services/DataverseClientContext";
import { getErrorMessage } from "../../services/errors";
import { normalizeGuid } from "../../services/mapping";
import { MISSING_CONTACT_ID_MESSAGE } from "../../services/portalContactId";
import { ApplicationStatus, BuildingApprovalRecord } from "../../types/BuildingApproval";
import { HeroButton } from "../HeroButton";

const useStyles = makeStyles({
  /** Paper panel — width follows the portal host (widened to 1600px). */
  root: {
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1600px",
    marginLeft: "auto",
    marginRight: "auto",
    padding: "12px 24px 48px",
    backgroundColor: "#F5F5F2",
    color: "#1B1B29",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "28px",
    maxWidth: "720px",
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
  lede: {
    margin: 0,
    maxWidth: "560px",
    fontSize: "16px",
    fontWeight: 400,
    color: "#5C5E6B",
    lineHeight: 1.55,
  },
  toast: {
    marginBottom: "16px",
    padding: "12px 16px",
    borderRadius: "10px",
    backgroundColor: "#F7E8F0",
    color: "#1B1B1B",
    fontSize: "14px",
  },
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "20px",
    minHeight: "44px",
  },
  shell: {
    border: "1px solid #E2E1DC",
    borderRadius: "18px",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 1px 2px rgba(27, 27, 41, 0.04), 0 8px 24px rgba(27, 27, 41, 0.06)",
  },
  headerRow: {
    backgroundColor: "#EFEFEB",
  },
  headerCell: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#8A8C97",
  },
  row: {
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
    ":hover": {
      backgroundColor: "#F8F5F1",
    },
  },
  rowAlt: {
    backgroundColor: "#FAF7F3",
    cursor: "pointer",
    ":hover": {
      backgroundColor: "#F3EFE9",
    },
  },
  baLink: {
    fontWeight: 600,
    color: "#9B2D6A",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    cursor: "pointer",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "3px 10px",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "16px",
  },
  statusMuted: {
    backgroundColor: "#ECE9E4",
    color: "#5C574F",
  },
  statusSubmitted: {
    backgroundColor: "#F8E2C8",
    color: "#9A5410",
  },
  statusProcessing: {
    backgroundColor: "#F7E8F0",
    color: "#9B2D6A",
  },
  statusApproved: {
    backgroundColor: "#DFF6DD",
    color: "#0B6A0B",
  },
  statusDenied: {
    backgroundColor: "#FDE7E9",
    color: "#A4262C",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    padding: "64px 24px",
    color: "#6B6560",
  },
  /** Keeps the record GUID on each row (like legacy data-id) without showing it. */
  hiddenKey: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
});

export interface SubmissionsGridProps {
  contactId: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  /** bumped by the parent after returning from the wizard, to force a refetch */
  refreshToken: number;
  /** show the "Draft saved" toast when returning from Save Draft */
  draftSaved?: boolean;
  onDraftToastShown?: () => void;
}

const statusLabel: Record<ApplicationStatus, string> = {
  [ApplicationStatus.Draft]: "Draft",
  [ApplicationStatus.Submitted]: "Submitted",
  [ApplicationStatus.Processing]: "Processing",
  [ApplicationStatus.Approved]: "Approved",
  [ApplicationStatus.Denied]: "Denied",
};

export const SubmissionsGrid: React.FC<SubmissionsGridProps> = ({
  contactId,
  onCreate,
  onEdit,
  onView,
  refreshToken,
  draftSaved = false,
  onDraftToastShown,
}) => {
  const styles = useStyles();
  const client = useDataverseClient();
  const [records, setRecords] = React.useState<BuildingApprovalRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [showToast, setShowToast] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(undefined);
    if (!contactId) {
      setRecords([]);
      setError(MISSING_CONTACT_ID_MESSAGE);
      setLoading(false);
      return;
    }
    void client
      .retrieveMultiple(contactId)
      .then(setRecords)
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [client, contactId]);

  React.useEffect(() => {
    load();
  }, [load, refreshToken]);

  React.useEffect(() => {
    if (!draftSaved) return;
    setShowToast(true);
    onDraftToastShown?.();
    const timer = window.setTimeout(() => setShowToast(false), 5000);
    return () => window.clearTimeout(timer);
  }, [draftSaved, onDraftToastShown]);

  /** Open by the row GUID — required when several drafts all display as "Draft". */
  const openByGuid = (guid: string, status: ApplicationStatus) => {
    const id = normalizeGuid(guid);
    if (!id) return;
    if (status === ApplicationStatus.Draft) {
      onEdit(id);
    } else {
      onView(id);
    }
  };

  const statusClass = (status: ApplicationStatus): string => {
    switch (status) {
      case ApplicationStatus.Submitted:
        return styles.statusSubmitted;
      case ApplicationStatus.Processing:
        return styles.statusProcessing;
      case ApplicationStatus.Approved:
        return styles.statusApproved;
      case ApplicationStatus.Denied:
        return styles.statusDenied;
      default:
        return styles.statusMuted;
    }
  };

  const columns: TableColumnDefinition<BuildingApprovalRecord>[] = [
    createTableColumn<BuildingApprovalRecord>({
      columnId: "baNumber",
      renderHeaderCell: () => "BA Number",
      renderCell: (item) => (
        <TableCellLayout>
          <input
            type="hidden"
            className={styles.hiddenKey}
            name="aal-ba-record-id"
            value={normalizeGuid(item.id)}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            data-id={normalizeGuid(item.id)}
          />
          <Link
            className={styles.baLink}
            data-id={normalizeGuid(item.id)}
            onClick={(e) => {
              e.stopPropagation();
              const fromDom = normalizeGuid(e.currentTarget.getAttribute("data-id") ?? "");
              openByGuid(fromDom || item.id, item.status);
            }}
          >
            {item.baNumber?.trim() ? item.baNumber : "Draft"}
          </Link>
        </TableCellLayout>
      ),
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "email",
      renderHeaderCell: () => "Email",
      renderCell: (item) => {
        const email = item.applicant.email ?? "";
        if (!email) return "";
        return (
          <TableCellLayout>
            <Link href={`mailto:${email}`} onClick={(e) => e.stopPropagation()}>
              {email}
            </Link>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "requestDate",
      renderHeaderCell: () => "Request Date",
      renderCell: (item) => (item.requestDate ? new Date(item.requestDate).toLocaleDateString() : ""),
    }),
    createTableColumn<BuildingApprovalRecord>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (item) => (
        <span className={mergeClasses(styles.statusPill, statusClass(item.status))}>
          {statusLabel[item.status] ?? "Unknown"}
        </span>
      ),
    }),
  ];

  return (
    <div className={mergeClasses(styles.root, "aal-ba-shell")}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Building approvals</p>
        <h1 className={styles.title}>Track and manage your submissions.</h1>
        <p className={styles.lede}>
          Create a new application, open a draft to continue later, or track submissions that are already in progress.
        </p>
      </section>

      {showToast && (
        <div className={styles.toast} role="status">
          Draft saved. You can continue this application anytime from the list below.
        </div>
      )}

      <div className={styles.toolbar} aria-label="Submission actions">
        <HeroButton onClick={onCreate} disabled={!contactId}>
          Create
        </HeroButton>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {loading ? (
        <Spinner label="Loading submissions..." />
      ) : error ? null : records.length === 0 ? (
        <section className={styles.shell}>
          <div className={styles.emptyState}>
            <span>No submissions yet.</span>
            <HeroButton onClick={onCreate} disabled={!contactId}>
              Create your first application
            </HeroButton>
          </div>
        </section>
      ) : (
        <section className={styles.shell}>
          <DataGrid
            items={records}
            columns={columns}
            getRowId={(item: BuildingApprovalRecord) => normalizeGuid(item.id)}
            sortable
          >
            <DataGridHeader className={styles.headerRow}>
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell className={styles.headerCell}>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<BuildingApprovalRecord>>
              {({ item, rowId }) => {
                const index = records.findIndex((r) => r.id === item.id);
                const recordGuid = normalizeGuid(item.id);
                return (
                  <DataGridRow<BuildingApprovalRecord>
                    key={rowId}
                    className={index % 2 === 1 ? styles.rowAlt : styles.row}
                    data-id={recordGuid}
                    data-entityid={recordGuid}
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      const fromDom =
                        normalizeGuid(e.currentTarget.getAttribute("data-id") ?? "") ||
                        normalizeGuid(e.currentTarget.getAttribute("data-entityid") ?? "");
                      openByGuid(fromDom || recordGuid, item.status);
                    }}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                );
              }}
            </DataGridBody>
          </DataGrid>
        </section>
      )}
    </div>
  );
};
