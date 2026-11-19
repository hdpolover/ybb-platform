// services/admin-dashboard/app/components/settings/adminManagement/AccessRequestsPanel.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessRequestsPanel } from "./AccessRequestsPanel";

const listAccessRequests = vi.fn();
let auth: { adminProfile: { id: string }; accessiblePrograms: never[]; accessConfig: { canManageAdmins: boolean } };

vi.mock("@/app/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/src/shared/api-client", () => ({
  listAccessRequests: (...a: unknown[]) => listAccessRequests(...a),
  listAdminRoles: () => Promise.resolve([]),
}));

const base = {
  whatsapp: null,
  division: "ops",
  divisionLabel: "Operations",
  defaultRoleId: null,
  defaultRoleName: null,
  requestedPrograms: [],
  note: null,
  createdAt: "2026-11-19T00:00:00Z",
  reviewedAt: null,
  reviewedByName: null,
  rejectReason: null,
};
const PENDING = { ...base, id: "r1", fullName: "New Person", email: "new@example.com", status: "pending", existingAdminId: null };
const EXISTING = { ...base, id: "r2", fullName: "Old Hand", email: "old@example.com", status: "pending", existingAdminId: "admin-9" };

describe("AccessRequestsPanel", () => {
  beforeEach(() => {
    listAccessRequests.mockReset();
    auth = { adminProfile: { id: "me" }, accessiblePrograms: [], accessConfig: { canManageAdmins: true } };
  });

  it("uses EmptyState when there are no requests", async () => {
    listAccessRequests.mockResolvedValue([]);
    render(<AccessRequestsPanel onChanged={vi.fn()} />);
    expect(await screen.findByText("No pending requests")).toBeInTheDocument();
  });

  it("offers Approve/Reject for new requests and a password link for existing admins", async () => {
    listAccessRequests.mockResolvedValue([PENDING, EXISTING]);
    render(<AccessRequestsPanel onChanged={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    expect(screen.getByText("Already an admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send password link" })).toBeInTheDocument();
  });

  it("hides the password link when the actor cannot manage admins", async () => {
    auth.accessConfig.canManageAdmins = false;
    listAccessRequests.mockResolvedValue([EXISTING]);
    render(<AccessRequestsPanel onChanged={vi.fn()} />);

    expect(await screen.findByText("Already an admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send password link" })).not.toBeInTheDocument();
  });

  it("hides the password link on the actor's own admin row", async () => {
    listAccessRequests.mockResolvedValue([{ ...EXISTING, existingAdminId: "me" }]);
    render(<AccessRequestsPanel onChanged={vi.fn()} />);

    expect(await screen.findByText("Already an admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send password link" })).not.toBeInTheDocument();
  });
});
