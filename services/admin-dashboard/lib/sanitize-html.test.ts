// services/admin-dashboard/lib/sanitize-html.test.ts
/**
 * Vitest suite for the shared HTML sanitizer.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { sanitizeHtml, TEXT_ONLY_TAGS } from "./sanitize-html.ts";

describe("sanitize-html", () => {

it("strips <script> tags", () => {
  assert.equal(sanitizeHtml("<p>hi</p><script>alert(1)</script>"), "<p>hi</p>");
});

it("strips inline event handlers", () => {
  assert.equal(sanitizeHtml('<img src="x" onerror="alert(1)">'), '<img src="x">');
});

it("strips javascript: hrefs", () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
  assert.ok(!out.includes("javascript:"), `expected no javascript: scheme, got: ${out}`);
});

it("keeps ordinary formatting markup", () => {
  assert.equal(
    sanitizeHtml("<p><strong>Bold</strong> and <em>italic</em></p>"),
    "<p><strong>Bold</strong> and <em>italic</em></p>",
  );
});

it("returns empty string for empty/whitespace input", () => {
  assert.equal(sanitizeHtml(""), "");
  assert.equal(sanitizeHtml("   "), "");
  assert.equal(sanitizeHtml(null), "");
  assert.equal(sanitizeHtml(undefined), "");
});

it("keeps safe text-align/color style declarations", () => {
  assert.equal(
    sanitizeHtml('<p style="text-align: center; color: #ff0000">x</p>'),
    '<p style="text-align: center; color: #ff0000">x</p>',
  );
});

it("strips unsafe style declarations while keeping safe ones", () => {
  const out = sanitizeHtml('<p style="text-align:center; background:url(javascript:alert(1))">x</p>');
  assert.ok(!out.includes("background"), `expected background stripped, got: ${out}`);
  assert.ok(out.includes("text-align:center") || out.includes("text-align: center"), `expected text-align kept, got: ${out}`);
});

it("text-only allowlist drops headings/links/images", () => {
  const out = sanitizeHtml('<h1>Title</h1><a href="/x">link</a><p>body</p>', {
    allowedTags: TEXT_ONLY_TAGS,
  });
  assert.ok(!out.includes("<h1>") && !out.includes("<a"), `expected tags stripped, got: ${out}`);
  assert.ok(out.includes("<p>body</p>"), `expected <p> kept, got: ${out}`);
});

});
