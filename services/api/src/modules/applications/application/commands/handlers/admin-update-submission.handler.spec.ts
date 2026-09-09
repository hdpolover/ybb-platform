/**
 * Unit tests for AdminUpdateSubmissionHandler
 *
 * Tests: lock bypass, personalData merge, name sync, audit record written.
 * All Prisma and CacheService calls are mocked — no DB required.
 */

import { NotFoundException } from '@nestjs/common';
import { AdminUpdateSubmissionHandler } from './admin-update-submission.handler';
import { AdminUpdateSubmissionCommand } from '../admin-update-submission.command';
import { createCacheServiceMock } from '@test/utils/cache-service-mock';

// ── Mocks ────────────────────────────────────────────────────────────────────

const EXISTING_APPLICATION = {
  id: 'app-uuid-1',
  participantId: 'participant-uuid-1',
  personalData: { full_name: 'Old Name', country: 'Indonesia' },
  essayAnswers: { motivation: 'Old motivation' },
  participant: {
    id: 'participant-uuid-1',
    userId: 'user-uuid-1',
    fullName: 'Old Name',
    nickName: null,
    displayName: null,
  },
};

const EDIT_HISTORY_RESULT = { id: 'edit-history-uuid-1' };

type ApplicationOverride = {
  personalData?: Record<string, unknown>;
  essayAnswers?: Record<string, unknown>;
  participant?: typeof EXISTING_APPLICATION['participant'];
} | null;

function buildPrismaMock(applicationOverride?: ApplicationOverride) {
  const application =
    applicationOverride === null ? null : { ...EXISTING_APPLICATION, ...applicationOverride };

  const updateApplication = jest.fn().mockResolvedValue({ id: 'app-uuid-1' });
  const updateParticipant = jest.fn().mockResolvedValue({ id: 'participant-uuid-1' });
  const createEditHistory = jest.fn().mockResolvedValue(EDIT_HISTORY_RESULT);

  const prisma = {
    participantApplication: {
      findUnique: jest.fn().mockResolvedValue(application),
      update: updateApplication,
    },
    participant: {
      update: updateParticipant,
    },
    applicationEditHistory: {
      create: createEditHistory,
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => {
      const results = await Promise.all(ops);
      return results;
    }),
  };

  return { prisma, updateApplication, updateParticipant, createEditHistory };
}

// Derived from the real CacheService rather than listed by hand. The previous
// literal predated invalidatePortalCache, and because this handler catches and
// logs invalidation failures - it must never fail the write - the missing method
// surfaced only as a TypeError in the CI log while every test still passed.
function buildCacheMock() {
  return createCacheServiceMock();
}

function makeHandler(prisma: ReturnType<typeof buildPrismaMock>['prisma'], cache = buildCacheMock()) {
  return new AdminUpdateSubmissionHandler(prisma as never, cache as never);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AdminUpdateSubmissionHandler', () => {
  describe('not found', () => {
    it('throws NotFoundException when application does not exist', async () => {
      const { prisma } = buildPrismaMock(null);
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'nonexistent-id',
        'admin-user-id',
        'Fix name typo',
      );

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });
  });

  describe('personalData merge', () => {
    it('shallow-merges supplied fields into existing personalData', async () => {
      const { prisma, updateApplication } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Correct country',
        { country: 'Singapore' }, // only this key changes
      );

      await handler.execute(command);

      const callArgs = updateApplication.mock.calls[0][0] as {
        data: { personalData: Record<string, unknown> };
      };
      expect(callArgs.data.personalData).toMatchObject({
        full_name: 'Old Name',   // preserved
        country: 'Singapore',    // updated
      });
    });

    it('preserves existing keys not mentioned in the patch', async () => {
      const { prisma, updateApplication } = buildPrismaMock({
        personalData: { full_name: 'Old Name', country: 'Indonesia', city: 'Jakarta' },
      });
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Correct name only',
        { full_name: 'New Name' },
      );

      await handler.execute(command);

      const callArgs = updateApplication.mock.calls[0][0] as {
        data: { personalData: Record<string, unknown> };
      };
      expect(callArgs.data.personalData).toMatchObject({
        full_name: 'New Name',
        country: 'Indonesia',  // untouched
        city: 'Jakarta',       // untouched
      });
    });
  });

  describe('name sync — participant.fullName supplied', () => {
    it('updates Participant.fullName and mirrors into personalData["full_name"]', async () => {
      const { prisma, updateParticipant, updateApplication } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Fix name typo',
        undefined, // no personalData patch
        undefined,
        { fullName: 'Corrected Name' },
      );

      await handler.execute(command);

      // Participant column updated
      const participantCall = updateParticipant.mock.calls[0][0] as {
        data: { fullName: string };
      };
      expect(participantCall.data.fullName).toBe('Corrected Name');

      // personalData mirrored
      const appCall = updateApplication.mock.calls[0][0] as {
        data: { personalData: Record<string, unknown> };
      };
      expect(appCall.data.personalData['full_name']).toBe('Corrected Name');
    });
  });

  describe('name sync — personalData["full_name"] supplied without participant patch', () => {
    it('syncs Participant.fullName to match the personalData value', async () => {
      const { prisma, updateParticipant } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Portal name fix',
        { full_name: 'Portal Corrected Name' }, // personalData only
      );

      await handler.execute(command);

      const participantCall = updateParticipant.mock.calls[0][0] as {
        data: { fullName: string };
      };
      expect(participantCall.data.fullName).toBe('Portal Corrected Name');
    });
  });

  describe('audit record', () => {
    it('writes an ApplicationEditHistory row with editedBy, reason, changes, and snapshot', async () => {
      const { prisma, createEditHistory } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-uuid',
        'Fix name before LoA',
        { full_name: 'Fixed Name' },
      );

      await handler.execute(command);

      const historyCall = createEditHistory.mock.calls[0][0] as {
        data: {
          editedBy: string;
          reason: string;
          changes: Record<string, unknown>;
          snapshot: Record<string, unknown>;
        };
      };

      expect(historyCall.data.editedBy).toBe('admin-user-uuid');
      expect(historyCall.data.reason).toBe('Fix name before LoA');
      // changes should record the personalData.full_name diff
      // Note: changes keys use literal dotted strings, not nested objects.
      const fullNameChange = historyCall.data.changes['personalData.full_name'] as {
        old: string;
        new: string;
      };
      expect(fullNameChange).toBeDefined();
      expect(fullNameChange.old).toBe('Old Name');
      expect(fullNameChange.new).toBe('Fixed Name');
      // snapshot should contain prior state
      const snap = historyCall.data.snapshot as { personalData: Record<string, unknown> };
      expect(snap.personalData).toBeDefined();
      expect(snap.personalData['full_name']).toBe('Old Name');
    });
  });

  describe('lock bypass', () => {
    it('does NOT check application status — accepted applications are editable', async () => {
      // The application fixture has no status field; the handler must not
      // inspect it (no canEdit() call, no BadRequestException on non-draft).
      const { prisma } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Admin override on accepted application',
        { country: 'Japan' },
      );

      // Should resolve without throwing
      await expect(handler.execute(command)).resolves.toMatchObject({
        success: true,
        applicationId: 'app-uuid-1',
      });
    });
  });

  describe('return value', () => {
    it('returns success, applicationId, and editHistoryId', async () => {
      const { prisma } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Minor correction',
        { country: 'Malaysia' },
      );

      const result = await handler.execute(command);

      expect(result).toMatchObject({
        success: true,
        applicationId: 'app-uuid-1',
        editHistoryId: EDIT_HISTORY_RESULT.id,
      });

      // Array-form `$transaction([a(), b(), c()])` evaluates a(), b(), c() eagerly
      // -- before $transaction is ever invoked -- so delegate-level assertions on
      // updateApplication/updateParticipant/createEditHistory pass identically
      // whether or not the writes are actually wrapped in $transaction (e.g. if
      // this were refactored to Promise.all([...]), which never calls
      // $transaction at all). Asserting the array shape handed to $transaction is
      // the strongest signal available with this mock shape; it is what actually
      // catches that regression, per the handler's own "Both updates happen
      // inside the same $transaction" invariant comment.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    });
  });

  // Audit M99: AdminParticipantPatchDto.fullName/nickName/displayName already
  // carry @MaxLength, but the personalData mirror path (only `personalData`
  // supplied, no `participant` patch) bypasses that DTO entirely -- it is a
  // free-form JSON blob validated only for ASCII/English content, not length.
  // On the pre-fix handler these oversized values sailed straight into the
  // participant.update() call below and would only fail once Postgres raised
  // an unnamed 22001. This is the regression guard: it fails on old code
  // because the pre-fix handler never threw here at all.
  describe('personalData mirror length guard (M99)', () => {
    it('rejects an oversized full_name mirrored from personalData with a named 400, before any write', async () => {
      const { prisma, updateParticipant, createEditHistory } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Mirror path abuse',
        { full_name: 'A'.repeat(256) }, // over participants.full_name VarChar(255)
      );

      await expect(handler.execute(command)).rejects.toThrow(/fullName/);
      expect(updateParticipant).not.toHaveBeenCalled();
      expect(createEditHistory).not.toHaveBeenCalled();
    });

    it('rejects an oversized nick_name mirrored from personalData', async () => {
      const { prisma, updateParticipant } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Mirror path abuse',
        { nick_name: 'B'.repeat(101) }, // over participants.nick_name VarChar(100)
      );

      await expect(handler.execute(command)).rejects.toThrow(/nickName/);
      expect(updateParticipant).not.toHaveBeenCalled();
    });

    it('rejects an oversized display_name mirrored from personalData', async () => {
      const { prisma, updateParticipant } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Mirror path abuse',
        { display_name: 'C'.repeat(101) }, // over participants.display_name VarChar(100)
      );

      await expect(handler.execute(command)).rejects.toThrow(/displayName/);
      expect(updateParticipant).not.toHaveBeenCalled();
    });

    it('still accepts a within-bounds full_name mirrored from personalData', async () => {
      const { prisma, updateParticipant } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Legit mirror update',
        { full_name: 'Jane Doe' },
      );

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(updateParticipant).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fullName: 'Jane Doe' }) }),
      );
    });

    it('does not re-check the participant patch path, which already has its own DTO-level MaxLength', async () => {
      // Sanity check: an oversized value supplied via `participant.fullName` is
      // caught the same way (same helper, same field), so both entry points
      // into the mirror logic are covered by the one guard.
      const { prisma, updateParticipant } = buildPrismaMock();
      const handler = makeHandler(prisma);

      const command = new AdminUpdateSubmissionCommand(
        'app-uuid-1',
        'admin-user-id',
        'Direct participant patch abuse',
        undefined,
        undefined,
        { fullName: 'D'.repeat(256) },
      );

      await expect(handler.execute(command)).rejects.toThrow(/fullName/);
      expect(updateParticipant).not.toHaveBeenCalled();
    });
  });
});
