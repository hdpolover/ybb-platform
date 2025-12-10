import React from "react";
import { AnnouncementsTable } from "@/app/components/announcements/AnnouncementsTable";

export default function AnnouncementsPage() {
  return (
    <main className="space-y-3">
      <section className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-700 shadow-sm md:text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 md:text-base">Announcements</h1>
            <p className="text-[11px] text-zinc-500">
              Manage important program-wide announcements such as reminders, schedule updates, and logistics.
            </p>
          </div>
        </div>
      </section>

      <AnnouncementsTable />
    </main>
  );
}
