// services/admin-dashboard/app/components/participants/tabs/MiscellaneousTab.tsx
import React from "react";
import { ExternalLink } from "lucide-react";
import { instagramLink, isHttpUrl } from "@/lib/contact-links";
import type { ExtraField } from "@/lib/form-extra-fields";
import { InfoField } from "../InfoField";
import { ExtraFieldRows } from "../ExtraFieldRows";
import type { IconAction } from "../IconActions";

export interface Miscellaneous {
  /** Free text as entered: a handle, an instagram URL, or a plain name. */
  instagram: string;
  knowledgeSource: string;
  sourceAccount: string;
  twibbon: string;
  requirementLink: string;
  referralCode: string;
  /** Other answered fields from the miscellaneous (and unrecognised) form sections. */
  extraFields: ExtraField[];
}

function openAction(url: string, label: string): IconAction[] {
  return isHttpUrl(url) ? [{ href: url.trim(), label, icon: ExternalLink }] : [];
}

export function MiscellaneousTab({ data }: { data: Miscellaneous }) {
  const ig = instagramLink(data.instagram);
  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Miscellaneous</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <InfoField
          label="Instagram Account"
          value={ig.display || "—"}
          copyValue={ig.display}
          actions={ig.href ? [{ href: ig.href, label: "Open Instagram profile", icon: ExternalLink }] : undefined}
        />
        <InfoField label="Program Knowledge Source" value={data.knowledgeSource} />
        <InfoField label="Source Account Name" value={data.sourceAccount} />
        <InfoField
          label="Twibbon Link"
          value={data.twibbon}
          isLink
          copyValue={data.twibbon}
          actions={openAction(data.twibbon, "Open twibbon link")}
        />
        <InfoField
          label="Requirement Link"
          value={data.requirementLink}
          isLink
          copyValue={data.requirementLink}
          actions={openAction(data.requirementLink, "Open requirement link")}
        />
        <InfoField label="Ambassador Referral Code" value={data.referralCode} copyValue={data.referralCode} />
        <ExtraFieldRows fields={data.extraFields} />
      </div>
    </section>
  );
}
