// services/admin-dashboard/app/components/participants/IconActions.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { isHttpUrl, whatsappUrl } from "@/lib/contact-links";

const COPIED_RESET_MS = 1500;

const ICON_BUTTON_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors " +
  "hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";

/** True for a value worth acting on (copy / open); false for empty or placeholder dashes. */
export function isPresent(value: string | null | undefined): value is string {
  const v = (value ?? "").trim();
  return v !== "" && v !== "—" && v !== "-";
}

export interface IconAction {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** WhatsApp link for a number; hidden when the API flagged it as invalid (`phoneValid === false`). */
export function whatsappActions(phone: string | null | undefined, phoneValid?: boolean | null): IconAction[] {
  if (phoneValid === false) return [];
  const href = whatsappUrl(phone);
  return href ? [{ href, label: "Open in WhatsApp", icon: MessageCircle }] : [];
}

/** Writes to the clipboard and toasts "<label> copied" or the shared failure message. Resolves true on success. */
export async function copyText(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
    return false;
  }
  toast.success(`${label} copied`);
  return true;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function handleCopy() {
    if (!(await copyText(text, label))) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  const title = `Copy ${label.toLowerCase()}`;
  const Icon = copied ? Check : Copy;
  return (
    <button type="button" onClick={() => void handleCopy()} aria-label={title} title={title} className={ICON_BUTTON_CLASS}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

/** Icon link that opens in a new tab. Renders nothing unless href is http(s). */
export function ActionLink({ href, label, icon: Icon }: IconAction) {
  if (!isHttpUrl(href)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={ICON_BUTTON_CLASS}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

interface IconActionsProps {
  /** Text to copy; the toast reads "<copyLabel> copied". */
  copyValue?: string;
  copyLabel: string;
  actions?: IconAction[];
}

export function IconActions({ copyValue, copyLabel, actions = [] }: IconActionsProps) {
  if (!isPresent(copyValue) && actions.length === 0) return null;
  return (
    <span className="-my-1 inline-flex shrink-0 items-center">
      {actions.map((a) => <ActionLink key={a.label} {...a} />)}
      {isPresent(copyValue) && <CopyButton text={copyValue} label={copyLabel} />}
    </span>
  );
}
