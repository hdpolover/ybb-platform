"use client";

import type { MenuItemRow } from "../MenuManagement";
import { PencilSquareIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";

export type MenuManagementTableProps = {
  items: MenuItemRow[];
  onAddItem: () => void;
  onEditItem: (item: MenuItemRow) => void;
  onDeleteItem: (id: number) => void;
};

export function MenuManagementTable({
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: MenuManagementTableProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Menu Items</h2>
          <p className="text-[11px] text-zinc-500 md:text-xs">
            Define menu items, their URLs, and which permissions are required to access them.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={onAddItem}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Menu Item</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[11px] md:text-xs">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <th className="w-20 px-3 py-2">Sort Order</th>
              <th className="px-3 py-2">Menu Item</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Required Permission</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-[11px] text-zinc-500"
                >
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No menu items configured</span>
                    <span className="text-[10px] text-zinc-400">
                      Use the Add Menu Item button to start configuring navigation.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-500">
                    {item.sortOrder}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-900 md:text-xs">
                    {item.label}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-blue-700 md:text-xs">
                    {item.url}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-700 md:text-xs">
                    {item.requiredPermission || "-"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.status === "Active" ? "bg-emerald-400" : "bg-zinc-400"
                        }`}
                      />
                      <span>{item.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit menu item"
                        onClick={() => onEditItem(item)}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete menu item"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
