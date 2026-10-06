// services/admin-dashboard/app/components/settings/MainConfigurationSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MainConfigurationSettings } from "./MainConfigurationSettings";

const getProgramConfig = vi.fn();
const updateProgramConfig = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  getProgramConfig: (...args: unknown[]) => getProgramConfig(...args),
  updateProgramConfig: (...args: unknown[]) => updateProgramConfig(...args),
}));
vi.mock("@/app/hooks/useResolvedProgramId", () => ({ useResolvedProgramId: (id: string) => id }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CLOSED_CONFIG = {
  id: "p1",
  isActive: true,
  allowRegistration: false,
  requireEmailVerification: true,
  usdInIdr: null,
};

const renderSettings = () => render(<MainConfigurationSettings programId="p1" programName="JYS" />);
const registrationSwitch = () => screen.findByRole("switch", { name: "Accept registrations" });

describe("MainConfigurationSettings", () => {
  beforeEach(() => {
    getProgramConfig.mockReset();
    updateProgramConfig.mockReset();
  });

  it("shows the registration switch off when the program has registration off", async () => {
    getProgramConfig.mockResolvedValue(CLOSED_CONFIG);
    renderSettings();

    expect(await registrationSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("does not render switches from guessed defaults when loading fails", async () => {
    getProgramConfig.mockRejectedValue(new Error("boom"));
    renderSettings();

    expect(await screen.findByText("Settings could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("keeps Save disabled until a switch changes, then warns that nothing is saved yet", async () => {
    getProgramConfig.mockResolvedValue(CLOSED_CONFIG);
    renderSettings();
    const toggle = await registrationSwitch();
    const save = screen.getByRole("button", { name: "Save Changes" });

    expect(save).toBeDisabled();
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(save).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(/unsaved changes/i);
    expect(updateProgramConfig).not.toHaveBeenCalled();
  });

  it("persists the flipped switch on Save and clears the unsaved notice", async () => {
    getProgramConfig.mockResolvedValue(CLOSED_CONFIG);
    updateProgramConfig.mockResolvedValue({ ...CLOSED_CONFIG, allowRegistration: true });
    renderSettings();

    fireEvent.click(await registrationSwitch());
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(updateProgramConfig).toHaveBeenCalledWith("p1", {
        isActive: true,
        allowRegistration: true,
        requireEmailVerification: true,
      }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
  });

  it("Reset reverts a flipped switch without saving", async () => {
    getProgramConfig.mockResolvedValue(CLOSED_CONFIG);
    renderSettings();
    const toggle = await registrationSwitch();

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(updateProgramConfig).not.toHaveBeenCalled();
  });

  it("keeps the unsaved notice when the save fails", async () => {
    getProgramConfig.mockResolvedValue(CLOSED_CONFIG);
    updateProgramConfig.mockRejectedValue(new Error("nope"));
    renderSettings();

    fireEvent.click(await registrationSwitch());
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(updateProgramConfig).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled());
    expect(screen.getByRole("status")).toHaveTextContent(/unsaved changes/i);
  });
});
