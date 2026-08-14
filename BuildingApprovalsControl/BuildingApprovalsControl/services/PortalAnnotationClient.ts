import { AttachmentClient, AttachmentDownload } from "./AttachmentClient";
import { base64ToBlob, fileToBase64, guessMimeType, sanitizeFileName, validateFile } from "./fileEncoding";
import { getErrorMessage } from "./errors";
import { normalizeGuid } from "./mapping";
import { portalApiDelete, portalApiGet, portalApiPost } from "./portalApi";
import {
  ANNOTATION_ENTITY_SET,
  ANNOTATION_LIST_SELECT,
  ANNOTATION_OBJECTID_BIND,
  AnnotationEntity,
  ApplicationAttachment,
} from "../types/Attachment";
import { BUILDING_APPROVAL_ENTITY_SET } from "../types/BuildingApproval";

/**
 * Attachments over the raw Power Pages `/_api/` endpoint.
 *
 * Deliberately does NOT take `context.webAPI`: creating a note requires binding the polymorphic
 * `objectid` lookup, and the Power Pages webAPI polyfill strips `@odata.bind` keys — the note
 * would be created successfully but attached to nothing. See the header of `portalApi.ts`.
 */
export class PortalAnnotationClient implements AttachmentClient {
  public async list(recordId: string): Promise<ApplicationAttachment[]> {
    return wrap("list", async () => {
      const id = normalizeGuid(recordId);
      if (!id) return [];

      const filter = `$filter=_objectid_value eq ${id} and isdocument eq true`;
      const order = "$orderby=createdon desc";

      try {
        const res = await portalApiGet<{ value: AnnotationEntity[] }>(
          `${ANNOTATION_ENTITY_SET}?$select=${ANNOTATION_LIST_SELECT}&${filter}&${order}`
        );
        return (res?.value ?? []).map(toAttachment);
      } catch {
        // Power Pages has a track record of mishandling lookup $filters on this org — the same
        // reason WebApiClient.retrieveMultiple scopes by contact client-side rather than trusting
        // $filter. Fall back to a scan and filter here.
        const all = await portalApiGet<{ value: AnnotationEntity[] }>(
          `${ANNOTATION_ENTITY_SET}?$select=${ANNOTATION_LIST_SELECT},_objectid_value&${order}`
        );
        const wanted = id.toLowerCase();
        return (all?.value ?? [])
          .filter((a) => a.isdocument && normalizeGuid(a._objectid_value ?? "").toLowerCase() === wanted)
          .map(toAttachment);
      }
    });
  }

  public async upload(recordId: string, file: File): Promise<ApplicationAttachment> {
    return wrap("upload", async () => {
      const id = normalizeGuid(recordId);
      if (!id) {
        throw new Error("Save this application before attaching documents.");
      }
      validateFile(file);

      const fileName = sanitizeFileName(file.name);
      const mimeType = file.type || guessMimeType(fileName);
      const documentbody = await fileToBase64(file);

      const annotationId = await portalApiPost(
        ANNOTATION_ENTITY_SET,
        {
          subject: fileName.slice(0, 500),
          filename: fileName,
          mimetype: mimeType,
          documentbody,
          isdocument: true,
          // Portal-created notes are conventionally prefixed so the native Power Pages notes
          // control also shows them.
          notetext: "*WEB*",
          [ANNOTATION_OBJECTID_BIND]: `/${BUILDING_APPROVAL_ENTITY_SET}(${id})`,
        },
        "annotationid"
      );

      if (!annotationId) {
        throw new Error("The document uploaded but Dataverse returned no note id.");
      }

      return {
        id: annotationId,
        fileName,
        mimeType,
        sizeBytes: file.size,
        createdOn: new Date().toISOString(),
      };
    });
  }

  public async download(annotationId: string): Promise<AttachmentDownload> {
    return wrap("download", async () => {
      const id = normalizeGuid(annotationId);
      const row = await portalApiGet<AnnotationEntity>(
        `${ANNOTATION_ENTITY_SET}(${id})?$select=filename,mimetype,documentbody`
      );
      if (!row?.documentbody) {
        throw new Error("This document has no content to download.");
      }
      const fileName = row.filename ?? "document";
      const mimeType = row.mimetype ?? guessMimeType(fileName);
      return { fileName, mimeType, blob: base64ToBlob(row.documentbody, mimeType) };
    });
  }

  public async remove(annotationId: string): Promise<void> {
    return wrap("delete", async () => {
      await portalApiDelete(`${ANNOTATION_ENTITY_SET}(${normalizeGuid(annotationId)})`);
    });
  }
}

function toAttachment(entity: AnnotationEntity): ApplicationAttachment {
  const fileName = entity.filename ?? entity.subject ?? "document";
  return {
    id: normalizeGuid(entity.annotationid ?? ""),
    fileName,
    mimeType: entity.mimetype ?? guessMimeType(fileName),
    sizeBytes: entity.filesize ?? 0,
    createdOn: entity.createdon,
  };
}

/** Mirrors WebApiClient's private `wrap` — callers always get a real Error with a real message. */
async function wrap<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    throw new Error(`Attachment ${operation} failed: ${getErrorMessage(err)}`);
  }
}
