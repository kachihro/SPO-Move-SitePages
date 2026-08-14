import { AttachmentClient, AttachmentDownload } from "./AttachmentClient";
import { guessMimeType, sanitizeFileName, validateFile } from "./fileEncoding";
import { ApplicationAttachment } from "../types/Attachment";

interface StoredAttachment {
  meta: ApplicationAttachment;
  recordId: string;
  file: File;
}

/**
 * In-memory attachments for the PCF dev harness, where `window.location.origin` is
 * localhost:8181 and there is no `/_api/` to talk to.
 *
 * Keeps the real `File` so `download()` returns a genuine Blob — that makes the
 * pick -> list -> download -> open round trip testable without a `pac pcf push`.
 */
export class MockAttachmentClient implements AttachmentClient {
  private readonly store: StoredAttachment[] = [];
  private nextId = 1;

  public async list(recordId: string): Promise<ApplicationAttachment[]> {
    await delay();
    return this.store.filter((s) => s.recordId === recordId).map((s) => s.meta);
  }

  public async upload(recordId: string, file: File): Promise<ApplicationAttachment> {
    validateFile(file);
    await delay();
    const fileName = sanitizeFileName(file.name);
    const meta: ApplicationAttachment = {
      id: `mock-${this.nextId++}`,
      fileName,
      mimeType: file.type || guessMimeType(fileName),
      sizeBytes: file.size,
      createdOn: new Date().toISOString(),
    };
    this.store.unshift({ meta, recordId, file });
    return meta;
  }

  public async download(annotationId: string): Promise<AttachmentDownload> {
    await delay();
    const found = this.store.find((s) => s.meta.id === annotationId);
    if (!found) throw new Error("This document has no content to download.");
    return {
      fileName: found.meta.fileName,
      mimeType: found.meta.mimeType,
      blob: found.file.slice(0, found.file.size, found.meta.mimeType),
    };
  }

  public async remove(annotationId: string): Promise<void> {
    await delay();
    const index = this.store.findIndex((s) => s.meta.id === annotationId);
    if (index >= 0) this.store.splice(index, 1);
  }
}

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
