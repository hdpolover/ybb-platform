// services/api/src/modules/applications/application/dto/application-edit-history-response.dto.ts
export interface ApplicationEditHistoryChangeDto {
  /** e.g. "personalData.phone", "essayAnswers.q1", "participant.fullName", "application.twibbonLink" */
  key: string;
  old: unknown;
  new: unknown;
}

export interface ApplicationEditHistoryEntryDto {
  id: string;
  editedAt: Date;
  reason: string | null;
  /** null when the editing user row no longer resolves. */
  editor: { id: string; name: string; email: string } | null;
  changes: ApplicationEditHistoryChangeDto[];
}
