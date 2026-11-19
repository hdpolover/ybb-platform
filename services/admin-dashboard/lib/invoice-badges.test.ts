// services/admin-dashboard/lib/invoice-badges.test.ts
import { describe, expect, it } from "vitest";
import { formatFollowUpLabel, paidTotalsByCurrency } from "./invoice-badges";

describe("paidTotalsByCurrency", () => {
  it("sums only paid invoices, per currency, in first-seen order", () => {
    expect(
      paidTotalsByCurrency([
        { status: "paid", amount: 264000, currency: "IDR" },
        { status: "unpaid", amount: 50, currency: "USD" },
        { status: "paid", amount: 15, currency: "USD" },
        { status: "paid", amount: 100000, currency: "IDR" },
        { status: "refunded", amount: 15, currency: "USD" },
      ]),
    ).toEqual([
      { currency: "IDR", amount: 364000 },
      { currency: "USD", amount: 15 },
    ]);
  });

  it("is empty when nothing is paid", () => {
    expect(paidTotalsByCurrency([{ status: "processing", amount: 10, currency: "USD" }])).toEqual([]);
  });
});

describe("formatFollowUpLabel", () => {
  it("uses the override labels, else humanizes", () => {
    expect(formatFollowUpLabel("payment_processing_stuck")).toBe("Processing (stuck)");
    expect(formatFollowUpLabel("manual_proof_rejected")).toBe("Manual Proof Rejected");
  });
});
