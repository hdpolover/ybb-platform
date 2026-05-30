"use client";

/**
 * EditSubmissionDrawer
 *
 * Right-side drawer that lets admins edit a participant's locked submission.
 * Scope (this iteration):
 *   • Participant identity columns: fullName, nickName (displayName mirrors fullName by API default)
 *   • Application text fields: motivationLetter, twibbonLink, achievements, experiences
 *   • A required "reason" field for the audit trail
 *
 * Out of scope (deferred):
 *   • Raw personalData / essayAnswers dynamic keys — the admin GET /applications/:id
 *     endpoint does not return these raw blobs; it maps them into structured participant
 *     columns. To edit dynamic form fields the API would need to expose personalData.
 *   • File / upload replacement (by design).
 */

import { useState } from "react";
import { User, FileText, AlertTriangle } from "lucide-react";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { FormSection } from "@/src/ui/drawer/form-section";
import { EnglishInput } from "@/src/ui/english-input";
import { Label } from "@/src/ui/label";
import { Input } from "@/src/ui/input";
import { Button } from "@/src/ui/button";
import {
  adminUpdateSubmissionData,
  type Application,
} from "@/src/shared/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableFields {
  fullName: string;
  nickName: string;
  motivationLetter: string;
  twibbonLink: string;
  achievements: string;
  experiences: string;
}

interface EditSubmissionDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The current application data used to seed the form. */
  application: Application;
  /** Called after a successful save so the parent can refresh its data. */
  onSaved: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedFromApplication(app: Application): EditableFields {
  return {
    fullName: app.participant?.fullName ?? "",
    nickName: app.participant?.nickName ?? "",
    motivationLetter: app.motivationLetter ?? "",
    twibbonLink: app.twibbonLink ?? "",
    achievements: app.achievements ?? "",
    experiences: app.experiences ?? "",
  };
}

function buildPayload(
  original: EditableFields,
  edited: EditableFields,
  reason: string,
) {
  const participantChanges: {
    fullName?: string;
    nickName?: string;
    displayName?: string;
  } = {};

  if (edited.fullName.trim() !== original.fullName.trim()) {
    participantChanges.fullName = edited.fullName.trim();
    // displayName is kept in sync server-side, but pass it explicitly so the
    // audit diff is unambiguous.
    participantChanges.displayName = edited.fullName.trim();
  }
  if (edited.nickName.trim() !== original.nickName.trim()) {
    participantChanges.nickName = edited.nickName.trim();
  }

  // personalData fields that are stored directly on the Application row
  // (the API merges these under personalData when syncing)
  const personalData: Record<string, unknown> = {};
  if (edited.twibbonLink.trim() !== original.twibbonLink.trim()) {
    personalData["twibbon_link"] = edited.twibbonLink.trim();
  }
  if (edited.achievements.trim() !== original.achievements.trim()) {
    personalData["achievements"] = edited.achievements.trim();
  }
  if (edited.experiences.trim() !== original.experiences.trim()) {
    personalData["experiences"] = edited.experiences.trim();
  }

  // Essay answers
  const essayAnswers: Record<string, unknown> = {};
  if (edited.motivationLetter.trim() !== original.motivationLetter.trim()) {
    essayAnswers["motivation_letter"] = edited.motivationLetter.trim();
  }

  return {
    ...(Object.keys(participantChanges).length > 0
      ? { participant: participantChanges }
      : {}),
    ...(Object.keys(personalData).length > 0 ? { personalData } : {}),
    ...(Object.keys(essayAnswers).length > 0 ? { essayAnswers } : {}),
    reason,
  };
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditSubmissionDrawer({
  open,
  onClose,
  application,
  onSaved,
}: EditSubmissionDrawerProps) {
  const original = seedFromApplication(application);
  const [fields, setFields] = useState<EditableFields>(original);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function set(key: keyof EditableFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
    };
  }

  async function handleSave() {
    if (!reason.trim()) {
      setApiError("A reason for the edit is required.");
      return;
    }

    const payload = buildPayload(original, fields, reason.trim());

    // Nothing changed + no participant changes → inform admin.
    const hasChanges =
      payload.participant !== undefined ||
      payload.personalData !== undefined ||
      payload.essayAnswers !== undefined;
    if (!hasChanges) {
      setApiError("No changes detected. Update at least one field before saving.");
      return;
    }

    setSaving(true);
    setApiError(null);
    try {
      await adminUpdateSubmissionData(application.id, { ...payload, reason: reason.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title="Edit Submission"
      description="Admin override — bypasses the submission lock. Every save is audited."
      error={apiError}
      locked={saving}
      width="sm:max-w-2xl"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            Save Changes
          </Button>
        </>
      }
    >
      {/* ── Identity ───────────────────────────────────────────────────────── */}
      <FormSection
        icon={User}
        title="Participant Identity"
        description="Changes here sync full_name across the Participant record and personalData."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="edit-fullName" label="Full Name">
            <EnglishInput
              id="edit-fullName"
              restrictMode="name"
              value={fields.fullName}
              onChange={set("fullName")}
              placeholder="Full legal name"
            />
          </Field>
          <Field id="edit-nickName" label="Nickname">
            <EnglishInput
              id="edit-nickName"
              restrictMode="name"
              value={fields.nickName}
              onChange={set("nickName")}
              placeholder="Preferred name"
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Submission content ─────────────────────────────────────────────── */}
      <FormSection
        icon={FileText}
        title="Submission Content"
        description="Uploaded files are not editable in this tool."
      >
        <div className="flex flex-col gap-4">
          <Field id="edit-motivationLetter" label="Motivation Letter / Essay">
            <textarea
              id="edit-motivationLetter"
              value={fields.motivationLetter}
              onChange={set("motivationLetter")}
              rows={6}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Motivation letter content…"
            />
          </Field>

          <Field id="edit-twibbonLink" label="Twibbon Link">
            <Input
              id="edit-twibbonLink"
              type="url"
              value={fields.twibbonLink}
              onChange={set("twibbonLink")}
              placeholder="https://twibbon.com/…"
            />
          </Field>

          <Field id="edit-achievements" label="Achievements (one per line or JSON array)">
            <textarea
              id="edit-achievements"
              value={fields.achievements}
              onChange={set("achievements")}
              rows={4}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder='["First achievement", "Second achievement"]'
            />
          </Field>

          <Field id="edit-experiences" label="Experiences (one per line or JSON array)">
            <textarea
              id="edit-experiences"
              value={fields.experiences}
              onChange={set("experiences")}
              rows={4}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder='[{"role": "President", "company": "Org"}]'
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Audit reason ──────────────────────────────────────────────────── */}
      <FormSection
        icon={AlertTriangle}
        title="Reason for Edit"
        description="Required. Stored in the audit log attached to this change."
      >
        <Field id="edit-reason" label="Reason *">
          <textarea
            id="edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g. Participant reported a typo in their name before LOA printing."
          />
        </Field>
      </FormSection>
    </DrawerShell>
  );
}
