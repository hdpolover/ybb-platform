import type { ComponentType, ReactNode } from "react";

interface FormSectionProps {
  /** A heroicon component rendered in the blue accent pill. */
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned header content — status chip, inline action button, etc. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Bordered card that groups related fields inside a drawer. Replaces the
 * repeated `<section class="rounded-xl border ... bg-zinc-50/50 p-5">` +
 * icon + title + divider pattern that shows up 8+ times across the larger
 * program drawers.
 */
export function FormSection({ icon: Icon, title, description, actions, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="text-base font-bold text-zinc-900">{title}</h3>
            {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
