/**
 * Supporting documents for a Building Activity Application.
 *
 * Stored as Dataverse Notes (`annotation`) regarding the application record — not on the
 * application itself. Kept separate from `BuildingApproval.ts`, which mirrors the
 * `cr137_buildingactivityapplication` schema only.
 */

export const ANNOTATION_ENTITY_SET = "annotations";

/**
 * `objectid` is a polymorphic lookup, so the bind uses the type-suffixed navigation property.
 * This bind is exactly why uploads cannot go through `context.webAPI` — the Power Pages
 * polyfill strips `@odata.bind` keys and would silently orphan the note (see portalApi.ts).
 */
export const ANNOTATION_OBJECTID_BIND = "objectid_cr137_buildingactivityapplication@odata.bind";

/**
 * Columns read when listing. NEVER add `documentbody` here — twenty 3MB files would pull
 * ~80MB of base64 into the browser on every render of step 3.
 */
export const ANNOTATION_LIST_SELECT =
  "annotationid,filename,mimetype,filesize,createdon,subject,isdocument";

/** Raw annotation columns — only the ones this control reads or writes. */
export interface AnnotationEntity {
  annotationid?: string;
  subject?: string;
  notetext?: string;
  filename?: string;
  mimetype?: string;
  filesize?: number;
  isdocument?: boolean;
  /** base64. Only ever $select'd for a single-record download. */
  documentbody?: string;
  createdon?: string;
  _objectid_value?: string;
}

/** UI shape consumed by AttachmentsGrid. */
export interface ApplicationAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdOn?: string;
  /** Undefined until the applicant picks one. Submit is blocked while any row is undefined. */
  documentType?: string;
}

/**
 * Placeholder classifications — swap for the real list when the business supplies it. Stored as
 * free text in `annotation.subject`, so editing this list never invalidates documents already
 * classified under an older label.
 */
export const DOCUMENT_TYPES = ["AAAA", "BBBB", "CCCC", "DDDD"] as const;

/**
 * `subject` does double duty: on upload it is seeded with the file name so the model-driven Notes
 * control still has a title, then overwritten with the document type once one is chosen. A subject
 * equal to the file name therefore means "not classified yet" — which is also what makes notes
 * created before this feature read correctly, with no data migration.
 */
export function documentTypeFromSubject(subject: string | undefined, fileName: string): string | undefined {
  const value = (subject ?? "").trim();
  if (!value || value === fileName.trim()) return undefined;
  return value;
}

/**
 * Matches the Dataverse `Organization.MaxUploadFileSize` default, so no environment change is
 * needed. If that org setting is ever raised, raise this too — but note base64 inflates the
 * payload ~33% and a single web-service call is capped at 16MB, so ~11MB is the hard ceiling
 * regardless of the org setting.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Documents, images and drawings — this is a building-consent form, so DWG/DXF matter. */
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "dwg",
  "dxf",
  "zip",
  "txt",
  "csv",
  "msg",
];
