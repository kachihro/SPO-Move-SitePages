/**
 * File <-> base64 helpers and upload validation. Pure — no React, no network — so the rules
 * can be exercised in the PCF harness without touching Dataverse.
 */

import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
} from "../types/Attachment";

/**
 * `FileReader.readAsDataURL` is the only approach safe on every browser Power Pages serves.
 * `File.arrayBuffer()` is missing on older hosts, and
 * `btoa(String.fromCharCode(...new Uint8Array(buf)))` blows the call stack on a 5MB spread.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(","); // strip the "data:<mime>;base64," prefix
      if (comma < 0) {
        reject(new Error(`Could not encode "${file.name}".`));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * atob + a manual byte loop. Not `fetch(dataUrl)` — Power Pages' CSP can block `data:` fetches.
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  dwg: "image/vnd.dwg",
  dxf: "image/vnd.dxf",
  zip: "application/zip",
  txt: "text/plain",
  csv: "text/csv",
  msg: "application/vnd.ms-outlook",
};

/** Browsers leave `File.type` empty for DWG/DXF/MSG — fall back to the extension. */
export function guessMimeType(fileName: string): string {
  return MIME_BY_EXTENSION[fileExtension(fileName)] ?? "application/octet-stream";
}

/**
 * Applied at upload time so the Dataverse filename and the SharePoint filename are identical
 * and the sync flow never has to rename anything.
 */
export function sanitizeFileName(fileName: string): string {
  const leaf = fileName.split(/[\\/]/).pop() ?? fileName;
  const cleaned = leaf
    // Illegal in SharePoint file names.
    .replace(/["*:<>?|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();

  if (!cleaned) return "document";
  if (cleaned.length <= 255) return cleaned;

  // Truncate the stem, keep the extension — a name without its extension is unusable.
  const ext = fileExtension(cleaned);
  const suffix = ext ? `.${ext}` : "";
  return cleaned.slice(0, 255 - suffix.length) + suffix;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FRIENDLY_TYPE: Record<string, string> = {
  pdf: "PDF",
  doc: "Word",
  docx: "Word",
  xls: "Excel",
  xlsx: "Excel",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
  png: "Image",
  jpg: "Image",
  jpeg: "Image",
  gif: "Image",
  bmp: "Image",
  tif: "Image",
  tiff: "Image",
  dwg: "Drawing",
  dxf: "Drawing",
  zip: "Archive",
  txt: "Text",
  csv: "CSV",
  msg: "Email",
};

export function friendlyType(fileName: string): string {
  const ext = fileExtension(fileName);
  return FRIENDLY_TYPE[ext] ?? (ext ? ext.toUpperCase() : "File");
}

/** Throws a user-facing Error. Runs before any network call, so bad files cost nothing. */
export function validateFile(file: File): void {
  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty (0 bytes) and cannot be uploaded.`);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const limitMb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));
    throw new Error(
      `"${file.name}" is ${formatBytes(file.size)}. The maximum size per document is ${limitMb} MB.`
    );
  }
  const ext = fileExtension(file.name);
  if (!ext || !ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
    throw new Error(
      `"${file.name}" is not an accepted file type. Allowed types: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}.`
    );
  }
}
