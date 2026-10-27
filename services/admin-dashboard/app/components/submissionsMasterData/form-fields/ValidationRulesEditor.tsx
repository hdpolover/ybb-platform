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
  /** Show this field only when `field` equals one of `equals` (a string, or a list). */
  visibleWhen?: { field: string; equals: string | string[] };
};

/** A sibling field the "Show only when" control can depend on. */
export type VisibilityController = { name: string; label: string; options: string[] };

interface ValidationRulesEditorProps {
  fieldType: string;
  value: ValidationRules;
  onChange: (next: ValidationRules) => void;
  /** Other fields in the same program (current field excluded). */
  controllers?: VisibilityController[];
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
function TypeSpecificRules({
  fieldType,
  value,
  onChange,
}: Omit<ValidationRulesEditorProps, "controllers">) {
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

const toList = (equals: string | string[] | undefined): string[] =>
  Array.isArray(equals) ? equals : equals ? [equals] : [];

/** "Show only when <field> is <value>" — writes `visibleWhen`, or removes it when no field is picked. */
function VisibleWhenControl({
  value,
  onChange,
  controllers,
}: {
  value: ValidationRules;
  onChange: (next: ValidationRules) => void;
  controllers: VisibilityController[];
}) {
  const rule = value.visibleWhen;
  const controller = controllers.find((c) => c.name === rule?.field);
  const selected = toList(rule?.equals);
  const setRule = (field: string, values: string[]) => {
    if (!field) {
      const { visibleWhen: _removed, ...rest } = value;
      void _removed;
      onChange(rest);
      return;
    }
    onChange({ ...value, visibleWhen: { field, equals: values.length === 1 ? values[0] : values } });
  };
  const inputClass =
    "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3">
      <label className="block text-xs font-medium text-zinc-600">Show only when</label>
      <select
        value={rule?.field ?? ""}
        onChange={(e) => setRule(e.target.value, [])}
        className={inputClass}
      >
        <option value="">Always show this field</option>
        {controllers.map((c) => (
          <option key={c.name} value={c.name}>
            {c.label} ({c.name})
          </option>
        ))}
        {rule?.field && !controller && <option value={rule.field}>{rule.field} (field not found)</option>}
      </select>
      {rule?.field && controller && controller.options.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {controller.options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) =>
                  setRule(
                    rule.field,
                    e.target.checked ? [...selected, option] : selected.filter((v) => v !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
      )}
      {rule?.field && (!controller || controller.options.length === 0) && (
        <input
          type="text"
          value={selected.join(", ")}
          onChange={(e) =>
            setRule(
              rule.field,
              e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
            )
          }
          placeholder="Value to match, e.g. Yes (comma-separate for several)"
          className={inputClass}
        />
      )}
      <p className="text-[11px] text-zinc-400">
        When the condition is not met, applicants do not see this field and it is not required.
      </p>
    </div>
  );
}

export function ValidationRulesEditor({ controllers = [], ...props }: ValidationRulesEditorProps) {
  return (
    <div className="space-y-3">
      <TypeSpecificRules {...props} />
      <VisibleWhenControl value={props.value} onChange={props.onChange} controllers={controllers} />
    </div>
  );
}
