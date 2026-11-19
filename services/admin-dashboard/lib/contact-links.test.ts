// services/admin-dashboard/lib/contact-links.test.ts
import { describe, expect, it } from "vitest";
import { instagramLink, isHttpUrl, whatsappUrl } from "./contact-links";

describe("isHttpUrl", () => {
  it("accepts http(s) urls only", () => {
    expect(isHttpUrl("https://x.dev/a")).toBe(true);
    expect(isHttpUrl(" http://x.dev ")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://x.dev has space")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});

describe("whatsappUrl", () => {
  it("builds a wa.me link from an international number", () => {
    expect(whatsappUrl("+923347354006")).toBe("https://wa.me/923347354006");
    expect(whatsappUrl(" +62 812-3456-7890 ")).toBe("https://wa.me/6281234567890");
  });
  it("returns null without + prefix or with a bad digit count", () => {
    expect(whatsappUrl("923347354006")).toBeNull();
    expect(whatsappUrl("+1234567")).toBeNull();
    expect(whatsappUrl("+1234567890123456")).toBeNull();
    expect(whatsappUrl(undefined)).toBeNull();
  });
});

describe("instagramLink", () => {
  it("parses handle from an instagram url and keeps href as-is", () => {
    expect(instagramLink("https://www.instagram.com/some.user/?hl=en")).toEqual({
      display: "@some.user",
      href: "https://www.instagram.com/some.user/?hl=en",
    });
  });
  it("links handle-like values", () => {
    expect(instagramLink("@some_user")).toEqual({ display: "@some_user", href: "https://www.instagram.com/some_user/" });
    expect(instagramLink("plainhandle ")).toEqual({ display: "@plainhandle", href: "https://www.instagram.com/plainhandle/" });
  });
  it("does not build a url from names with spaces", () => {
    expect(instagramLink("Abdullah FAKHAR ")).toEqual({ display: "Abdullah FAKHAR", href: null });
  });
  it("does not link non-instagram urls", () => {
    expect(instagramLink("https://example.com/x")).toEqual({ display: "https://example.com/x", href: null });
  });
  it("returns empty for blank input", () => {
    expect(instagramLink(null)).toEqual({ display: "", href: null });
  });
});
