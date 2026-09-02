// services/admin-dashboard/lib/sanitize-html.test.ts
/**
 * Standalone test for the shared HTML sanitizer.
 * The admin dashboard has no test framework; run directly with Node's native
 * TypeScript support:  node lib/sanitize-html.test.ts
 */
import assert from "node:assert/strict";
import { sanitizeHtml, TEXT_ONLY_TAGS } from "./sanitize-html.ts";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓", name);
}

t("strips <script> tags", () => {
  assert.equal(sanitizeHtml("<p>hi</p><script>alert(1)</script>"), "<p>hi</p>");
});

t("strips inline event handlers", () => {
  assert.equal(sanitizeHtml('<img src="x" onerror="alert(1)">'), '<img src="x">');
});

t("strips javascript: hrefs", () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
  assert.ok(!out.includes("javascript:"), `expected no javascript: scheme, got: ${out}`);
});

t("keeps ordinary formatting markup", () => {
  assert.equal(
    sanitizeHtml("<p><strong>Bold</strong> and <em>italic</em></p>"),
    "<p><strong>Bold</strong> and <em>italic</em></p>",
  );
});

t("returns empty string for empty/whitespace input", () => {
  assert.equal(sanitizeHtml(""), "");
  assert.equal(sanitizeHtml("   "), "");
  assert.equal(sanitizeHtml(null), "");
  assert.equal(sanitizeHtml(undefined), "");
});

t("keeps safe text-align/color style declarations", () => {
  assert.equal(
    sanitizeHtml('<p style="text-align: center; color: #ff0000">x</p>'),
    '<p style="text-align: center; color: #ff0000">x</p>',
  );
});

t("strips unsafe style declarations while keeping safe ones", () => {
  const out = sanitizeHtml('<p style="text-align:center; background:url(javascript:alert(1))">x</p>');
  assert.ok(!out.includes("background"), `expected background stripped, got: ${out}`);
  assert.ok(out.includes("text-align:center") || out.includes("text-align: center"), `expected text-align kept, got: ${out}`);
});

t("text-only allowlist drops headings/links/images", () => {
  const out = sanitizeHtml('<h1>Title</h1><a href="/x">link</a><p>body</p>', {
    allowedTags: TEXT_ONLY_TAGS,
  });
  assert.ok(!out.includes("<h1>") && !out.includes("<a"), `expected tags stripped, got: ${out}`);
  assert.ok(out.includes("<p>body</p>"), `expected <p> kept, got: ${out}`);
});

console.log(`\n${passed} passed`);
