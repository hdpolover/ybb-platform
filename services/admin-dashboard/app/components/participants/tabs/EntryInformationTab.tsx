import React from "react";
import { InfoField } from "../InfoField";

export interface EntryInformation {
  category: string;
  subtheme: string;
  source: string;
  reference: string;
}

export function EntryInformationTab({ data }: { data: EntryInformation }) {
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Entry Information</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <InfoField label="Participation Category" value={data.category} />
        <InfoField label="Program Subtheme" value={data.subtheme} />
        <InfoField label="Knowledge Source" value={data.source} />
        <InfoField label="Reference" value={data.reference} />
      </div>
    </section>
  );
}