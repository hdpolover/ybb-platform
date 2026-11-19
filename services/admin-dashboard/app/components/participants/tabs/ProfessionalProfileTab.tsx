// services/admin-dashboard/app/components/participants/tabs/ProfessionalProfileTab.tsx
import React from "react";
import { ExternalLink } from "lucide-react";
import { isHttpUrl } from "@/lib/contact-links";
import type { ExtraField } from "@/lib/form-extra-fields";
import { InfoField } from "../InfoField";
import { ExtraFieldRows } from "../ExtraFieldRows";
import { CopyButton, isPresent } from "../IconActions";

// A lone plain-text entry longer than this is prose, not a bullet.
const PARAGRAPH_MIN_CHARS = 80;

export interface ProfessionalProfile {
  educationLevel: string;
  institution: string;
  major: string;
  occupation: string;
  organization: string;
  /** Entries parsed from plain text have an empty company. */
  experience: { role: string; company: string }[];
  achievements: string[];
  /** Resume URL, or pasted CV text when the program form uses a text field. */
  resume: string;
  /** Other answered fields from the professional form section. */
  extraFields: ExtraField[];
}

function isLoneParagraph(items: string[]): boolean {
  return items.length === 1 && items[0].length >= PARAGRAPH_MIN_CHARS;
}

function ListBlock({ title, items, children }: { title: string; items: string[]; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-zinc-500">{title}</h3>
      {items.length === 0 ? (
        <span className="text-sm font-semibold text-zinc-900">—</span>
      ) : isLoneParagraph(items) ? (
        <p className="whitespace-pre-wrap text-sm font-semibold text-zinc-900">{items[0]}</p>
      ) : (
        <ul className="list-inside list-disc space-y-2 text-sm font-semibold text-zinc-900">{children}</ul>
      )}
    </section>
  );
}

function ResumeBlock({ resume }: { resume: string }) {
  const value = resume.trim();
  return (
    <section className="max-w-md">
      <h3 className="mb-3 text-xs font-medium text-zinc-500">Resume</h3>
      {!isPresent(value) ? (
        <span className="text-sm font-semibold text-zinc-900">—</span>
      ) : isHttpUrl(value) ? (
        <div className="flex items-center gap-1">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open resume
          </a>
          <CopyButton text={value} label="Resume link" />
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50/50 p-4 text-sm text-zinc-900">
            {value}
          </p>
          <CopyButton text={value} label="Resume text" />
        </div>
      )}
    </section>
  );
}

export function ProfessionalProfileTab({ data }: { data: ProfessionalProfile }) {
  const experienceTexts = data.experience.map((e) => (e.company ? "" : e.role));
  const achievementTexts = data.achievements;

  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Professional Profile</h3>
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <InfoField label="Education Level" value={data.educationLevel} />
          <InfoField label="Institution" value={data.institution} />
          <InfoField label="Major" value={data.major} />
          <InfoField label="Occupation" value={data.occupation} />
          <InfoField label="Organization" value={data.organization} />
          <ExtraFieldRows fields={data.extraFields} />
        </div>

        <ListBlock title="Experiences" items={experienceTexts}>
          {data.experience.map((exp, idx) => (
            <li key={idx}>
              {exp.role}
              {exp.company && (
                <>
                  {" "}
                  <span className="font-medium text-zinc-500">at</span> {exp.company}
                </>
              )}
            </li>
          ))}
        </ListBlock>

        <ListBlock title="Achievements & Awards" items={achievementTexts}>
          {data.achievements.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ListBlock>

        <ResumeBlock resume={data.resume} />
      </div>
    </section>
  );
}
