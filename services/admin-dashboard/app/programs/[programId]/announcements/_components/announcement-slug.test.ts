import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_SLUG_MAX_LENGTH,
  announcementPublicPath,
  slugConflictMessage,
  toAnnouncementSlug,
  validateAnnouncementSlug,
} from "./announcement-slug";

describe("toAnnouncementSlug", () => {
  it("matches the API's generated slug for the client's example", () => {
    expect(toAnnouncementSlug("Kwon Hae-suk Explores AI for Inclusive Global Communities")).toBe(
      "kwon-hae-suk-explores-ai-for-inclusive-global-communities",
    );
  });

  it("folds accents, collapses punctuation and trims hyphens", () => {
    expect(toAnnouncementSlug("  Café — Niño!! ")).toBe("cafe-nino");
  });

  it("returns an empty string for a title with no Latin letters or digits", () => {
    expect(toAnnouncementSlug("한국 청년 서밋")).toBe("");
  });

  it("caps the length without a trailing hyphen", () => {
    const slug = toAnnouncementSlug(`${"a".repeat(ANNOUNCEMENT_SLUG_MAX_LENGTH - 1)} b`);
    expect(slug).toBe("a".repeat(ANNOUNCEMENT_SLUG_MAX_LENGTH - 1));
  });
});

describe("validateAnnouncementSlug", () => {
  it("allows an empty slug only when the API will generate one", () => {
    expect(validateAnnouncementSlug("", { allowEmpty: true })).toBeNull();
    expect(validateAnnouncementSlug("", { allowEmpty: false })).toMatch(/required/);
  });

  it("accepts a well-formed slug", () => {
    expect(validateAnnouncementSlug("summit-2026-recap", { allowEmpty: false })).toBeNull();
  });

  it.each(["Upper", "a--b", "-a", "a-", "a_b", "a b"])("rejects %j", (slug) => {
    expect(validateAnnouncementSlug(slug, { allowEmpty: false })).toMatch(/lowercase/);
  });

  it("rejects an over-long slug", () => {
    expect(validateAnnouncementSlug("a".repeat(ANNOUNCEMENT_SLUG_MAX_LENGTH + 1), { allowEmpty: false })).toMatch(
      /at most/,
    );
  });

  it("rejects a UUID-shaped slug, which the public site would treat as an id", () => {
    expect(validateAnnouncementSlug("20069fca-e516-429f-a3bc-e88d80ce2021", { allowEmpty: false })).toMatch(/ID/);
  });
});

describe("announcementPublicPath", () => {
  it("builds the participant-site path", () => {
    expect(announcementPublicPath("big-news")).toBe("/announcements/big-news");
  });
});

describe("slugConflictMessage", () => {
  it("explains a 409", () => {
    expect(slugConflictMessage({ status: 409 }, "big-news")).toMatch(/"big-news" is already used/);
  });

  it("ignores other errors", () => {
    expect(slugConflictMessage({ status: 400 }, "big-news")).toBeNull();
    expect(slugConflictMessage(new Error("boom"), "big-news")).toBeNull();
    expect(slugConflictMessage(null, "big-news")).toBeNull();
  });
});
