// services/admin-dashboard/lib/payment-method-code.test.ts
/**
 * Standalone test for the payment-method code generation helper.
 * The admin dashboard has no test framework; run directly with Node's native
 * TypeScript support:  node lib/payment-method-code.test.ts
 */
import assert from "node:assert/strict";
import { buildPaymentMethodCode, PAYMENT_METHOD_CODE_MAX_LENGTH } from "./payment-method-code.ts";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓", name);
}

t("short name produces a code whose shape is unchanged (slug_suffix)", () => {
  const code = buildPaymentMethodCode("Bank BCA");
  assert.match(code, /^bank_bca_[0-9a-z]{1,6}$/);
});

t("an existing code passes through untouched, even if it's long or odd", () => {
  const weird = "some_pre_existing_code_thats_kept_as_is_g002sh";
  assert.equal(buildPaymentMethodCode("A totally different name", weird), weird);
});

t("a long name produces a code within the DB column limit", () => {
  const longName = "A".repeat(200);
  const code = buildPaymentMethodCode(longName);
  assert.ok(code.length <= PAYMENT_METHOD_CODE_MAX_LENGTH, `expected <= ${PAYMENT_METHOD_CODE_MAX_LENGTH}, got ${code.length}`);
});

t("truncation never leaves a trailing underscore right before the suffix", () => {
  // 42 letters + a separator run: slugify collapses the separator to a
  // single "_", landing it at index 42 - exactly where slice(0, 43) (the
  // 50-char limit minus the 7-char suffix) cuts. A naive slice would keep
  // that trailing "_" and produce a double-underscore once the suffix's
  // own leading "_" is appended.
  const name = "a".repeat(42) + " --- more words after the cut";
  const code = buildPaymentMethodCode(name);
  assert.doesNotMatch(code, /__/, `got double underscore in ${code}`);
  assert.ok(code.length <= PAYMENT_METHOD_CODE_MAX_LENGTH, `expected <= ${PAYMENT_METHOD_CODE_MAX_LENGTH}, got ${code.length}`);
});

t("the real production incident name now produces a valid, in-limit code", () => {
  const name = "Credit / Debit Card (Mastercard / Visa / JCB) with manual confirmation";
  const code = buildPaymentMethodCode(name);
  assert.ok(code.length <= PAYMENT_METHOD_CODE_MAX_LENGTH, `expected <= ${PAYMENT_METHOD_CODE_MAX_LENGTH}, got ${code.length} ("${code}")`);
  assert.doesNotMatch(code, /__/, `got double underscore in ${code}`);
  assert.match(code, /^[a-z0-9_]+$/);
});

t("empty existing code (falsy) still generates a new code rather than passing through", () => {
  const code = buildPaymentMethodCode("Bank BCA", "");
  assert.match(code, /^bank_bca_[0-9a-z]{1,6}$/);
});

console.log(`\n${passed} passed`);
