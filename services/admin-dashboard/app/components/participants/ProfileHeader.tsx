import React from "react";
import { EnvelopeIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { SendEmailButton } from "./SendEmailButton";
import Image from "next/image";

export interface ProfileHeaderData {
  accountId: string;
  name: string;
  avatarUrl: string;
  location: string;
  email: string;
  phone: string;
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
            <span className="text-xs font-medium text-zinc-500">Account ID: {data.accountId}</span>
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
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <PhoneIcon className="h-4 w-4" />
              <span>{data.phone}</span>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <SendEmailButton email={data.email} />
        </div>
      </div>
      </div>
    </div>
  );
}
