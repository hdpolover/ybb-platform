// services/admin-dashboard/app/platform/brands/[brandId]/edit/BrandEmailTab.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrandEmailTab, toThemePayload } from "./BrandEmailTab";

const getBrandEmailTheme = vi.fn();
const saveBrandEmailTheme = vi.fn();
const resyncBrandEmailTheme = vi.fn();
const getBrandEmailPreviewHtml = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  getBrandEmailTheme: (...a: unknown[]) => getBrandEmailTheme(...a),
  saveBrandEmailTheme: (...a: unknown[]) => saveBrandEmailTheme(...a),
  resyncBrandEmailTheme: (...a: unknown[]) => resyncBrandEmailTheme(...a),
  getBrandEmailPreviewHtml: (...a: unknown[]) => getBrandEmailPreviewHtml(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const RESPONSE = {
  theme: { fromName: "YBB News", footerText: "Bye", buttonStyle: "pill" },
  effective: {
    brandName: "YBB",
    fromName: "YBB",
    fromLocalPart: "ybb",
    fromEmail: "ybb@news.youthbreaktheboundaries.com",
    replyTo: null,
    bannerUrl: null,
    footerText: "default footer",
    primaryColor: "#112233",
    secondaryColor: "#1F2937",
    buttonStyle: "rounded",
  },
  sync: { state: "never" },
};

describe("BrandEmailTab", () => {
  beforeEach(() => {
    getBrandEmailTheme.mockReset().mockResolvedValue(RESPONSE);
    saveBrandEmailTheme.mockReset().mockResolvedValue(RESPONSE);
    getBrandEmailPreviewHtml.mockReset().mockResolvedValue("<p>preview</p>");
    resyncBrandEmailTheme.mockReset();
  });

  it("sends every field on save, with '' for cleared ones", async () => {
    render(<BrandEmailTab brandId="b1" />);
    const fromName = await screen.findByLabelText("From name");
    fireEvent.change(fromName, { target: { value: "  Changed  " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveBrandEmailTheme).toHaveBeenCalledTimes(1));
    expect(saveBrandEmailTheme).toHaveBeenCalledWith("b1", {
      fromName: "Changed",
      fromLocalPart: "",
      replyTo: "",
      bannerUrl: "",
      footerText: "Bye",
      secondaryColor: "",
      buttonStyle: "pill",
    });
  });

  it("shows effective defaults as placeholders, a read-only domain and a sandboxed preview", async () => {
    render(<BrandEmailTab brandId="b1" />);
    expect(await screen.findByPlaceholderText("ybb")).toBeInTheDocument();
    expect(screen.getByText("@news.youthbreaktheboundaries.com")).toBeInTheDocument();
    const frame = await screen.findByTitle("Email preview");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("srcdoc", "<p>preview</p>");
  });
});

describe("toThemePayload", () => {
  it("lowercases the local part and trims text", () => {
    const out = toThemePayload({
      fromName: " a ", fromLocalPart: " News ", replyTo: "", bannerUrl: "",
      footerText: "", secondaryColor: "", buttonStyle: "",
    });
    expect(out.fromLocalPart).toBe("news");
    expect(out.fromName).toBe("a");
  });
});
