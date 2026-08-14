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
} from "@fluentui/react-components";
import { useAttachmentClient } from "../../../services/AttachmentClientContext";
import { getErrorMessage } from "../../../services/errors";
import { formatBytes, friendlyType, sanitizeFileName } from "../../../services/fileEncoding";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ApplicationAttachment,
  MAX_ATTACHMENT_BYTES,
} from "../../../types/Attachment";
import { HeroButton } from "../../HeroButton";

/**
 * Panel styling mirrors SubmissionsGrid's card treatment. Kept local rather than shared for now —
 * extracting the common rules is a follow-up, not part of this change.
 */
const useStyles = makeStyles({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  hint: {
    margin: 0,
    fontSize: "13px",
    color: "#5C5E6B",
    lineHeight: 1.45,
  },
  dropZone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    borderRadius: "12px",
    border: "1px dashed #D8D2C9",
    backgroundColor: "#FBF9F7",
    fontSize: "13px",
    color: "#6B6560",
    textAlign: "center",
  },
  dropZoneActive: {
    border: "1px dashed #9B2D6A",
    backgroundColor: "#F7E8F0",
    color: "#9B2D6A",
  },
  shell: {
    border: "1px solid #E2E1DC",
    borderRadius: "14px",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
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
  },
  rowAlt: {
    backgroundColor: "#FAF7F3",
  },
  fileLink: {
    fontWeight: 600,
    color: "#9B2D6A",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    cursor: "pointer",
  },
  deleteLink: {
    color: "#A4262C",
    cursor: "pointer",
  },
  confirmRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#5C5E6B",
  },
  uploading: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "10px 14px",
    borderRadius: "10px",
    backgroundColor: "#F7E8F0",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "36px 24px",
    color: "#6B6560",
    fontSize: "14px",
  },
});

export interface AttachmentsGridProps {
  /** Null until the application has been saved at least once — uploads need something to bind to. */
  recordId: string | null;
  readOnly: boolean;
  /** Lets the wizard disable its footer while bytes are in flight. */
  onBusyChange?: (busy: boolean) => void;
}

export const AttachmentsGrid: React.FC<AttachmentsGridProps> = ({ recordId, readOnly, onBusyChange }) => {
  const styles = useStyles();
  const client = useAttachmentClient();

  const [items, setItems] = React.useState<ApplicationAttachment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [uploading, setUploading] = React.useState<string[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const limitMb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

  React.useEffect(() => {
    if (!recordId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    void (async () => {
      try {
        const result = await client.list(recordId);
        if (!cancelled) setItems(result);
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, recordId]);

  /**
   * Sequential, not Promise.all: several concurrent multi-megabyte base64 POSTs hit Power Pages
   * throttling and spike browser memory. One bad file reports and the batch continues.
   */
  const handleFiles = async (files: File[]) => {
    if (!recordId || files.length === 0) return;

    setError(undefined);
    onBusyChange?.(true);

    const failures: string[] = [];
    const existing = items.map((i) => i.fileName.toLowerCase());

    for (const file of files) {
      const name = sanitizeFileName(file.name);
      if (existing.includes(name.toLowerCase())) {
        // Dataverse allows duplicates; SharePoint's Create file would collide on the mirror.
        failures.push(`"${name}" is already attached.`);
        continue;
      }

      setUploading((prev) => [...prev, name]);
      try {
        const created = await client.upload(recordId, file);
        existing.push(created.fileName.toLowerCase());
        setItems((prev) => [created, ...prev]);
      } catch (err: unknown) {
        failures.push(getErrorMessage(err));
      } finally {
        setUploading((prev) => prev.filter((n) => n !== name));
      }
    }

    if (failures.length > 0) setError(failures.join(" "));
    onBusyChange?.(false);
  };

  const handleDownload = async (item: ApplicationAttachment) => {
    setBusyId(item.id);
    setError(undefined);
    try {
      const { blob, fileName } = await client.download(item.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName; // forces a save rather than in-page navigation
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor); // Firefox requires the anchor be in the DOM
      anchor.click();
      document.body.removeChild(anchor);
      // Revoking synchronously truncates the download on some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: ApplicationAttachment) => {
    setConfirmId(null);
    setBusyId(item.id);
    setError(undefined);
    try {
      await client.remove(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns: TableColumnDefinition<ApplicationAttachment>[] = [
    createTableColumn<ApplicationAttachment>({
      columnId: "fileName",
      renderHeaderCell: () => "File name",
      renderCell: (item) => (
        <TableCellLayout truncate>
          <Link className={styles.fileLink} onClick={() => void handleDownload(item)}>
            {item.fileName}
          </Link>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ApplicationAttachment>({
      columnId: "type",
      renderHeaderCell: () => "Type",
      renderCell: (item) => friendlyType(item.fileName),
    }),
    createTableColumn<ApplicationAttachment>({
      columnId: "size",
      renderHeaderCell: () => "Size",
      renderCell: (item) => formatBytes(item.sizeBytes),
    }),
    createTableColumn<ApplicationAttachment>({
      columnId: "createdOn",
      renderHeaderCell: () => "Uploaded",
      renderCell: (item) => (item.createdOn ? new Date(item.createdOn).toLocaleString() : ""),
    }),
    createTableColumn<ApplicationAttachment>({
      columnId: "actions",
      renderHeaderCell: () => (readOnly ? "" : "Actions"),
      renderCell: (item) => {
        if (readOnly) return "";
        if (busyId === item.id) return <Spinner size="tiny" />;
        if (confirmId === item.id) {
          return (
            <span className={styles.confirmRow}>
              Delete?
              <Link className={styles.deleteLink} onClick={() => void handleDelete(item)}>
                Yes
              </Link>
              <Link onClick={() => setConfirmId(null)}>No</Link>
            </span>
          );
        }
        return (
          <Link className={styles.deleteLink} onClick={() => setConfirmId(item.id)}>
            Delete
          </Link>
        );
      },
    }),
  ];

  const canUpload = !readOnly && !!recordId;
  const busy = uploading.length > 0;

  return (
    <div className={styles.stack}>
      {!recordId && !readOnly && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Save this application before attaching documents — use Save Draft, or step back and press Next.
          </MessageBarBody>
        </MessageBar>
      )}

      {canUpload && (
        <div className={styles.toolbar}>
          <p className={styles.hint}>
            Attach site plans, drawings, certificates and any other supporting documents. Up to {limitMb} MB
            per file ({ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}).
          </p>
          <HeroButton onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? "Uploading..." : "Upload documents"}
          </HeroButton>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        accept={ALLOWED_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",")}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Must clear before the await, or re-picking the same file never fires change again.
          e.target.value = "";
          void handleFiles(files);
        }}
      />

      {canUpload && (
        <div
          className={mergeClasses(styles.dropZone, dragging && styles.dropZoneActive)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(Array.from(e.dataTransfer.files ?? []));
          }}
        >
          Drag and drop files here, or use Upload documents above.
        </div>
      )}

      {uploading.length > 0 && (
        <div className={styles.uploading}>
          {uploading.map((name) => (
            <Spinner key={name} size="tiny" label={`Uploading ${name}...`} />
          ))}
        </div>
      )}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {loading ? (
        <Spinner label="Loading documents..." />
      ) : items.length === 0 ? (
        <section className={styles.shell}>
          <div className={styles.emptyState}>
            <span>No documents attached yet.</span>
            {canUpload && (
              <HeroButton onClick={() => inputRef.current?.click()} disabled={busy}>
                Add your first document
              </HeroButton>
            )}
          </div>
        </section>
      ) : (
        <section className={styles.shell}>
          <DataGrid items={items} columns={columns} getRowId={(item: ApplicationAttachment) => item.id} sortable>
            <DataGridHeader className={styles.headerRow}>
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell className={styles.headerCell}>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<ApplicationAttachment>>
              {({ item, rowId }) => {
                const index = items.findIndex((i) => i.id === item.id);
                return (
                  <DataGridRow<ApplicationAttachment>
                    key={rowId}
                    className={index % 2 === 1 ? styles.rowAlt : styles.row}
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
