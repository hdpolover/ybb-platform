// services/admin-dashboard/app/components/participants/tabs/PersonalDetailsTab.tsx
import React from "react";
import type { ExtraField } from "@/lib/form-extra-fields";
import { InfoField } from "../InfoField";
import { ExtraFieldRows } from "../ExtraFieldRows";
import { whatsappActions } from "../IconActions";
import { InvalidPhoneFlag } from "../InvalidPhoneFlag";

export interface PersonalDetails {
  fullName: string;
  nickname: string;
  gender: string;
  birthDate: string;
  nationality: string;
  originAddress: string;
  currentAddress: string;
  /** Full international number, country code already included. */
  phone: string;
  /** API phone-format check; false = failed validation, null/undefined = unknown. */
  phoneValid?: boolean | null;
  emergencyContactName: string;
  /** Full international number, country code already included. */
  emergencyPhone: string;
  emergencyPhoneValid?: boolean | null;
  contactRelation: string;
  shirtSize: string;
  diseaseHistory: string;
  /** Other answered fields from the personal-type form sections. */
  extraFields: ExtraField[];
}

export function PersonalDetailsTab({ data }: { data: PersonalDetails }) {
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Personal Details</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <InfoField label="Full Name" value={data.fullName} copyValue={data.fullName} />
        <InfoField label="Nickname" value={data.nickname} />
        <InfoField label="Gender" value={data.gender} />
        <InfoField label="Birthdate" value={data.birthDate} />
        <InfoField label="Nationality" value={data.nationality} />
        <InfoField label="Origin Address" value={data.originAddress} copyValue={data.originAddress} />
        <InfoField label="Current Address" value={data.currentAddress} copyValue={data.currentAddress} />
        <InfoField
          label="Phone Number"
          value={data.phone}
          copyValue={data.phone}
          actions={whatsappActions(data.phone, data.phoneValid)}
          warning={<InvalidPhoneFlag valid={data.phoneValid} />}
        />
        <InfoField label="Emergency Contact Name" value={data.emergencyContactName} />
        <InfoField
          label="Emergency Phone Number"
          value={data.emergencyPhone}
          copyValue={data.emergencyPhone}
          actions={whatsappActions(data.emergencyPhone, data.emergencyPhoneValid)}
          warning={<InvalidPhoneFlag valid={data.emergencyPhoneValid} />}
        />
        <InfoField label="Emergency Contact Relationship" value={data.contactRelation} />
        <InfoField label="T-Shirt Size" value={data.shirtSize} />
        <InfoField label="Disease History" value={data.diseaseHistory} />
        <ExtraFieldRows fields={data.extraFields} />
      </div>
    </section>
  );
}
