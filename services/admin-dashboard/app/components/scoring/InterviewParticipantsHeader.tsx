"use client";

import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";

interface InterviewParticipantsHeaderProps {
  onSearch?: (value: string) => void;
}

export function InterviewParticipantsHeader({ onSearch }: InterviewParticipantsHeaderProps) {
  const [value, setValue] = React.useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSearch?.(value.trim());
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="mb-3">
        <h1 className="text-base font-semibold text-zinc-900">Participants go to Interview</h1>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          List of shortlisted participants for the interview stage.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search by name, email, account ID, nationality..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
          >
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            Search
          </button>
        </div>
      </form>
    </section>
  );
}
