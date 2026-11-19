// services/api/src/modules/applications/application/queries/handlers/get-application-edit-history.handler.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetApplicationEditHistoryQuery } from '../get-application-edit-history.query';
import {
  ApplicationEditHistoryChangeDto,
  ApplicationEditHistoryEntryDto,
} from '../../dto/application-edit-history-response.dto';

const MAX_ENTRIES = 100;

/** `changes` is `{ key: { old, new } }`; tolerate malformed rows rather than 500 the panel. */
function flattenChanges(changes: unknown): ApplicationEditHistoryChangeDto[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes as Record<string, unknown>).map(([key, diff]) => {
    const d = (diff && typeof diff === 'object' ? diff : {}) as { old?: unknown; new?: unknown };
    return { key, old: d.old ?? null, new: d.new ?? null };
  });
}

/**
 * Read side of application_edit_history (written by AdminUpdateSubmissionHandler).
 * Uses the primary pool, not the replica: an admin who just saved an edit
 * expects to see it in the history on the very next request.
 */
@Injectable()
export class GetApplicationEditHistoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetApplicationEditHistoryQuery): Promise<ApplicationEditHistoryEntryDto[]> {
    const rows = await this.prisma.applicationEditHistory.findMany({
      where: { applicationId: query.applicationId },
      orderBy: { createdAt: 'desc' },
      take: MAX_ENTRIES,
      select: { id: true, editedBy: true, reason: true, changes: true, createdAt: true },
    });
    if (rows.length === 0) return [];

    // editedBy references users.id; one batched lookup for all distinct editors.
    const editorIds = [...new Set(rows.map((r) => r.editedBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: editorIds } },
      select: { id: true, email: true, admin: { select: { fullName: true } } },
    });
    const editors = new Map(users.map((u) => [u.id, u]));

    return rows.map((row) => {
      const u = editors.get(row.editedBy);
      return {
        id: row.id,
        editedAt: row.createdAt,
        reason: row.reason,
        editor: u ? { id: u.id, name: u.admin?.fullName ?? u.email, email: u.email } : null,
        changes: flattenChanges(row.changes),
      };
    });
  }
}
