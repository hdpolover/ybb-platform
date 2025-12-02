"use client";

import React from "react";
import { UserCircleIcon } from "@heroicons/react/24/solid";

interface FullyFundedParticipantProfileCardProps {
  name: string;
  participantId: string;
  fundingPath: string;
}

export function FullyFundedParticipantProfileCard({
  name,
  participantId,
  fundingPath,
}: FullyFundedParticipantProfileCardProps) {
  return (
    <section className="flex h-full flex-col rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          <UserCircleIcon className="h-4 w-4 text-blue-500" />
          Participant Detail
        </h2>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          {fundingPath}
        </span>
      </div>

      <div className="mt-2 flex flex-1 flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-xl font-semibold text-blue-600">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center text-sm">
          <div className="text-base font-semibold text-zinc-900">{name}</div>
          <div className="mt-1 text-[12px] text-zinc-500">Participant ID</div>
          <div className="text-sm font-semibold text-zinc-900">{participantId}</div>
        </div>
      </div>
    </section>
  );
}
