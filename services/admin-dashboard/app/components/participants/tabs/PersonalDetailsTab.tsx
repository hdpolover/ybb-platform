import React from "react";
import { InfoField } from "../InfoField";

export interface PersonalDetails {
  fullName: string;
  nickname: string;
  gender: string;
  birthDate: string;
  nationality: string;
  originAddress: string;
  currentAddress: string;
  phone: string;
  emergencyContactName: string;
  emergencyPhone: string;
  contactRelation: string;
  shirtSize: string;
  diseaseHistory: string;
}

export function PersonalDetailsTab({ data }: { data: PersonalDetails }) {
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Personal Details</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <InfoField label="Full Name" value={data.fullName} />
        <InfoField label="Nickname" value={data.nickname} />
        <InfoField label="Gender" value={data.gender} />
        <InfoField label="Birthdate" value={data.birthDate} />
        <InfoField label="Nationality" value={data.nationality} />
        <InfoField label="Origin Address" value={data.originAddress} />
        <InfoField label="Current Address" value={data.currentAddress} />
        <InfoField label="Phone Number" value={data.phone} />
        <InfoField label="Emergency Contact Name" value={data.emergencyContactName} />
        <InfoField label="Emergency Phone Number" value={data.emergencyPhone} />
        <InfoField label="Emergency Contact Relationship" value={data.contactRelation} />
        <InfoField label="T-Shirt Size" value={data.shirtSize} />
        <InfoField label="Disease History" value={data.diseaseHistory} />
      </div>
    </section>
  );
}