"use client";

import React from "react";
import { UserCircleIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/solid";

interface ParticipantCardProps {
  name: string;
  email: string;
  participantId: string;
  phone?: string | null;
}

export function ParticipantCard({ name, email, participantId, phone }: ParticipantCardProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          <UserCircleIcon className="h-4 w-4 text-blue-500" />
          Participant
        </h2>
        <button
          type="button"
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          See Profile
        </button>
      </div>

      <div className="mt-2 flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-xl font-semibold text-blue-600">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center text-sm">
          <div className="text-base font-semibold text-zinc-900">{name}</div>
          <div className="mt-1 inline-flex items-center justify-center gap-1 rounded-full bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600">
            <EnvelopeIcon className="h-3 w-3" />
            {email}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-3 text-xs text-zinc-700">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Participant ID</div>
          <div className="mt-1 font-semibold text-zinc-900">#{participantId}</div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center justify-end gap-1 text-zinc-500">
            <PhoneIcon className="h-3 w-3" />
            <span>{phone ?? "N/A"}</span>
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">Phone</div>
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
        >
          <EnvelopeIcon className="h-3.5 w-3.5" />
          Email
        </button>
      </div>
    </section>
  );
}
