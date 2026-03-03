import React from "react";
import { InfoField } from "../InfoField";
import { DownloadCvButton } from "../DownloadCvButton";

export interface ProfessionalProfile {
  educationLevel: string;
  institution: string;
  major: string;
  organization: string;
  experience: { role: string; company: string }[];
  achievements: string[];
  cvFileName: string;
}

export function ProfessionalProfileTab({ data }: { data: ProfessionalProfile }) {
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Professional Profile</h3>
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <InfoField label="Education Level" value={data.educationLevel} />
          <InfoField label="Institution" value={data.institution} />
          <InfoField label="Major" value={data.major} />
          <InfoField label="Organization" value={data.organization} />
        </div>

        <section>
          <h3 className="mb-3 text-xs font-medium text-zinc-500">Experiences</h3>
          <ul className="list-inside list-disc space-y-2 text-sm font-semibold text-zinc-900">
            {data.experience.map((exp, idx) => (
              <li key={idx}>
                {exp.role} <span className="font-medium text-zinc-500">at</span> {exp.company}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-medium text-zinc-500">Achievements & Awards</h3>
          <ul className="list-inside list-disc space-y-2 text-sm font-semibold text-zinc-900">
            {data.achievements.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="max-w-md">
          <h3 className="mb-3 text-xs font-medium text-zinc-500">Resume</h3>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-900">{data.cvFileName}</span>
              <span className="text-xs font-medium text-zinc-500">PDF Document</span>
            </div>
            <DownloadCvButton fileName={data.cvFileName} />
          </div>
        </section>
      </div>
    </section>
  );
}