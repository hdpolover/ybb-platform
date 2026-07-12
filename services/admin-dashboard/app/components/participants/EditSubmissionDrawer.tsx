"use client";

/**
 * EditSubmissionDrawer
 *
 * Right-side drawer that lets admins edit a participant's locked submission.
 *
 * Scope (this iteration):
 *   • Dynamic form fields from the program's form definition (personalData +
 *     essayAnswers), grouped by section with the correct field type controls.
 *   • Application text-column fields: motivationLetter, twibbonLink,
 *     achievements, experiences (kept as a dedicated fallback section when
 *     submissionForm is absent).
 *   • A required "reason" field for the audit trail.
 *
 * Name de-duplication strategy:
 *   The generic field list renders ALL fields returned in submissionForm,
 *   including full_name / nick_name keys.  When saving, any field whose
 *   name normalises to "fullname"/"nickname" is written via personalData
 *   (not the participant patch), and the server's name-sync logic mirrors
 *   it to Participant.fullName / Participant.nickName automatically.
 *   The legacy "Participant Identity" section is therefore hidden when
 *   submissionForm is present — it would double-edit the same datum.
 *
 * Out of scope (deferred):
 *   • File / upload replacement (by design).
 */

import { useState, useId } from "react";
import { User, FileText, AlertTriangle, Layers } from "lucide-react";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { FormSection } from "@/src/ui/drawer/form-section";
import { EnglishInput } from "@/src/ui/english-input";
import { Label } from "@/src/ui/label";
import { Input } from "@/src/ui/input";
import { Button } from "@/src/ui/button";
import {
  adminUpdateSubmissionData,
  type Application,
  type SubmissionFormFieldAdmin,
} from "@/src/shared/api-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEXTAREA_TYPES = new Set(["textarea", "essay", "longtext", "long_text"]);
const SELECT_TYPES = new Set(["select", "dropdown", "radio"]);
const DATE_TYPES = new Set(["date", "datetime", "date_input"]);
const FILE_TYPES = new Set([
  "file",
  "upload",
  "document",
  "image",
  "photo",
  "avatar",
  "resume",
]);

// Field names that are "name-like" and benefit from EnglishInput / name mode
const NAME_LIKE_NAMES = new Set([
  "full_name",
  "fullname",
  "full_name_en",
  "nick_name",
  "nickname",
  "display_name",
  "displayname",
  "preferred_name",
  "preferredname",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditSubmissionDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The current application data used to seed the form. */
  application: Application;
  /** Called after a successful save so the parent can refresh its data. */
  onSaved: () => void;
}

// Stores for fields that fall outside the generic submissionForm
// (legacy application text columns).
interface LegacyFields {
  motivationLetter: string;
  twibbonLink: string;
  achievements: string;
  experiences: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function seedLegacyFromApplication(app: Application): LegacyFields {
  return {
    motivationLetter: app.motivationLetter ?? "",
    twibbonLink: app.twibbonLink ?? "",
    achievements: app.achievements ?? "",
    experiences: app.experiences ?? "",
  };
}

function seedDynamicFields(
  app: Application,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of app.submissionForm?.sections ?? []) {
    for (const field of section.fields) {
      out[field.name] = field.value;
    }
  }
  return out;
}

function buildPayload(
  app: Application,
  originalDynamic: Record<string, string>,
  currentDynamic: Record<string, string>,
  originalLegacy: LegacyFields,
  currentLegacy: LegacyFields,
  reason: string,
) {
  // ── Dynamic fields ────────────────────────────────────────────────────────
  const personalDataPatch: Record<string, string> = {};
  const essayAnswersPatch: Record<string, string> = {};

  const allFields = (app.submissionForm?.sections ?? []).flatMap((s) =>
    s.fields.filter((f) => !f.readonly),
  );

  for (const field of allFields) {
    const original = originalDynamic[field.name] ?? "";
    const current = currentDynamic[field.name] ?? "";
    if (current.trim() !== original.trim()) {
      if (field.store === "essayAnswers") {
        essayAnswersPatch[field.name] = current.trim();
      } else {
        personalDataPatch[field.name] = current.trim();
      }
    }
  }

  // ── Legacy application text columns ───────────────────────────────────────
  const applicationPatch: {
    motivationLetter?: string;
    achievements?: string;
    experiences?: string;
    twibbonLink?: string;
  } = {};

  if (currentLegacy.motivationLetter.trim() !== originalLegacy.motivationLetter.trim()) {
    applicationPatch.motivationLetter = currentLegacy.motivationLetter.trim();
  }
  if (currentLegacy.achievements.trim() !== originalLegacy.achievements.trim()) {
    applicationPatch.achievements = currentLegacy.achievements.trim();
  }
  if (currentLegacy.experiences.trim() !== originalLegacy.experiences.trim()) {
    applicationPatch.experiences = currentLegacy.experiences.trim();
  }
  if (currentLegacy.twibbonLink.trim() !== originalLegacy.twibbonLink.trim()) {
    applicationPatch.twibbonLink = currentLegacy.twibbonLink.trim();
  }

  return {
    ...(Object.keys(personalDataPatch).length > 0
      ? { personalData: personalDataPatch }
      : {}),
    ...(Object.keys(essayAnswersPatch).length > 0
      ? { essayAnswers: essayAnswersPatch }
      : {}),
    ...(Object.keys(applicationPatch).length > 0
      ? { application: applicationPatch }
      : {}),
    reason,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

const TEXTAREA_CLS =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

const READONLY_CLS =
  "w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 shadow-sm cursor-not-allowed break-all";

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: SubmissionFormFieldAdmin;
  value: string;
  onChange: (val: string) => void;
}) {
  const uid = useId();
  const fieldId = `dynamic-${field.name}-${uid}`;
  const normalised = normaliseName(field.name);

  if (field.readonly || FILE_TYPES.has(field.type.toLowerCase())) {
    return (
      <Field id={fieldId} label={field.label} required={field.isRequired}>
        <div className={READONLY_CLS} title="File fields are not editable here">
          {value || <span className="italic text-zinc-400">No file uploaded</span>}
        </div>
      </Field>
    );
  }

  if (SELECT_TYPES.has(field.type.toLowerCase()) && field.options && field.options.length > 0) {
    return (
      <Field id={fieldId} label={field.label} required={field.isRequired}>
        <select
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
        >
          <option value="">— Select —</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (TEXTAREA_TYPES.has(field.type.toLowerCase())) {
    return (
      <Field id={fieldId} label={field.label} required={field.isRequired}>
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={TEXTAREA_CLS}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
        />
      </Field>
    );
  }

  if (DATE_TYPES.has(field.type.toLowerCase())) {
    return (
      <Field id={fieldId} label={field.label} required={field.isRequired}>
        <Input
          id={fieldId}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    );
  }

  // Default: text input — use EnglishInput for name-like fields
  if (NAME_LIKE_NAMES.has(normalised)) {
    return (
      <Field id={fieldId} label={field.label} required={field.isRequired}>
        <EnglishInput
          id={fieldId}
          restrictMode="name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
        />
      </Field>
    );
  }

  return (
    <Field id={fieldId} label={field.label} required={field.isRequired}>
      <EnglishInput
        id={fieldId}
        restrictMode="general"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}…`}
      />
    </Field>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditSubmissionDrawer({
  open,
  onClose,
  application,
  onSaved,
}: EditSubmissionDrawerProps) {
  const hasDynamicForm =
    (application.submissionForm?.sections?.length ?? 0) > 0;

  const originalDynamic = seedDynamicFields(application);
  const originalLegacy = seedLegacyFromApplication(application);

  const [dynamicFields, setDynamicFields] =
    useState<Record<string, string>>(originalDynamic);
  const [legacyFields, setLegacyFields] =
    useState<LegacyFields>(originalLegacy);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function setDynamic(name: string) {
    return (val: string) =>
      setDynamicFields((prev) => ({ ...prev, [name]: val }));
  }

  function setLegacy(key: keyof LegacyFields) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setLegacyFields((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSave() {
    if (!reason.trim()) {
      setApiError("A reason for the edit is required.");
      return;
    }

    const payload = buildPayload(
      application,
      originalDynamic,
      dynamicFields,
      originalLegacy,
      legacyFields,
      reason.trim(),
    );

    const hasChanges =
      payload.personalData !== undefined ||
      payload.essayAnswers !== undefined ||
      payload.application !== undefined;

    if (!hasChanges) {
      setApiError(
        "No changes detected. Update at least one field before saving.",
      );
      return;
    }

    setSaving(true);
    setApiError(null);
    try {
      await adminUpdateSubmissionData(application.id, payload);
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            Save Changes
          </Button>
        </>
      }
    >
      {hasDynamicForm ? (
        // ── Dynamic form fields grouped by section ──────────────────────────
        <>
          {application.submissionForm!.sections.map((section) => (
            <FormSection
              key={section.section}
              icon={Layers}
              title={section.label}
              description={`Fields from the "${section.label}" section of the program form.`}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div
                    key={field.name}
                    className={
                      TEXTAREA_TYPES.has(field.type.toLowerCase()) ||
                      field.readonly ||
                      FILE_TYPES.has(field.type.toLowerCase())
                        ? "sm:col-span-2"
                        : ""
                    }
                  >
                    <DynamicFieldInput
                      field={field}
                      value={dynamicFields[field.name] ?? ""}
                      onChange={setDynamic(field.name)}
                    />
                  </div>
                ))}
              </div>
            </FormSection>
          ))}

          {/* Application text columns (twibbon link not in form fields) */}
          {application.twibbonLink !== undefined && (
            <FormSection
              icon={FileText}
              title="Additional Fields"
              description="Fields stored as application-level columns."
            >
              <div className="flex flex-col gap-4">
                <Field id="edit-twibbonLink" label="Twibbon Link">
                  <Input
                    id="edit-twibbonLink"
                    type="url"
                    value={legacyFields.twibbonLink}
                    onChange={setLegacy("twibbonLink")}
                    placeholder="https://twibbon.com/…"
                  />
                </Field>
              </div>
            </FormSection>
          )}
        </>
      ) : (
        // ── Fallback: legacy hard-coded fields (no program form defined) ───
        <>
          <FormSection
            icon={User}
            title="Participant Identity"
            description="Changes here sync full_name across the Participant record and personalData."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="edit-fullName-legacy" label="Full Name">
                <EnglishInput
                  id="edit-fullName-legacy"
                  restrictMode="name"
                  value={application.participant?.fullName ?? ""}
                  onChange={() => {
                    /* handled via personalData when no dynamic form */
                  }}
                  placeholder="Full legal name"
                  disabled
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={FileText}
            title="Submission Content"
            description="Uploaded files are not editable in this tool."
          >
            <div className="flex flex-col gap-4">
              <Field
                id="edit-motivationLetter"
                label="Motivation Letter / Essay"
              >
                <textarea
                  id="edit-motivationLetter"
                  value={legacyFields.motivationLetter}
                  onChange={setLegacy("motivationLetter")}
                  rows={6}
                  className={TEXTAREA_CLS}
                  placeholder="Motivation letter content…"
                />
              </Field>

              <Field id="edit-twibbonLink" label="Twibbon Link">
                <Input
                  id="edit-twibbonLink"
                  type="url"
                  value={legacyFields.twibbonLink}
                  onChange={setLegacy("twibbonLink")}
                  placeholder="https://twibbon.com/…"
                />
              </Field>

              <Field
                id="edit-achievements"
                label="Achievements (one per line or JSON array)"
              >
                <textarea
                  id="edit-achievements"
                  value={legacyFields.achievements}
                  onChange={setLegacy("achievements")}
                  rows={4}
                  className={TEXTAREA_CLS}
                  placeholder='["First achievement", "Second achievement"]'
                />
              </Field>

              <Field
                id="edit-experiences"
                label="Experiences (one per line or JSON array)"
              >
                <textarea
                  id="edit-experiences"
                  value={legacyFields.experiences}
                  onChange={setLegacy("experiences")}
                  rows={4}
                  className={TEXTAREA_CLS}
                  placeholder='[{"role": "President", "company": "Org"}]'
                />
              </Field>
            </div>
          </FormSection>
        </>
      )}

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
            className={TEXTAREA_CLS}
            placeholder="e.g. Participant reported a typo in their name before Invitation Letter printing."
          />
        </Field>
      </FormSection>
    </DrawerShell>
  );
}
