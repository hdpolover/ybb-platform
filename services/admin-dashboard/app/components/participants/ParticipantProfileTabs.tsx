"use client";

import React from "react";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { PersonalDetailsTab, PersonalDetails } from "./tabs/PersonalDetailsTab";
import { ProfessionalProfileTab, ProfessionalProfile } from "./tabs/ProfessionalProfileTab";
import { EntryInformationTab, EntryInformation } from "./tabs/EntryInformationTab";
import { MiscellaneousTab, Miscellaneous } from "./tabs/MiscellaneousTab";
import { EssaysTab, Essay } from "./tabs/EssaysTab";
import { SubmittedFormTab, SubmittedForm } from "./tabs/SubmittedFormTab";

const TABS = [
  { id: "personal", label: "Personal Details" },
  { id: "professional", label: "Professional Profile" },
  { id: "entry", label: "Entry Information" },
  { id: "misc", label: "Miscellaneous" },
  { id: "essays", label: "Essays" },
  { id: "submitted", label: "As Submitted" },
] as const;

const DEFAULT_TAB = "personal";

// ?tab=<id>: deep-links, survives reload and prev/next. New tab = one TABS line + one render line.
const tabParser = parseAsStringEnum(TABS.map((t) => t.id)).withDefault(DEFAULT_TAB).withOptions({ clearOnDefault: true });

export interface ParticipantTabsData {
  personal: PersonalDetails;
  professional: ProfessionalProfile;
  entry: EntryInformation;
  misc: Miscellaneous;
  essays: Essay[];
  submitted: SubmittedForm;
}

interface ParticipantProfileTabsProps {
  data: ParticipantTabsData;
}

export function ParticipantProfileTabs({ data }: ParticipantProfileTabsProps) {
  const [activeTab, setActiveTab] = useQueryState("tab", tabParser);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-4 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => void setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-2 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "personal" && <PersonalDetailsTab data={data.personal} />}
        {activeTab === "professional" && <ProfessionalProfileTab data={data.professional} />}
        {activeTab === "entry" && <EntryInformationTab data={data.entry} />}
        {activeTab === "misc" && <MiscellaneousTab data={data.misc} />}
        {activeTab === "essays" && <EssaysTab data={{ essays: data.essays }} />}
        {activeTab === "submitted" && <SubmittedFormTab data={data.submitted} />}
      </div>
    </div>
  );
}
