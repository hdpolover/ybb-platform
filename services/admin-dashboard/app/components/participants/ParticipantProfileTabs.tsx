"use client";

import React from "react";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { PersonalDetailsTab, PersonalDetails } from "./tabs/PersonalDetailsTab";
import { ProfessionalProfileTab, ProfessionalProfile } from "./tabs/ProfessionalProfileTab";
import { EntryInformationTab, EntryInformation } from "./tabs/EntryInformationTab";
import { MiscellaneousTab, Miscellaneous } from "./tabs/MiscellaneousTab";
import { EssaysTab, Essay } from "./tabs/EssaysTab";
import { SubmittedFormTab, SubmittedForm } from "./tabs/SubmittedFormTab";
import { PaymentsTab } from "./tabs/PaymentsTab";
import { EditHistoryTab } from "./tabs/EditHistoryTab";
import type { FieldFormatShape } from "@/lib/field-value-format";

const TABS = [
  { id: "personal", label: "Personal Details" },
  { id: "professional", label: "Professional Profile" },
  { id: "entry", label: "Entry Information" },
  { id: "misc", label: "Miscellaneous" },
  { id: "essays", label: "Essays" },
  { id: "payments", label: "Payments" },
  { id: "history", label: "Edit History" },
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

/** Inputs for the tabs that fetch their own data on first open. */
export interface ParticipantRemoteTabsContext {
  programId: string;
  applicationId: string;
  /** buildChangeLabels(...) for the Edit History tab. */
  changeLabels: ReadonlyMap<string, string>;
  /** buildChangeFields(...): formats edit-history values in Edit History and As Submitted. */
  changeFields: ReadonlyMap<string, FieldFormatShape>;
  /** Pre-fills the payments page search when the Payments tab can't show every invoice. */
  participantEmail?: string;
}

interface ParticipantProfileTabsProps {
  data: ParticipantTabsData;
  remote: ParticipantRemoteTabsContext;
}

export function ParticipantProfileTabs({ data, remote }: ParticipantProfileTabsProps) {
  const [activeTab, setActiveTab] = useQueryState("tab", tabParser);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="border-b border-zinc-200">
        {/* Wraps instead of scrolling: a horizontal scroller showed a scrollbar and clipped the last tab. */}
        <nav className="-mb-px flex flex-wrap gap-x-4 gap-y-1">
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

      {/* min-h: a short tab (or a loading one) doesn't collapse the page and yank the scroll position. */}
      <div className="mt-6 min-h-[28rem] animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "personal" && <PersonalDetailsTab data={data.personal} />}
        {activeTab === "professional" && <ProfessionalProfileTab data={data.professional} />}
        {activeTab === "entry" && <EntryInformationTab data={data.entry} />}
        {activeTab === "misc" && <MiscellaneousTab data={data.misc} />}
        {activeTab === "essays" && <EssaysTab data={{ essays: data.essays }} />}
        {activeTab === "payments" && (
          <PaymentsTab
            programId={remote.programId}
            applicationId={remote.applicationId}
            participantEmail={remote.participantEmail}
          />
        )}
        {activeTab === "history" && (
          <EditHistoryTab
            applicationId={remote.applicationId}
            changeLabels={remote.changeLabels}
            changeFields={remote.changeFields}
          />
        )}
        {activeTab === "submitted" && (
          <SubmittedFormTab
            data={data.submitted}
            applicationId={remote.applicationId}
            changeFields={remote.changeFields}
          />
        )}
      </div>
    </div>
  );
}
