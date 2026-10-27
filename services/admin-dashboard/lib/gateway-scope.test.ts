// services/admin-dashboard/lib/gateway-scope.test.ts
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { scopeLabel, scopeOf, webhookUrl, webhookUrlForConfig } from "./gateway-scope.ts";

const brands = { b1: "IYS" };
const programs = { p1: "IYS 2026" };

describe("gateway-scope", () => {
  it("labels global, brand and program scopes", () => {
    assert.equal(scopeLabel({ brand_id: null, program_id: null }, brands, programs), "Global");
    assert.equal(scopeLabel({ brand_id: "b1", program_id: null }, brands, programs), "Brand: IYS");
    assert.equal(scopeLabel({ brand_id: null, program_id: "p1" }, brands, programs), "Program: IYS 2026");
  });

  it("falls back to unknown when the id has no name", () => {
    assert.equal(scopeLabel({ brand_id: "x" }, brands, programs), "Brand: unknown brand");
    assert.equal(scopeLabel({ program_id: "x" }, brands, programs), "Program: unknown program");
  });

  it("scopeOf treats undefined program_id as not program-scoped", () => {
    assert.equal(scopeOf({ brand_id: null }), "platform");
    assert.equal(scopeOf({ brand_id: "b1", program_id: undefined }), "brand");
  });

  it("webhookUrl builds legacy and per-config URLs", () => {
    assert.equal(webhookUrl("stripe", null, "https://api.ybbhub.com"), "https://api.ybbhub.com/v1/webhooks/payment/stripe");
    assert.equal(webhookUrl("stripe", "abc", "https://api.ybbhub.com"), "https://api.ybbhub.com/v1/webhooks/payment/stripe/abc");
  });

  it("webhookUrl does not double the /v1 or trailing slash", () => {
    assert.equal(webhookUrl("xendit", "abc", "https://api.ybbhub.com/v1/"), "https://api.ybbhub.com/v1/webhooks/payment/xendit/abc");
  });

  it("webhookUrlForConfig uses legacy URL only for global configs", () => {
    const base = "https://api.ybbhub.com";
    assert.equal(webhookUrlForConfig({ id: "c1", provider: "midtrans", brand_id: null, program_id: null }, base), `${base}/v1/webhooks/payment/midtrans`);
    assert.equal(webhookUrlForConfig({ id: "c1", provider: "midtrans", brand_id: "b1", program_id: null }, base), `${base}/v1/webhooks/payment/midtrans/c1`);
    assert.equal(webhookUrlForConfig({ id: "c1", provider: "midtrans", brand_id: null, program_id: "p1" }, base), `${base}/v1/webhooks/payment/midtrans/c1`);
  });
});
