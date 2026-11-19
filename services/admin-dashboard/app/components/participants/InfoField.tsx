// services/admin-dashboard/app/components/participants/InfoField.tsx
import React from "react";
import { isHttpUrl } from "@/lib/contact-links";
import { IconActions, isPresent, type IconAction } from "./IconActions";

interface InfoFieldProps {
  label: string;
  value: React.ReactNode;
  isLink?: boolean;
  /** Renders a copy button; the toast reads "<label> copied". */
  copyValue?: string;
  /** Extra icon links (WhatsApp, open profile, ...) that open in a new tab. */
  actions?: IconAction[];
  /** Shown under the value (e.g. an invalid-phone flag). */
  warning?: React.ReactNode;
}

export function InfoField({ label, value, isLink = false, copyValue, actions, warning }: InfoFieldProps) {
  const text = typeof value === "string" ? value : undefined;
  const canAct = isPresent(copyValue ?? text);
  const showLink = isLink && text !== undefined && isHttpUrl(text);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <div className="flex items-start gap-1">
        {showLink ? (
          <a
            href={text}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 text-sm font-semibold text-blue-600 hover:underline break-all"
          >
            {text}
          </a>
        ) : (
          <span className="min-w-0 break-words text-sm font-semibold text-zinc-900">{value || "-"}</span>
        )}
        {canAct && <IconActions copyValue={copyValue} copyLabel={label} actions={actions} />}
      </div>
      {warning}
    </div>
  );
}
