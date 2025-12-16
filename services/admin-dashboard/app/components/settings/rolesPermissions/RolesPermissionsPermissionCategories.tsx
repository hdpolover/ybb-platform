"use client";

import { PermissionCategory } from "../RolesPermissionsSettings";


export type RolesPermissionsPermissionCategoriesProps = {
  categories: PermissionCategory[];
};

export function RolesPermissionsPermissionCategories({
  categories,
}: RolesPermissionsPermissionCategoriesProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">
            Permission Categories
          </h2>
          <p className="text-[11px] text-zinc-500 md:text-xs">
            Explore how granular permissions are grouped by area of responsibility.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex flex-col justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">
                  {category.icon}
                </span>
                <div>
                  <div className="text-xs font-semibold text-zinc-900">
                    {category.name}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {category.permissions.length} permissions
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {category.permissions.map((permission) => (
                <span
                  key={permission}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-mono text-zinc-700 ring-1 ring-zinc-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span className="truncate">{permission}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
