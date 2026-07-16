"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import {
  createLoaBatch,
  updateLoaBatch,
  type LoaBatch,
  type CreateLoaBatchInput,
  type UpdateLoaBatchInput,
} from "@/src/shared/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoaBatchDialogProps {
  programId: string;
  /** If provided, the dialog is in edit mode; otherwise create mode. */
  batch?: LoaBatch;
  onClose: () => void;
  /** Called after a successful save so the parent can refetch. */
  onSaved: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

/** Convert an ISO datetime or date-only string to YYYY-MM-DD for <input type="date">. */
function toDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const OVERLAP_PHRASES = ["overlap", "conflict", "409", "date range"];
function isOverlapError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return OVERLAP_PHRASES.some((p) => lower.includes(p));
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationError {
  name?: string;
  submissionFrom?: string;
  submissionTo?: string;
}

function validate(
  name: string,
  submissionFrom: string,
  submissionTo: string,
): ValidationError | null {
  const errors: ValidationError = {};
  if (!name.trim()) errors.name = "Batch name is required.";
  if (!submissionFrom) errors.submissionFrom = "Start date is required.";
  if (!submissionTo) errors.submissionTo = "End date is required.";
  if (submissionFrom && submissionTo && submissionFrom > submissionTo) {
    errors.submissionTo = "End date must be on or after start date.";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoaBatchDialog({
  programId,
  batch,
  onClose,
  onSaved,
}: LoaBatchDialogProps) {
  const isEdit = !!batch;

  const [name, setName] = useState(batch?.name ?? "");
  const [submissionFrom, setSubmissionFrom] = useState(
    toDateInputValue(batch?.submissionFrom),
  );
  const [submissionTo, setSubmissionTo] = useState(
    toDateInputValue(batch?.submissionTo),
  );
  const [fieldErrors, setFieldErrors] = useState<ValidationError>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    const validationErrors = validate(name, submissionFrom, submissionTo);
    if (validationErrors) {
      setFieldErrors(validationErrors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      // Convert local YYYY-MM-DD to ISO string (midnight UTC)
      const fromIso = new Date(`${submissionFrom}T00:00:00Z`).toISOString();
      const toIso = new Date(`${submissionTo}T00:00:00Z`).toISOString();

      if (isEdit && batch) {
        const payload: UpdateLoaBatchInput = {
          name: name.trim(),
          submissionFrom: fromIso,
          submissionTo: toIso,
        };
        await updateLoaBatch(programId, batch.id, payload);
        toast.success("Batch updated successfully.");
      } else {
        const payload: CreateLoaBatchInput = {
          name: name.trim(),
          submissionFrom: fromIso,
          submissionTo: toIso,
        };
        await createLoaBatch(programId, payload);
        toast.success("Batch created successfully.");
      }

      onSaved();
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (isOverlapError(msg)) {
        setApiError(
          "This date range overlaps an existing batch. Please choose a different date range.",
        );
      } else {
        setApiError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Batch" : "Create Batch"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Batch Name */}
          <div className="space-y-1.5">
            <Label htmlFor="batch-name">Batch Name</Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wave 1"
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          {/* Submission Date From */}
          <div className="space-y-1.5">
            <Label htmlFor="batch-from">Submission Date From</Label>
            <Input
              id="batch-from"
              type="date"
              value={submissionFrom}
              onChange={(e) => setSubmissionFrom(e.target.value)}
            />
            {fieldErrors.submissionFrom && (
              <p className="text-xs text-red-600">{fieldErrors.submissionFrom}</p>
            )}
          </div>

          {/* Submission Date To */}
          <div className="space-y-1.5">
            <Label htmlFor="batch-to">Submission Date To</Label>
            <Input
              id="batch-to"
              type="date"
              value={submissionTo}
              onChange={(e) => setSubmissionTo(e.target.value)}
            />
            {fieldErrors.submissionTo && (
              <p className="text-xs text-red-600">{fieldErrors.submissionTo}</p>
            )}
          </div>

          {/* API / overlap error */}
          {apiError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs text-red-700">{apiError}</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              {isEdit ? "Save Changes" : "Create Batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
