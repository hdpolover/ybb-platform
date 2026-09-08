// app/components/reminders/audience-options.ts

/**
 * Mirrors REMINDER_AUDIENCES (services/api). Order here is the order shown in
 * the create-reminder audience picker.
 */
export const REMINDER_AUDIENCE_OPTIONS = [
  {
    value: "registration_fee_unpaid",
    label: "Registration fee unpaid",
    description: "Registered, but has not paid the registration fee.",
  },
  {
    value: "application_draft_unsubmitted",
    label: "Application draft, unsubmitted",
    description: "Paid the registration fee, but never submitted the application.",
  },
  {
    value: "program_fee_unpaid",
    label: "Program fee unpaid",
    description: "Submitted the application, but has not paid the program fee.",
  },
] as const;

export type ReminderAudienceValue = (typeof REMINDER_AUDIENCE_OPTIONS)[number]["value"];

export function reminderAudienceLabel(value: string): string {
  return REMINDER_AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
