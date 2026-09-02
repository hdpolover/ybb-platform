// app/components/reminders/ReminderDialog.tsx
"use client";

import { useState } from "react";
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
  previewParticipantReminder,
  updateParticipantReminder,
  type ParticipantReminder,
  type ReminderAudiencePreview,
} from "@/src/shared/api-client";
import { defaultScheduleInputValue, fromWibInputValue, toWibInputValue } from "./wib-time";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReminderDialogProps {
  programId: string;
  /** If provided, the dialog is in edit mode; otherwise create mode. */
  reminder?: ParticipantReminder;
  /** Live audience size, so the confirm copy can name a real number. */
  audienceCount: number;
  onClose: () => void;
  onSaved: () => void;
}

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
  audienceCount,
  onClose,
  onSaved,
}: ReminderDialogProps) {
  const isEdit = Boolean(reminder);

  const [subject, setSubject] = useState(reminder?.subject ?? "");
  const [body, setBody] = useState(reminder?.body ?? "");
  const [scheduling, setScheduling] = useState(Boolean(reminder?.scheduledAt) || !isEdit);
  const [scheduledAt, setScheduledAt] = useState(
    toWibInputValue(reminder?.scheduledAt) || defaultScheduleInputValue(),
  );
  const [errors, setErrors] = useState<ValidationError>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ReminderAudiencePreview["preview"]>(null);
  const [previewing, setPreviewing] = useState(false);

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
      const result = await previewParticipantReminder(programId, { subject, body });
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
            Sent to everyone in this program who has not paid the registration fee.
            Nothing goes out until the send time you pick below, and you can cancel
            until then.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
