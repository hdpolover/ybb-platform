// src/modules/users/application/services/account-deletion-purge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeletionStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FirebaseAuthService } from '@modules/auth/infrastructure/services/firebase-auth.service';

// Purge volume is inherently low (people don't delete accounts by the
// thousands) - no need for RetentionService's 5000-row batching, one small
// page per run is plenty and keeps a single failing user cheap to retry.
const BATCH_SIZE = 50;

type DueRequest = { id: string; userId: string };

/**
 * Finishes what CreateDeletionRequestHandler / ReviewDeletionRequestHandler
 * start: an admin-approved deletion request only ever set
 * scheduledDeletionDate and isActive:false - nothing ever read
 * scheduledDeletionDate again, so "30-day scheduled deletion" was fiction
 * until this job existed.
 *
 * Per user, in ONE transaction:
 *  - anonymise users/participants PII columns
 *  - null the JSON blobs on participant_applications that duplicate PII
 *    independently of those columns
 *  - hard-delete user_identities (bypassing the soft-delete extension)
 *  - mark the request completed
 *
 * application_invoices is deliberately never touched - financial records are
 * retained on purpose.
 *
 * Firebase user deletion happens BEFORE the transaction, not inside it: it's
 * the one step with no way to detect "still pending" from the DB afterwards,
 * so if it were done last (or inside a tx that could still fail after it
 * ran) a failure there could leave a live Firebase credential for a
 * "completed" deletion with no way for a future run to ever notice and
 * retry it. Doing it first means: Firebase failure -> DB untouched, request
 * stays approved, retried next run. Firebase success -> DB failure -> DB
 * still untouched (real PII survives, but request also stays approved), and
 * retried next run; deleteUser() treats auth/user-not-found as success, so a
 * uid deleted by a previous partial run doesn't block convergence.
 */
@Injectable()
export class AccountDeletionPurgeService {
  private readonly logger = new Logger(AccountDeletionPurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAuthService: FirebaseAuthService,
  ) {}

  // Runs once daily at 04:00 WIB - after RetentionService's 03:30 slot.
  // UsersModule (like AuditModule) is only imported by the root AppModule,
  // never by any of the RMQ consumer bootstrap modules
  // (audit/reporting/payment-events/loa-events/reminder-events - see
  // src/bootstrap/*.ts), so this cron fires exactly once per deploy. Mirrors
  // the precedent documented on RetentionService.runScheduledCleanup.
  @Cron('0 4 * * *', { timeZone: 'Asia/Jakarta' })
  async runScheduledPurge(): Promise<void> {
    const due: DueRequest[] = await this.prisma.accountDeletionRequest.findMany({
      where: {
        status: DeletionStatus.approved,
        scheduledDeletionDate: { lte: new Date() },
      },
      select: { id: true, userId: true },
      take: BATCH_SIZE,
    });

    if (due.length === 0) return;

    let purged = 0;
    for (const request of due) {
      try {
        await this.purgeOne(request);
        purged += 1;
      } catch (error) {
        this.logger.error(
          `[account-deletion-purge] request=${request.id} user=${request.userId} failed, will retry next run: ${toErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`[account-deletion-purge] processed=${due.length} purged=${purged}`);
  }

  async purgeOne(request: DueRequest): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: request.userId } });

    if (!user) {
      // Nothing left to anonymise - close the request so it stops showing up as due.
      await this.prisma.accountDeletionRequest.update({
        where: { id: request.id },
        data: { status: DeletionStatus.completed, actualDeletionDate: new Date() },
      });
      this.logger.warn(`[account-deletion-purge] request=${request.id} user=${request.userId} not found; request closed`);
      return;
    }

    // Idempotency: a prior run may have anonymised the user and then failed
    // before marking the request completed (e.g. the DB tx succeeded but the
    // process died before the caller loop returned). Re-running the
    // anonymisation is harmless but pointless and would re-attempt Firebase
    // deletes for uids whose identity rows are already gone - skip straight
    // to closing the request.
    if (user.deletedAt) {
      await this.prisma.accountDeletionRequest.update({
        where: { id: request.id },
        data: { status: DeletionStatus.completed, actualDeletionDate: new Date() },
      });
      this.logger.log(`[account-deletion-purge] request=${request.id} user=${request.userId} already anonymised; request closed`);
      return;
    }

    const identities = await this.prisma.userIdentity.findMany({
      where: { userId: request.userId },
      select: { providerUserId: true },
    });
    const firebaseUids = [...new Set(identities.map((i) => i.providerUserId).filter((v): v is string => !!v))];

    // Deliberately outside the transaction - see class-level comment on ordering.
    for (const uid of firebaseUids) {
      await this.firebaseAuthService.deleteUser(uid);
    }

    let hadParticipant = false;

    await this.prisma.$transaction(async (tx) => {
      const anonymizedEmail = `deleted+${randomUUID()}@ybb.invalid`;

      await tx.user.update({
        where: { id: request.userId },
        data: {
          email: anonymizedEmail,
          passwordHash: null,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          isActive: false,
          deletedAt: new Date(),
        },
      });

      const participant = await tx.participant.findUnique({ where: { userId: request.userId } });
      hadParticipant = !!participant;

      if (participant) {
        await tx.participant.update({
          where: { userId: request.userId },
          data: {
            fullName: 'Deleted User',
            nickName: null,
            displayName: null,
            birthdate: null,
            gender: null,
            phoneCountryCode: null,
            phoneNumber: null,
            nationality: null,
            nationalityCode: null,
            originCountry: null,
            originCity: null,
            originAddress: null,
            currentCountry: null,
            currentCity: null,
            currentAddress: null,
            educationLevel: null,
            institution: null,
            major: null,
            graduationYear: null,
            occupation: null,
            instagramUsername: null,
            linkedinUrl: null,
            portfolioUrl: null,
            organizations: null,
            dietaryRestrictions: null,
            medicalConditions: null,
            specialNeeds: null,
            emergencyContactName: null,
            emergencyContactRelation: null,
            emergencyContactCountryCode: null,
            emergencyContactPhone: null,
            emergencyContactEmail: null,
            profilePictureUrl: null,
            resumeUrl: null,
            deletedAt: new Date(),
            deletedBy: request.userId,
          },
        });

        // personal_data / essay_answers / uploaded_files / document_files /
        // requirement_files are dynamic, admin-configurable form-field maps
        // with no closed key schema anywhere in this codebase (see
        // application-form-field admin CRUD) - stripping "known PII keys"
        // would silently miss any custom field an admin adds later, which is
        // worse than nulling. participant_snapshot has no writer at all in
        // this codebase (dead/legacy column, unknown shape). All five are
        // cleared wholesale rather than picked apart key-by-key.
        await tx.participantApplication.updateMany({
          where: { participantId: participant.id },
          data: {
            personalData: {},
            essayAnswers: {},
            uploadedFiles: {},
            documentFiles: {},
            requirementFiles: [],
            participantSnapshot: Prisma.JsonNull,
          },
        });
      }

      // Hard delete - NOT soft delete. user_identities has a deletedAt
      // column, so the extended client's .delete()/.deleteMany() would
      // silently turn this into an UPDATE ... SET deleted_at, and
      // findFirst/findUnique's soft-delete filter would then hide it - but
      // it would still exist, and a to-one `include: { user: true }` (see
      // firebase-login.handler) doesn't get that filter injected at all
      // (Prisma rejects `where` on singular relation includes), so a
      // leftover identity row can resurrect the anonymised account on the
      // next login. $executeRaw bypasses the extension (it only patches
      // model-scoped operations, not raw queries) for a genuine hard delete.
      await tx.$executeRaw`DELETE FROM user_identities WHERE user_id = ${request.userId}::uuid`;

      await tx.accountDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: DeletionStatus.completed,
          actualDeletionDate: new Date(),
          deletionLog: {
            purgedAt: new Date().toISOString(),
            hadParticipant,
            firebaseUidsDeleted: firebaseUids,
          },
        },
      });
    });

    this.logger.log(
      `[account-deletion-purge] request=${request.id} user=${request.userId} anonymised (participant=${hadParticipant}, firebaseUids=${firebaseUids.length})`,
    );
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
