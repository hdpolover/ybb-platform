"use client";

import { useMemo, useState } from "react";
import { MenuManagementHeader } from "./menuManagement/MenuManagementHeader";
import { MenuManagementTable } from "./menuManagement/MenuManagementTable";

export type MenuItemStatus = "Active" | "Inactive";

export type MenuItemRow = {
  id: number;
  sortOrder: number;
  label: string;
  url: string;
  requiredPermission: string;
  status: MenuItemStatus;
};

export type MenuManagementProps = {
  programName: string;
};

const mockMenuItems: MenuItemRow[] = [
  {
    id: 1,
    sortOrder: 1,
    label: "Dashboard",
    url: "/dashboard",
    requiredPermission: "view_dashboard",
    status: "Active",
  },
  {
    id: 2,
    sortOrder: 2,
    label: "Participants",
    url: "/participants",
    requiredPermission: "view_participants",
    status: "Active",
  },
  {
    id: 3,
    sortOrder: 3,
    label: "Payments",
    url: "/payments",
    requiredPermission: "view_payments",
    status: "Active",
  },
  {
    id: 4,
    sortOrder: 4,
    label: "Admin Management",
    url: "/settings/admin-management",
    requiredPermission: "manage_admins",
    status: "Inactive",
  },
];

export function MenuManagement({ programName }: MenuManagementProps) {
  const [items, setItems] = useState<MenuItemRow[]>(mockMenuItems);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);

  const totalItems = items.length;
  const activeItems = items.filter((item) => item.status === "Active").length;
  const protectedItems = items.filter((item) => item.requiredPermission !== "").length;
  const permissions = useMemo(
    () => new Set(items.map((item) => item.requiredPermission).filter(Boolean)).size,
    [items],
  );

  const handleDelete = (id: number) => {
    // Placeholder: just remove locally & log
    const target = items.find((item) => item.id === id);
    console.log("Delete menu item (mock):", target);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmitItem = (payload: Omit<MenuItemRow, "id"> & { id?: number }) => {
    if (editingItem) {
      const updated: MenuItemRow = {
        id: editingItem.id,
        sortOrder: payload.sortOrder,
        label: payload.label,
        url: payload.url,
        requiredPermission: payload.requiredPermission,
        status: payload.status,
      };

      setItems((previous) => previous.map((item) => (item.id === editingItem.id ? updated : item)));
      console.log("Edit menu item:", updated);
    } else {
      const newId = items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;
      const created: MenuItemRow = {
        id: newId,
        sortOrder: payload.sortOrder,
        label: payload.label,
        url: payload.url,
        requiredPermission: payload.requiredPermission,
        status: payload.status,
      };

      setItems((previous) => [...previous, created]);
      console.log("Create menu item:", created);
    }

    setShowFormModal(false);
    setEditingItem(null);
  };

  return (
    <main className="space-y-4 text-sm md:text-base">
      <MenuManagementHeader
        programName={programName}
        totalItems={totalItems}
        activeItems={activeItems}
        protectedItems={protectedItems}
        permissions={permissions}
      />

      <MenuManagementTable
        items={items}
        onAddItem={() => {
          setEditingItem(null);
          setShowFormModal(true);
        }}
        onEditItem={(item) => {
          setEditingItem(item);
          setShowFormModal(true);
        }}
        onDeleteItem={handleDelete}
      />

      {showFormModal && (
        <MenuItemFormModal
          isOpen={showFormModal}
          item={editingItem}
          onClose={() => {
            setShowFormModal(false);
            setEditingItem(null);
          }}
          onSubmit={handleSubmitItem}
        />
      )}
    </main>
  );
}

type MenuItemFormModalProps = {
  isOpen: boolean;
  item: MenuItemRow | null;
  onClose: () => void;
  onSubmit: (payload: Omit<MenuItemRow, "id"> & { id?: number }) => void;
};

function MenuItemFormModal({ isOpen, item, onClose, onSubmit }: MenuItemFormModalProps) {
  const isEditMode = Boolean(item);

  const [sortOrder, setSortOrder] = useState<number>(() => item?.sortOrder ?? 1);
  const [label, setLabel] = useState(() => item?.label ?? "");
  const [url, setUrl] = useState(() => item?.url ?? "");
  const [requiredPermission, setRequiredPermission] = useState(
    () => item?.requiredPermission ?? "",
  );
  const [status, setStatus] = useState<MenuItemStatus>(() => item?.status ?? "Active");

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const payload: Omit<MenuItemRow, "id"> & { id?: number } = {
      sortOrder,
      label,
      url,
      requiredPermission,
      status,
      id: item?.id,
    };

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Menu Item" : "Add Menu Item"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the label, URL, permission, and status for this menu item."
                : "Create a new menu item and define its sort order, URL, and required permission."}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Sort Order <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={sortOrder}
                  onChange={(event) => setSortOrder(Number(event.target.value) || 1)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., 1"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Menu Item <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Dashboard"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., /submissions/essays"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Required Permission
                </label>
                <input
                  type="text"
                  value={requiredPermission}
                  onChange={(event) => setRequiredPermission(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., view_dashboard"
                />
                <p className="mt-1 text-[10px] text-zinc-400">
                  Leave empty if the menu is visible to all admins.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as MenuItemStatus)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
            >
              {isEditMode ? "Save Changes" : "Add Menu Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
