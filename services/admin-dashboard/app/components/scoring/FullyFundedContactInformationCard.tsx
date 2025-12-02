"use client";

import React from "react";
import {
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  UserIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/solid";

interface FullyFundedContactInformationCardProps {
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  gender: string;
  institution: string;
  onEditProfile?: () => void;
  onExportData?: () => void;
}

export function FullyFundedContactInformationCard({
  fullName,
  email,
  phone,
  nationality,
  gender,
  institution,
  onEditProfile,
  onExportData,
}: FullyFundedContactInformationCardProps) {
  return (
    <section className="flex h-full flex-col rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          <UserIcon className="h-4 w-4 text-blue-500" />
          Contact Information
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            onClick={onEditProfile}
          >
            Edit Profile
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={onExportData}
          >
            Export Data
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-zinc-700 md:text-sm">
        <div>
          <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <UserIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Full Name</span>
          </dt>
          <dd className="mt-0.5 font-semibold text-zinc-900">{fullName}</dd>
        </div>
        <div>
          <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <EnvelopeIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Email</span>
          </dt>
          <dd className="mt-0.5 font-semibold text-zinc-900 break-all">{email}</dd>
        </div>
        <div>
          <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <PhoneIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Phone</span>
          </dt>
          <dd className="mt-0.5 font-semibold text-zinc-900">{phone}</dd>
        </div>
        <div>
          <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <GlobeAltIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Nationality</span>
          </dt>
          <dd className="mt-0.5 font-semibold text-zinc-900">{nationality}</dd>
        </div>
        <div>
          <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <UserIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Gender</span>
          </dt>
          <dd className="mt-0.5 font-semibold text-zinc-900">{gender}</dd>
        </div>
        <div>
          <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <BuildingOffice2Icon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Institution</span>
          </dt>
          <dd className="mt-0.5 font-semibold text-zinc-900">{institution}</dd>
        </div>
      </dl>
    </section>
  );
}
