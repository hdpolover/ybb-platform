// lib/upload-validation.ts
/**
 * Single source of truth for what the admin dashboard may upload.
 *
 * These values mirror the FastAPI file service's two enforcement points —
 * `create_upload_url_handler.py` (presigned flow) and `upload_file_handler.py`
 * (multipart flow). Keep them in sync: anything this module lets through is
 * something the server is expected to accept, and anything it rejects is
 * explained to the admin here rather than surfacing as an opaque 400/413.
 *
 * SVG is deliberately absent — see the note on IMAGE_MIME_TYPES.
 */

/**
 * Raster image types accepted by both file-service handlers.
 *
 * SVG is NOT included. An SVG is an executable document (script elements,
 * on* handlers, foreignObject, external entity references) and these files are
 * served straight from the CDN, so accepting one unsanitised would be a stored
 * XSS vector. Supporting it needs server-side sanitisation in the file service
 * plus hardened serving headers; until that exists, admins export logos as PNG.
 */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** 10 MB — CreateUploadUrlHandler.MAX_IMAGE_SIZE and UploadFileHandler.MAX_IMAGE_SIZE. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * 50 MB — CreateUploadUrlHandler.MAX_DOCUMENT_SIZE. The legacy multipart
 * handler still caps documents at 10 MB, but no admin surface posts documents
 * through it; every document upload goes via the presigned flow.
 */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/** `accept` attribute for inputs that take images only. */
export const IMAGE_ACCEPT_ATTR = IMAGE_MIME_TYPES.join(",");

/** `accept` attribute for inputs that take images or documents. */
export const UPLOAD_ACCEPT_ATTR = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES].join(",");

/** Helper copy so every image picker advertises the same thing. */
export const IMAGE_FORMATS_LABEL = "JPG, PNG, WebP or GIF";
export const IMAGE_HINT = `${IMAGE_FORMATS_LABEL} · up to 10 MB`;

export type UploadCandidate = Pick<File, "name" | "type" | "size">;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isDocumentMime(mime: string): boolean {
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export function isSupportedUploadMime(mime: string): boolean {
  return isImageMime(mime) || isDocumentMime(mime);
}

/**
 * Name the file's type the way an admin would recognise it — browsers leave
 * `type` empty for unknown extensions, so fall back to the extension.
 */
function describeType(file: UploadCandidate): string {
  if (file.type) return file.type;
  const ext = /\.([^.]+)$/.exec(file.name)?.[1];
  return ext ? `.${ext.toLowerCase()} file` : "unknown type";
}

/**
 * Type-only pre-flight. Safe to run the moment a file is picked, before any
 * compression — the compressor never turns an unsupported type into a
 * supported one, so rejecting here costs the admin nothing.
 *
 * Returns an admin-facing message, or null when the type is acceptable.
 */
export function validateUploadType(
  file: UploadCandidate,
  { imagesOnly = false }: { imagesOnly?: boolean } = {},
): string | null {
  if (imagesOnly) {
    if (isImageMime(file.type)) return null;
    return `"${file.name}" is not a supported image (${describeType(file)}). Use ${IMAGE_FORMATS_LABEL}, up to ${formatFileSize(MAX_IMAGE_BYTES)}.`;
  }
  if (isSupportedUploadMime(file.type)) return null;
  return `"${file.name}" is not a supported file type (${describeType(file)}). Images: ${IMAGE_FORMATS_LABEL} (up to ${formatFileSize(MAX_IMAGE_BYTES)}). Documents: PDF, Word or Excel (up to ${formatFileSize(MAX_DOCUMENT_BYTES)}).`;
}

/**
 * Full pre-flight: type plus size. Run this on the file that is actually about
 * to be sent — for images that is the *compressed* file, so the size an admin
 * is told about is the size the server would have seen.
 *
 * Returns an admin-facing message, or null when the file may be uploaded.
 */
export function validateUploadFile(
  file: UploadCandidate,
  options: { imagesOnly?: boolean } = {},
): string | null {
  const typeError = validateUploadType(file, options);
  if (typeError) return typeError;

  const limit = isImageMime(file.type) ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > limit) {
    const kind = isImageMime(file.type) ? "image" : "document";
    const advice = isImageMime(file.type)
      ? " Export it at a smaller resolution, or save it as JPG/WebP instead of PNG."
      : "";
    return `"${file.name}" is ${formatFileSize(file.size)}, over the ${formatFileSize(limit)} limit for ${kind} uploads.${advice}`;
  }

  if (file.size === 0) {
    return `"${file.name}" is empty (0 B). Pick the exported file rather than a shortcut or placeholder.`;
  }

  return null;
}
