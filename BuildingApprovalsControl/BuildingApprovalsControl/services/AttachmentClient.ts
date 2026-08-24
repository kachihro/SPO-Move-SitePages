import { ApplicationAttachment } from "../types/Attachment";

export interface AttachmentDownload {
  fileName: string;
  mimeType: string;
  blob: Blob;
}

/**
 * Supporting documents attached to a Building Activity Application, stored as Dataverse Notes.
 * Deliberately separate from `DataverseClient` — that interface is a `BuildingApprovalRecord`
 * CRUD contract with two implementations, and annotation traffic always goes through raw
 * `/_api/` regardless of which of those is in play.
 */
export interface AttachmentClient {
  list(recordId: string): Promise<ApplicationAttachment[]>;
  upload(recordId: string, file: File): Promise<ApplicationAttachment>;
  download(annotationId: string): Promise<AttachmentDownload>;
  remove(annotationId: string): Promise<void>;
  /**
   * Classify an already-uploaded document. Separate from `upload` because the applicant picks the
   * type from the grid after the bytes have landed, and may change it again before submitting.
   */
  setDocumentType(annotationId: string, documentType: string): Promise<void>;
}
