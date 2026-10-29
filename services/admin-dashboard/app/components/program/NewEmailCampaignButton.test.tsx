// services/admin-dashboard/app/components/program/NewEmailCampaignButton.test.tsx
import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ApiError } from "@/src/shared/api-client";
import { campaignErrorMessage } from "./NewEmailCampaignButton";

describe("campaignErrorMessage", () => {
  it("explains a 503 as Listmonk not configured", () => {
    expect(campaignErrorMessage(new ApiError("x", 503))).toMatch(/not configured/);
  });
  it("surfaces the upstream message on a 502", () => {
    expect(campaignErrorMessage(new ApiError("bad list", 502))).toMatch(/rejected.*bad list/);
  });
  it("falls back to the error message", () => {
    expect(campaignErrorMessage(new Error("nope"))).toBe("nope");
  });
});
