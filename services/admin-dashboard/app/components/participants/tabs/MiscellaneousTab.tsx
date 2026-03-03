import React from "react";
import { InfoField } from "../InfoField";

export interface Miscellaneous {
  instagram: string;
  knowledgeSource: string;
  sourceAccount: string;
  twibbon: string;
  requirementLink: string;
  referralCode: string;
}

export function MiscellaneousTab({ data }: { data: Miscellaneous }) {
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Miscellaneous</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <InfoField label="Instagram Account" value={data.instagram} isLink />
        <InfoField label="Program Knowledge Source" value={data.knowledgeSource} />
        <InfoField label="Source Account Name" value={data.sourceAccount} />
        <InfoField label="Twibbon Link" value={data.twibbon} isLink />
        <InfoField label="Requirement Link" value={data.requirementLink} isLink />
        <InfoField label="Ambassador Referral Code" value={data.referralCode} />
      </div>
    </section>
  );
}