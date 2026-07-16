"use client";

export type ValidationRules = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Bytes; admins enter MB and we multiply. */
  maxSize?: number;
  /** Comma-separated MIME types or extensions. */
  accept?: string;
  /** ISO date string. */
  minDate?: string;
  maxDate?: string;
  /** Regex pattern, advanced only. */
  pattern?: string;
};

interface ValidationRulesEditorProps {
  fieldType: string;
  value: ValidationRules;
  onChange: (next: ValidationRules) => void;
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
        placeholder={placeholder}
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

/**
 * Shows only the validation inputs that make sense for the currently selected
 * field type. Produces a plain object mirroring what the backend expects
 * (the shape matches what was previously typed into the raw JSON textarea).
 *
 * Kept intentionally minimal — this is what an admin without a CS degree
 * should be able to fill out confidently. Advanced cases (custom regex,
 * conditional rules) aren't in scope; fall back to a dev if needed.
 */
export function ValidationRulesEditor({
  fieldType,
  value,
  onChange,
}: ValidationRulesEditorProps) {
  const set = <K extends keyof ValidationRules>(key: K, v: ValidationRules[K]) =>
    onChange({ ...value, [key]: v });

  if (fieldType === "select" || fieldType === "radio" || fieldType === "checkbox") {
    return (
      <p className="text-xs text-zinc-500">
        Options above define the valid choices — no extra rules needed.
      </p>
    );
  }

  if (fieldType === "text" || fieldType === "textarea" || fieldType === "phone") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="Minimum characters"
          value={value.minLength}
          onChange={(v) => set("minLength", v)}
          placeholder="e.g. 2"
        />
        <NumberInput
          label="Maximum characters"
          value={value.maxLength}
          onChange={(v) => set("maxLength", v)}
          placeholder="e.g. 255"
        />
      </div>
    );
  }

  if (fieldType === "number") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="Minimum value"
          value={value.min}
          onChange={(v) => set("min", v)}
        />
        <NumberInput
          label="Maximum value"
          value={value.max}
          onChange={(v) => set("max", v)}
        />
      </div>
    );
  }

  if (fieldType === "date") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Earliest date</label>
          <input
            type="date"
            value={value.minDate ?? ""}
            onChange={(e) => set("minDate", e.target.value || undefined)}
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Latest date</label>
          <input
            type="date"
            value={value.maxDate ?? ""}
            onChange={(e) => set("maxDate", e.target.value || undefined)}
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
    );
  }

  if (fieldType === "file") {
    return (
      <div className="space-y-3">
        <NumberInput
          label="Maximum file size (MB)"
          hint="Applicants won't be allowed to upload files larger than this."
          value={value.maxSize ? Math.round(value.maxSize / (1024 * 1024)) : undefined}
          onChange={(v) => set("maxSize", v == null ? undefined : v * 1024 * 1024)}
          placeholder="e.g. 5"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Allowed file types</label>
          <input
            type="text"
            value={value.accept ?? ""}
            onChange={(e) => set("accept", e.target.value || undefined)}
            placeholder="e.g. image/*, .pdf, .docx"
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            Comma-separated. Use <code>image/*</code> for any image, or file extensions like <code>.pdf</code>.
          </p>
        </div>
      </div>
    );
  }

  // email, url — no rules typically needed (implicit validation).
  return (
    <p className="text-xs text-zinc-500">
      No extra validation needed for this field type.
    </p>
  );
}
