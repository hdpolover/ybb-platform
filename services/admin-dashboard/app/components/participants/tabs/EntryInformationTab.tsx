import React from "react";
import { InfoField } from "../InfoField";

export interface EntryInformation {
  category: string;
  subtheme: string;
  source: string;
  essayTitle: string;
  essayContent: string;
  keywords: string[];
  reference: string;
}

export function EntryInformationTab({ data }: { data: EntryInformation }) {
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Entry Information</h3>
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <InfoField label="Participation Category" value={data.category} />
          <InfoField label="Program subtheme" value={data.subtheme} />
          <InfoField label="Knowledge Source" value={data.source} />
        </div>

        <div className="border-t border-zinc-200" />

        <InfoField label="Essay Title" value={data.essayTitle} />
        
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Essay</span>
          <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-900">
            {data.essayContent}
          </p>
        </div>
        
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-500">Keywords</span>
          <div className="flex flex-wrap gap-2">
            {data.keywords.map((keyword, idx) => (
              <span key={idx} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {keyword}
              </span>
            ))}
          </div>
        </div>

        <InfoField label="Reference" value={data.reference} />
      </div>
    </section>
  );
}