import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { AdminUpdateSubmissionCommand } from '../admin-update-submission.command';

/**
 * Admin Update Submission Handler
 *
 * Application Layer - Command Handler
 *
 * Intentionally bypasses the canEdit() / status-draft guard so admins can fix
 * typos in locked (post-submit) applications without reopening them.
 *
 * NAME SYNC RULE
 * ──────────────
 * Two stores hold the participant's name:
 *   1. `Participant.fullName`  — canonical DB column used by LoA generation
 *      (manage-program-content.handlers.ts:1472).
 *   2. `personalData["full_name"]` — the form-response JSON value shown in the
 *      portal UI.
 *
 * This handler keeps them in agreement via the following single-direction rule:
 *   - If `participant.fullName` is explicitly supplied, it is written to
 *     `Participant.fullName` AND mirrored into `personalData["full_name"]`.
 *   - If ONLY `personalData["full_name"]` is supplied (no participant patch),
 *     `Participant.fullName` is also updated to match.
 *   - Both updates happen inside the same $transaction so they are always
 *     in sync after the call completes.
 *
 * The same mirror logic applies to nickName → personalData["nick_name"] and
 * displayName → personalData["display_name"].
 */
@Injectable()
export class AdminUpdateSubmissionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: AdminUpdateSubmissionCommand): Promise<{
    success: boolean;
    applicationId: string;
    editHistoryId: string;
  }> {
    // ── 1. Load application + participant ────────────────────────────────────
    const application = await this.prisma.participantApplication.findUnique({
      where: { id: command.applicationId },
      select: {
        id: true,
        participantId: true,
        personalData: true,
        essayAnswers: true,
        motivationLetter: true,
        achievements: true,
        experiences: true,
        twibbonLink: true,
        participant: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            nickName: true,
            displayName: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    const existing = application.participant;

    // ── 2. Compute merged personalData ───────────────────────────────────────
    const prevPersonalData = (application.personalData ?? {}) as Record<string, unknown>;
    let nextPersonalData: Record<string, unknown> = { ...prevPersonalData };

    if (command.personalData) {
      nextPersonalData = { ...nextPersonalData, ...command.personalData };
    }

    // ── 3. Compute merged essayAnswers ───────────────────────────────────────
    const prevEssayAnswers = (application.essayAnswers ?? {}) as Record<string, unknown>;
    let nextEssayAnswers: Record<string, unknown> = { ...prevEssayAnswers };

    if (command.essayAnswers) {
      nextEssayAnswers = { ...nextEssayAnswers, ...command.essayAnswers };
    }

    // ── 3b. Application text-column patch (stored on the application row) ─────
    const appPatch = command.application ?? {};
    const APP_COLS = ['motivationLetter', 'achievements', 'experiences', 'twibbonLink'] as const;
    const appColumnUpdates: Partial<Record<(typeof APP_COLS)[number], string>> = {};
    for (const col of APP_COLS) {
      const v = appPatch[col];
      if (v !== undefined) appColumnUpdates[col] = v;
    }

    // ── 4. Name sync logic ───────────────────────────────────────────────────
    // Determine the final Participant column values and sync them into personalData.
    const participantPatch = command.participant ?? {};

    // fullName
    let nextFullName = existing.fullName;
    if (participantPatch.fullName !== undefined) {
      // Participant patch wins; mirror into personalData
      nextFullName = participantPatch.fullName;
      nextPersonalData['full_name'] = participantPatch.fullName;
    } else if (
      command.personalData &&
      typeof command.personalData['full_name'] === 'string'
    ) {
      // personalData patch only; sync back to Participant column
      nextFullName = command.personalData['full_name'];
    }

    // nickName
    let nextNickName = existing.nickName ?? undefined;
    if (participantPatch.nickName !== undefined) {
      nextNickName = participantPatch.nickName;
      nextPersonalData['nick_name'] = participantPatch.nickName;
    } else if (
      command.personalData &&
      typeof command.personalData['nick_name'] === 'string'
    ) {
      nextNickName = command.personalData['nick_name'];
    }

    // displayName
    let nextDisplayName = existing.displayName ?? undefined;
    if (participantPatch.displayName !== undefined) {
      nextDisplayName = participantPatch.displayName;
      nextPersonalData['display_name'] = participantPatch.displayName;
    } else if (
      command.personalData &&
      typeof command.personalData['display_name'] === 'string'
    ) {
      nextDisplayName = command.personalData['display_name'];
    }

    // ── 5. Build changes diff (before/after for changed keys only) ───────────
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    // personalData diff
    for (const [key, newVal] of Object.entries(nextPersonalData)) {
      const oldVal = prevPersonalData[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[`personalData.${key}`] = { old: oldVal, new: newVal };
      }
    }

    // essayAnswers diff
    for (const [key, newVal] of Object.entries(nextEssayAnswers)) {
      const oldVal = prevEssayAnswers[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[`essayAnswers.${key}`] = { old: oldVal, new: newVal };
      }
    }

    // Participant column diffs
    if (nextFullName !== existing.fullName) {
      changes['participant.fullName'] = { old: existing.fullName, new: nextFullName };
    }
    if (nextNickName !== (existing.nickName ?? undefined)) {
      changes['participant.nickName'] = { old: existing.nickName, new: nextNickName };
    }
    if (nextDisplayName !== (existing.displayName ?? undefined)) {
      changes['participant.displayName'] = { old: existing.displayName, new: nextDisplayName };
    }

    // Application column diffs
    for (const col of APP_COLS) {
      const newVal = appColumnUpdates[col];
      if (newVal !== undefined && newVal !== application[col]) {
        changes[`application.${col}`] = { old: application[col], new: newVal };
      }
    }

    // Snapshot of prior state for the audit row
    const snapshot = {
      personalData: prevPersonalData,
      essayAnswers: prevEssayAnswers,
      participant: {
        fullName: existing.fullName,
        nickName: existing.nickName,
        displayName: existing.displayName,
      },
      application: {
        motivationLetter: application.motivationLetter,
        achievements: application.achievements,
        experiences: application.experiences,
        twibbonLink: application.twibbonLink,
      },
    };

    // ── 6. Write everything atomically ───────────────────────────────────────
    const [, , editHistory] = await this.prisma.$transaction([
      this.prisma.participantApplication.update({
        where: { id: command.applicationId },
        data: {
          personalData: nextPersonalData as Prisma.InputJsonValue,
          essayAnswers: nextEssayAnswers as Prisma.InputJsonValue,
          ...appColumnUpdates,
          lastEditedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      this.prisma.participant.update({
        where: { id: application.participantId },
        data: {
          fullName: nextFullName,
          nickName: nextNickName,
          displayName: nextDisplayName,
        },
      }),
      this.prisma.applicationEditHistory.create({
        data: {
          applicationId: command.applicationId,
          editedBy: command.adminUserId,
          reason: command.reason,
          changes: changes as Prisma.InputJsonValue,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      }),
    ]);

    // ── 7. Cache invalidation ────────────────────────────────────────────────
    // Invalidate the same cache keys the review handler clears so the
    // participant sees the corrected data immediately in the portal.
    await this.invalidateParticipantCache(application.participantId, existing.userId);

    return {
      success: true,
      applicationId: command.applicationId,
      editHistoryId: editHistory.id,
    };
  }

  /**
   * Invalidates portal and participant cache for the affected participant.
   *
   * Keys cleared:
   *   - portal:dashboard:<userId>
   *   - portal:documents:<userId>
   *   - participant:profile:<userId>
   *   - participant:stats:<participantId>
   *   - participant:latest-app:<participantId>
   *   - portal:submissions:<userId>:* (pattern)
   *   - portal:submission-detail:<userId>:* (pattern)
   *   - portal:payments:<userId>:* (pattern)
   */
  private async invalidateParticipantCache(
    participantId: string,
    userId: string,
  ): Promise<void> {
    try {
      const keys = [
        CACHE_KEYS.PARTICIPANT_PROFILE(userId),
        CACHE_KEYS.PARTICIPANT_STATS(participantId),
        CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
      ];

      await Promise.all([
        this.cacheService.invalidatePortalCache(userId),
        ...keys.map((key) => this.cacheService.invalidateKey(key)),
      ]);
    } catch (error) {
      // Cache invalidation failures must not roll back the write.
      // The data is correct in the DB; stale cache will expire on its own.
      console.error(
        `[AdminUpdateSubmission] Cache invalidation failed for participant ${participantId}:`,
        error,
      );
    }
  }
}
