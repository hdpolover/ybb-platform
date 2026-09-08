// app/components/reminders/ReminderDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import {
  createParticipantReminder,
  getReminderAudience,
  previewParticipantReminder,
  updateParticipantReminder,
  type ParticipantReminder,
  type ReminderAudiencePreview,
} from "@/src/shared/api-client";
import { defaultScheduleInputValue, fromWibInputValue, toWibInputValue } from "./wib-time";
import { REMINDER_AUDIENCE_OPTIONS, reminderAudienceLabel } from "./audience-options";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReminderDialogProps {
  programId: string;
  /** If provided, the dialog is in edit mode; otherwise create mode. */
  reminder?: ParticipantReminder;
  onClose: () => void;
  onSaved: () => void;
}

/** One audience option's live count, as loaded for the picker. */
type AudienceCountState = { count: number; applicable: boolean; overlapNote: string | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEXTAREA_CLS =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

const TOKENS = ["{{participant_name}}", "{{program_name}}"] as const;

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

interface ValidationError {
  subject?: string;
  body?: string;
  scheduledAt?: string;
}

function validate(
  subject: string,
  body: string,
  scheduledAt: string,
  scheduling: boolean,
): ValidationError | null {
  const errors: ValidationError = {};
  if (!subject.trim()) errors.subject = "Subject is required.";
  if (!body.trim()) errors.body = "Message is required.";
  if (scheduling) {
    if (!scheduledAt) {
      errors.scheduledAt = "Pick a send time.";
    } else if (new Date(fromWibInputValue(scheduledAt)).getTime() <= Date.now()) {
      // Mirrors the server rule. A past time would fire on the next tick,
      // which is the one input mistake with no undo.
      errors.scheduledAt = "Send time must be in the future.";
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReminderDialog({
  programId,
  reminder,
  onClose,
  onSaved,
}: ReminderDialogProps) {
  const isEdit = Boolean(reminder);

  const [subject, setSubject] = useState(reminder?.subject ?? "");
  const [body, setBody] = useState(reminder?.body ?? "");
  // Audience is chosen at create time and immutable afterwards (the API's
  // UpdateParticipantReminderDto has no audience field), so edit mode just
  // displays reminder.audience rather than offering the picker.
  const [audience, setAudience] = useState(
    reminder?.audience ?? REMINDER_AUDIENCE_OPTIONS[0].value,
  );
  const [scheduling, setScheduling] = useState(Boolean(reminder?.scheduledAt) || !isEdit);
  const [scheduledAt, setScheduledAt] = useState(
    toWibInputValue(reminder?.scheduledAt) || defaultScheduleInputValue(),
  );
  const [errors, setErrors] = useState<ValidationError>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ReminderAudiencePreview["preview"]>(null);
  const [previewing, setPreviewing] = useState(false);

  // Live counts per audience, so the picker (create mode) or the fixed label
  // (edit mode) can name a real number rather than a stale one from the page.
  const [audienceCounts, setAudienceCounts] = useState<
    Record<string, AudienceCountState | null>
  >({});
  const [audienceCountsLoading, setAudienceCountsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const audiencesToLoad = isEdit
      ? [audience]
      : REMINDER_AUDIENCE_OPTIONS.map((option) => option.value);

    setAudienceCountsLoading(true);
    Promise.all(
      audiencesToLoad.map(async (value) => {
        try {
          const result = await getReminderAudience(programId, value);
          return [value, {
            count: result.count,
            applicable: result.applicable,
            overlapNote: result.overlapNote,
          }] as const;
        } catch {
          return [value, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setAudienceCounts(Object.fromEntries(entries));
      setAudienceCountsLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // Audience-count loading is keyed off mount (create) or the fixed
    // audience (edit) — programId/isEdit never change within one dialog
    // instance, so this intentionally does not re-run as `audience` changes
    // in the create-mode picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAudienceCount = audienceCounts[audience] ?? null;

  function insertToken(token: string) {
    setBody((current) => (current ? `${current}${token}` : token));
  }

  async function handlePreview() {
    const failed = validate(subject, body, scheduledAt, false);
    if (failed) {
      setErrors(failed);
      return;
    }
    setPreviewing(true);
    try {
      const result = await previewParticipantReminder(programId, { subject, body, audience });
      setPreview(result.preview);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    const failed = validate(subject, body, scheduledAt, scheduling);
    if (failed) {
      setErrors(failed);
      return;
    }
    setErrors({});
    setSaving(true);

    // `null` explicitly returns a scheduled reminder to draft; a datetime
    // schedules it. The API derives status from this, so the two cannot drift.
    const scheduledAtValue = scheduling ? fromWibInputValue(scheduledAt) : null;
    const audienceCount = selectedAudienceCount?.count ?? 0;

    try {
      if (reminder) {
        await updateParticipantReminder(programId, reminder.id, {
          subject,
          body,
          scheduledAt: scheduledAtValue,
        });
      } else {
        await createParticipantReminder(programId, {
          subject,
          body,
          audience,
          ...(scheduledAtValue ? { scheduledAt: scheduledAtValue } : {}),
        });
      }
      toast.success(
        scheduling
          ? `Reminder scheduled. ${audienceCount} participant${audienceCount === 1 ? "" : "s"} match right now; the audience is recomputed at send time.`
          : "Reminder saved as a draft. It will not send until you schedule it.",
      );
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit reminder" : "New reminder"}</DialogTitle>
          <DialogDescription>
            Sent to the audience below. Nothing goes out until the send time you
            pick, and you can cancel until then.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Audience</Label>
            {isEdit ? (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {reminderAudienceLabel(audience)}
                {selectedAudienceCount &&
                  ` — ${selectedAudienceCount.count} participant${selectedAudienceCount.count === 1 ? "" : "s"} match right now`}
                <span className="block text-xs text-zinc-500">
                  The audience cannot be changed after a reminder is created.
                </span>
              </p>
            ) : (
              <div className="space-y-2">
                {REMINDER_AUDIENCE_OPTIONS.map((option) => {
                  const countState = audienceCounts[option.value];
                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-zinc-200 p-2.5 text-sm transition-colors has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50"
                    >
                      <input
                        type="radio"
                        name="reminder-audience"
                        value={option.value}
                        checked={audience === option.value}
                        onChange={() => setAudience(option.value)}
                        className="mt-0.5 cursor-pointer"
                      />
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-900">{option.label}</span>
                          <span className="tabular-nums text-xs text-zinc-500">
                            {audienceCountsLoading
                              ? "…"
                              : countState
                                ? `${countState.count} participant${countState.count === 1 ? "" : "s"}`
                                : "—"}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {/* Non-blocking: this audience overlaps an automated cron, but an
                admin may still want a deliberate manual follow-up. */}
            {!audienceCountsLoading && audienceCounts[audience]?.overlapNote && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {audienceCounts[audience]?.overlapNote}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-subject">Subject</Label>
            <Input
              id="reminder-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your registration fee for {{program_name}}"
              maxLength={255}
            />
            {errors.subject && <p className="text-xs text-red-600">{errors.subject}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder-body">Message</Label>
              <div className="flex items-center gap-1.5">
                {TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="cursor-pointer rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="reminder-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className={TEXTAREA_CLS}
              placeholder={"Hi {{participant_name}},\n\nWe have not received your registration fee for {{program_name}} yet…"}
              maxLength={20000}
            />
            <p className="text-xs text-zinc-500">
              Plain text. Blank lines become paragraphs, and a link to the payments
              page is added automatically.
            </p>
            {errors.body && <p className="text-xs text-red-600">{errors.body}</p>}
          </div>

          <div className="space-y-2 rounded-md border border-zinc-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={scheduling}
                onChange={(e) => setScheduling(e.target.checked)}
                className="cursor-pointer"
              />
              Schedule this reminder
            </label>
            {scheduling ? (
              <div className="space-y-1.5">
                <Label htmlFor="reminder-scheduled-at">Send time (WIB)</Label>
                <Input
                  id="reminder-scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-zinc-500">
                  Interpreted as Asia/Jakarta (UTC+7), not your computer&rsquo;s
                  timezone. Sending starts within a minute of this time.
                </p>
                {errors.scheduledAt && (
                  <p className="text-xs text-red-600">{errors.scheduledAt}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Leave unchecked to keep this as a draft. Drafts never send.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handlePreview()}
              loading={previewing}
              disabled={previewing}
            >
              Preview with real data
            </Button>
            {preview && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Subject
                </p>
                <p className="mb-2 text-sm text-zinc-900">{preview.subject}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Message
                </p>
                <p className="whitespace-pre-wrap text-sm text-zinc-700">{preview.body}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving} disabled={saving}>
            {scheduling ? "Schedule" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
