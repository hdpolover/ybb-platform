"use client";

import React from "react";
import { UserCircleIcon, PencilIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

interface FullyFundedHeaderCardProps {
  fullName: string;
  participantId: string;
  fundingPath: string;
  email: string;
  phone: string;
  nationality: string;
  gender: string;
  institution: string;
  onEditProfile?: () => void;
  onExportData?: () => void;
}

export function FullyFundedHeaderCard({
  fullName,
  participantId,
  fundingPath,
  email,
  phone,
  nationality,
  gender,
  institution,
  onEditProfile,
  onExportData,
}: FullyFundedHeaderCardProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm md:flex-row">
      <div className="flex flex-col items-center justify-center border-b border-zinc-100 p-8 md:w-[340px] md:border-b-0 md:border-r">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600 shadow-inner ring-4 ring-white">
          {fullName.charAt(0).toUpperCase()}
        </div>
        
        <h2 className="mt-5 text-center text-sm font-bold uppercase text-zinc-900">{fullName}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <UserCircleIcon className="h-4 w-4" />
          <span>ID: {participantId}</span>
        </div>
        
        <span className="mt-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 border border-emerald-100">
          {fundingPath}
        </span>

        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onEditProfile}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Edit Profile
          </button>
          
          <button
            type="button"
            onClick={onExportData}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            Export Data
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 md:p-8">
        <h3 className="text-base font-semibold text-zinc-900">Contact Information</h3>
        
        <dl className="mt-6 space-y-4">
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
            <dt className="mt-0.5 text-xs font-medium text-zinc-500">Full Name</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900 sm:mt-0">{fullName}</dd>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
            <dt className="mt-0.5 text-xs font-medium text-zinc-500">Email</dt>
            <dd className="mt-1 break-all text-sm font-semibold text-zinc-900 sm:mt-0">{email}</dd>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
            <dt className="mt-0.5 text-xs font-medium text-zinc-500">Phone</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900 sm:mt-0">{phone}</dd>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
            <dt className="mt-0.5 text-xs font-medium text-zinc-500">Nationality</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900 sm:mt-0">{nationality}</dd>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
            <dt className="mt-0.5 text-xs font-medium text-zinc-500">Gender</dt>
            <dd className="mt-1 text-sm font-semibold capitalize text-zinc-900 sm:mt-0">{gender}</dd>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
            <dt className="mt-0.5 text-xs font-medium text-zinc-500">Institution</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900 sm:mt-0">{institution}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}