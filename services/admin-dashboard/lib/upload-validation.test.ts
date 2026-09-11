/**
 * Vitest suite for the upload pre-flight helpers.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  IMAGE_ACCEPT_ATTR,
  MAX_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
  formatFileSize,
  isSupportedUploadMime,
  validateUploadType,
  validateUploadFile,
  type UploadCandidate,
} from "./upload-validation.ts";

const candidate = (
  name: string,
  type: string,
  size: number,
): UploadCandidate => ({ name, type, size });

describe("upload-validation", () => {

it("accepts an ordinary PNG logo", () => {
  assert.equal(
    validateUploadFile(candidate("iys-logo.png", "image/png", 400 * 1024), {
      imagesOnly: true,
    }),
    null,
  );
});

it("rejects SVG with a message naming the file and the accepted formats", () => {
  const msg = validateUploadType(
    candidate("iys-logo.svg", "image/svg+xml", 12 * 1024),
    { imagesOnly: true },
  );
  assert.ok(msg);
  assert.match(msg, /iys-logo\.svg/);
  assert.match(msg, /JPG, PNG, WebP or GIF/);
});

it("names the extension when the browser reports no MIME type", () => {
  const msg = validateUploadType(candidate("logo.heic", "", 900 * 1024), {
    imagesOnly: true,
  });
  assert.ok(msg);
  assert.match(msg, /\.heic file/);
});

it("rejects an oversized image with its real size and the limit", () => {
  const msg = validateUploadFile(
    candidate("poster.png", "image/png", 14 * 1024 * 1024),
    { imagesOnly: true },
  );
  assert.ok(msg);
  assert.match(msg, /14\.0 MB/);
  assert.match(msg, /10\.0 MB limit for image uploads/);
});

it("allows a document up to the 50 MB presigned limit", () => {
  assert.equal(
    validateUploadFile(candidate("handbook.pdf", "application/pdf", MAX_DOCUMENT_BYTES)),
    null,
  );
  const msg = validateUploadFile(
    candidate("handbook.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1),
  );
  assert.ok(msg);
  assert.match(msg, /limit for document uploads/);
});

it("rejects a document on an images-only surface", () => {
  const msg = validateUploadType(
    candidate("brief.pdf", "application/pdf", 1024),
    { imagesOnly: true },
  );
  assert.ok(msg);
  assert.match(msg, /not a supported image/);
});

it("an image exactly at the limit is allowed, one byte over is not", () => {
  assert.equal(
    validateUploadFile(candidate("a.jpg", "image/jpeg", MAX_IMAGE_BYTES), {
      imagesOnly: true,
    }),
    null,
  );
  assert.ok(
    validateUploadFile(candidate("a.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1), {
      imagesOnly: true,
    }),
  );
});

it("rejects an empty file rather than uploading 0 bytes", () => {
  const msg = validateUploadFile(candidate("logo.png", "image/png", 0), {
    imagesOnly: true,
  });
  assert.ok(msg);
  assert.match(msg, /empty/);
});

it("MIME allowlist matches the file service handlers", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]) {
    assert.equal(isSupportedUploadMime(mime), true, mime);
  }
  for (const mime of ["image/svg+xml", "image/heic", "application/zip", ""]) {
    assert.equal(isSupportedUploadMime(mime), false, mime);
  }
});

it("the images-only accept attribute advertises exactly the allowlist", () => {
  assert.equal(IMAGE_ACCEPT_ATTR, "image/jpeg,image/png,image/webp,image/gif");
});

it("formatFileSize is readable at each magnitude", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(10 * 1024 * 1024), "10.0 MB");
});

});
