// services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/EditProgramSpecificsModal.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditProgramSpecificsModal, type ProgramSpecificsFormValues } from "./EditProgramSpecificsModal";

vi.mock("next/navigation", () => ({ useParams: () => ({ programId: "p1" }) }));
vi.mock("@/src/admin/components/rich-text-editor", () => ({ RichTextEditor: () => null }));

const VALUES: ProgramSpecificsFormValues = {
  year: "2027",
  theme: "",
  startDate: "2027-05-10",
  endDate: "2027-05-13",
  applicationDeadline: "2027-04-12",
  status: "published",
  location: "Osaka, Japan",
  capacity: "",
  requirePayment: true,
  allowRegistration: false,
  registrationOpenDate: "2026-10-05T23:59",
  registrationCloseDate: "2027-04-10T23:59",
  requirementsDescription: "",
  benefitsDescription: "",
  termsAndConditions: "",
};

function renderModal(initialValues: ProgramSpecificsFormValues) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <EditProgramSpecificsModal
      programName="JYS"
      initialValues={initialValues}
      onSubmit={onSubmit}
      isSaving={false}
      errorMessage={null}
      onClose={() => {}}
    />,
  );
  return onSubmit;
}

describe("EditProgramSpecificsModal registration switch", () => {
  it("reflects registration being off and warns about it", () => {
    renderModal(VALUES);

    expect(screen.getByRole("switch", { name: "Accept registrations" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/turns away every new signup/i)).toBeInTheDocument();
  });

  it("submits allowRegistration true after the switch is turned on", async () => {
    const onSubmit = renderModal(VALUES);

    fireEvent.click(screen.getByRole("switch", { name: "Accept registrations" }));
    expect(screen.queryByText(/turns away every new signup/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ allowRegistration: true })),
    );
  });

  it("submits allowRegistration unchanged when the switch is not touched", async () => {
    const onSubmit = renderModal({ ...VALUES, allowRegistration: true });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ allowRegistration: true })),
    );
  });
});
