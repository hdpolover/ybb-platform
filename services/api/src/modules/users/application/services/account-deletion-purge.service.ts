// src/modules/users/application/services/account-deletion-purge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DeletionStatus, Prisma } from '@prisma/client';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FirebaseAuthService } from '@modules/auth/infrastructure/services/firebase-auth.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildAccountDeletionCancelUrl } from '../utils/account-deletion-cancel-url.util';

// Purge volume is inherently low (people don't delete accounts by the
// thousands) - no need for RetentionService's 5000-row batching, one small
// page per run is plenty and keeps a single failing user cheap to retry.
const BATCH_SIZE = 50;
const REMINDER_DAYS_BEFORE = 7;

type DueRequest = { id: string; userId: string };
type ReminderCandidate = { id: string; userId: string; scheduledDeletionDate: Date | null; dataSnapshot: Prisma.JsonValue };

/**
 * Finishes what CreateDeletionRequestHandler starts: a request already
 * auto-schedules scheduledDeletionDate and deactivates the account at
 * creation time (no admin approval gate) - nothing ever read
 * scheduledDeletionDate again, so "30-day scheduled deletion" was fiction
 * until this job existed. Also sends the day-7-before reminder email, since
 * it needs the same "who is due soon" query this service already owns.
 *
 * Per user, in ONE transaction, the purge:
 *  - anonymises users/participants PII columns, including the free-text
 *    self-authored columns on participant_applications (motivationLetter,
 *    achievements, experiences) - product decision: these routinely contain
 *    names, employers and locations, so leaving them behind while scrubbing
 *    the structured columns would be incoherent.
 *  - nulls the JSON blobs on participant_applications that duplicate that
 *    PII independently of the structured columns
 *  - hard-deletes user_identities via a raw statement (bypassing the
 *    soft-delete extension, which would otherwise silently turn the delete
 *    into an update)
 *  - marks the request completed
 *
 * Deliberately NEVER touched, by product decision, and named here so a
 * future reader sees an omission and does not "helpfully" fix it:
 *  - application_invoices: financial records are retained regardless of how
 *    or why the account was deleted (amounts, currency, status, external
 *    transaction ids, reconciliation fields all stay).
 *  - ParticipantDocument (issued LoAs / certificates): these are documents
 *    YBB issued, not data the participant supplied - a record of something
 *    that happened, with its own retention rationale independent of the
 *    person's account.
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
 *
 * The completion email is sent AFTER the Firebase step but BEFORE the DB
 * transaction, for the same reason as Firebase-before-DB: the transaction
 * overwrites the user's email with a sentinel, so sending after would mail
 * deleted+<uuid>@ybb.invalid instead of the real address. Unlike Firebase,
 * an email-send failure is allowed to abort purgeOne (best-effort, no
 * try/catch around it) - nothing has been anonymised yet at that point, so
 * aborting just means a safe retry next run, and that is simpler than a
 * separate swallow-and-continue path for a rare notification-bus failure.
 */
@Injectable()
export class AccountDeletionPurgeService {
  private readonly logger = new Logger(AccountDeletionPurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly configService: ConfigService,
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

  // Runs once daily at 05:00 WIB - after the purge job's own 04:00 slot, so
  // a request whose scheduledDeletionDate is due TODAY gets purged (and its
  // completion email) before this ever gets a chance to send it a "your
  // account is being deleted soon" reminder instead.
  @Cron('0 5 * * *', { timeZone: 'Asia/Jakarta' })
  async runScheduledReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    const candidates: ReminderCandidate[] = await this.prisma.accountDeletionRequest.findMany({
      where: {
        status: DeletionStatus.approved,
        scheduledDeletionDate: { gt: now, lte: windowEnd },
      },
      select: { id: true, userId: true, scheduledDeletionDate: true, dataSnapshot: true },
    });

    // ponytail: "reminder not yet sent" is filtered here in JS rather than a
    // Postgres JSON-path where clause, since dataSnapshot is JSON and this
    // list is small (grace-period requests only). Add a dedicated
    // reminderSentAt column + index if this job's candidate set ever grows
    // large enough for that to matter.
    const due = candidates.filter((c) => {
      const snapshot = c.dataSnapshot as { reminderSentAt?: string } | null;
      return !snapshot?.reminderSentAt;
    });

    if (due.length === 0) return;

    let sent = 0;
    for (const request of due) {
      try {
        await this.sendReminder(request);
        sent += 1;
      } catch (error) {
        this.logger.error(
          `[account-deletion-reminder] request=${request.id} user=${request.userId} failed, will retry next run: ${toErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`[account-deletion-reminder] candidates=${candidates.length} sent=${sent}`);
  }

  private async sendReminder(request: ReminderCandidate): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: request.userId } });
    if (!user || user.deletedAt) return; // already purged or gone - nothing to remind

    // A fresh token is minted rather than resending the original: only a
    // hash of the request-time token was ever persisted (see
    // CreateDeletionRequestHandler - "never store the raw token"), so the
    // raw value from request time no longer exists anywhere to put back in
    // an email. A stale link from the first email will read as
    // invalid/expired after this rotation; CancelDeletionRequestHandler's
    // error message points people at their most recent email rather than
    // leaving them stuck on a dead link.
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.prisma.accountDeletionRequest.update({
      where: { id: request.id },
      data: {
        dataSnapshot: {
          cancellationTokenHash: tokenHash,
          cancellationTokenExpiresAt: request.scheduledDeletionDate?.toISOString() ?? null,
          reminderSentAt: new Date().toISOString(),
        },
      },
    });

    const brand = await this.prisma.brand.findUnique({ where: { id: user.brandId } });
    const participant = await this.prisma.participant.findUnique({
      where: { userId: request.userId },
      select: { fullName: true },
    });

    await this.rabbitmqProducer.emit('user.account-deletion-reminder', {
      email: user.email,
      name: participant?.fullName || user.email.split('@')[0],
      cancelUrl: buildAccountDeletionCancelUrl(this.configService, brand, request.id, token),
      scheduledDeletionDate: request.scheduledDeletionDate?.toISOString(),
      brand,
    });
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

    const participant = await this.prisma.participant.findUnique({ where: { userId: request.userId } });

    // DO NOT move this below the transaction that follows - it looks
    // backwards ("confirm deletion, then do it"), but the transaction is
    // what destroys the only address this could ever be sent to: it
    // overwrites user.email with a deleted+<uuid>@ybb.invalid sentinel. This
    // is the one point in purgeOne where the real address still exists, so
    // it is the only point where this send can work. Moving it after would
    // fail silently - the emit still "succeeds" from this job's point of
    // view (nothing throws, no test that only checks emission would catch
    // it), it would just mail nobody, and the first signal would be a
    // support ticket that never arrives. Same shape of trap as the
    // Firebase-before-DB ordering above: the correct sequence looks wrong,
    // the wrong sequence looks like a tidy refactor.
    //
    // Allowed to throw here (no try/catch, unlike Firebase's deliberate
    // absorb-and-continue): nothing has been anonymised yet at this point,
    // so a failure just aborts this purgeOne call for a safe retry next run.
    const brand = await this.prisma.brand.findUnique({ where: { id: user.brandId } });
    await this.rabbitmqProducer.emit('user.account-deletion-completed', {
      email: user.email,
      name: participant?.fullName || user.email.split('@')[0],
      brand,
    });

    const hadParticipant = !!participant;

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
        //
        // motivationLetter / achievements / experiences are plain Text
        // columns, not JSON, but are included here for the same reason: they
        // are self-authored personal narrative that routinely names people,
        // employers and locations - product decision to anonymise them
        // alongside the structured PII columns above.
        await tx.participantApplication.updateMany({
          where: { participantId: participant.id },
          data: {
            personalData: {},
            essayAnswers: {},
            uploadedFiles: {},
            documentFiles: {},
            requirementFiles: [],
            participantSnapshot: Prisma.JsonNull,
            motivationLetter: null,
            achievements: null,
            experiences: null,
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
