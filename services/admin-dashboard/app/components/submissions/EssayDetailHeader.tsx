"use client";

import React from "react";

type EssayDetailHeaderProps = {
  name: string;
  email: string;
  participantId: string;
  category: "Fully Funded" | "Self Funded";
  onViewProfile?: () => void;
};

export function EssayDetailHeader({
  name,
  email,
  participantId,
  category,
  onViewProfile,
}: EssayDetailHeaderProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
            {initial}
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900">{name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <p className="text-[12px] text-zinc-500">{email}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span>Essay Participant</span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span>Participant ID: {participantId}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{category}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewProfile}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>View Full Profile</span>
          </button>
        </div>
      </div>
    </section>
  );
}
