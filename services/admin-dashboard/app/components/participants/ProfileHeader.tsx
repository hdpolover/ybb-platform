// services/admin-dashboard/app/components/participants/ProfileHeader.tsx
import React from "react";
import { EnvelopeIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { SendEmailButton } from "./SendEmailButton";
import { CopyButton, IconActions, whatsappActions } from "./IconActions";
import { FfResultBadge } from "./FfResult";
import Image from "next/image";
import type { FundingDecision } from "@/src/shared/api-client";
import { PAYMENT_BADGE, STATUS_BADGE, STATUS_LABEL, humanizeStatus } from "@/lib/application-badges";
import { formatDate } from "@/lib/utils";

export interface ProfileHeaderData {
  accountId: string;
  name: string;
  avatarUrl: string;
  location: string;
  email: string;
  /** Full international number, country code already included. */
  phone: string;
  status: string;
  applicationCategory: string;
  createdAt: string;
  updatedAt: string;
  registrationPaymentStatus: string;
  programPaymentStatus: string;
  fundingDecision: FundingDecision | null | undefined;
}

const CHIP_CLASS = "rounded-full px-2 py-0.5 text-[10px] font-semibold";
const NEUTRAL_CHIP = "bg-zinc-100 text-zinc-600";

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
      {label}
      {children}
    </span>
  );
}

function ApplicationSummary({ data }: { data: ProfileHeaderData }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Chip label="Status">
        <span className={`${CHIP_CLASS} ${STATUS_BADGE[data.status] ?? NEUTRAL_CHIP}`}>
          {STATUS_LABEL[data.status] ?? humanizeStatus(data.status)}
        </span>
      </Chip>
      <Chip label="Registration">
        <span className={`${CHIP_CLASS} ${PAYMENT_BADGE[data.registrationPaymentStatus] ?? NEUTRAL_CHIP}`}>
          {humanizeStatus(data.registrationPaymentStatus)}
        </span>
      </Chip>
      <Chip label="Program">
        <span className={`${CHIP_CLASS} ${PAYMENT_BADGE[data.programPaymentStatus] ?? NEUTRAL_CHIP}`}>
          {humanizeStatus(data.programPaymentStatus)}
        </span>
      </Chip>
      {data.applicationCategory === "fully_funded" && (
        <Chip label="FF result">
          <FfResultBadge category={data.applicationCategory} decision={data.fundingDecision} />
        </Chip>
      )}
      <Chip label="Applied">
        <span className={`${CHIP_CLASS} ${NEUTRAL_CHIP}`}>{formatDate(data.createdAt)}</span>
      </Chip>
      <Chip label="Updated">
        <span className={`${CHIP_CLASS} ${NEUTRAL_CHIP}`}>{formatDate(data.updatedAt)}</span>
      </Chip>
    </div>
  );
}

export function ProfileHeader({ data }: { data: ProfileHeaderData }) {
  const DEFAULT_AVATAR = "/avatar-default.svg";
  const imageSource = data.avatarUrl || DEFAULT_AVATAR;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-200 shadow-sm">
        <Image 
          src={imageSource} 
          alt={data.name}
          width={96} 
          height={96} 
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{data.name}</h1>
          
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex items-center gap-1 text-xs font-medium text-zinc-500">
              Account ID: {data.accountId}
              <CopyButton text={data.accountId} label="Account ID" />
            </span>
            <span className="hidden text-zinc-300 sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <MapPinIcon className="h-4 w-4" />
              <span>{data.location}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:gap-6">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <EnvelopeIcon className="h-4 w-4" />
              <span>{data.email}</span>
              <IconActions copyValue={data.email} copyLabel="Email" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <PhoneIcon className="h-4 w-4" />
              <span>{data.phone}</span>
              <IconActions copyValue={data.phone} copyLabel="Phone number" actions={whatsappActions(data.phone)} />
            </div>
          </div>

          <ApplicationSummary data={data} />
        </div>

        <div className="mt-2">
          <SendEmailButton email={data.email} />
        </div>
      </div>
      </div>
    </div>
  );
}
